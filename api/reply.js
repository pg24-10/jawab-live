import crypto from "node:crypto";
import { MODEL, FALLBACK_MODEL, MAX_OUTPUT_TOKENS, DAILY_CAP, MAX_INPUT_CHARS, SYSTEM_PROMPT, RESPONSE_SCHEMA, buildUserPrompt } from "./_prompt.js";
import { sbInsert, sbCount } from "./_supabase.js";

const SHOP_TYPES = ["Kirana / general store", "Fruits and vegetables", "Dairy and bakery", "Dry fruits and spices"];

function visitorId(req, clientId) {
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  // Store only a one-way hash, never the raw IP.
  return crypto.createHash("sha256").update(`${ip}|${clientId || ""}`).digest("hex").slice(0, 24);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const message = String(body.message || "").trim();
  const prices = String(body.prices || "").slice(0, 600);
  const shopType = SHOP_TYPES.includes(body.shop_type) ? body.shop_type : SHOP_TYPES[0];

  if (!message) return res.status(400).json({ error: "Paste a customer message first." });
  if (message.length > MAX_INPUT_CHARS) return res.status(400).json({ error: `Please keep the message under ${MAX_INPUT_CHARS} characters.` });

  const vid = visitorId(req, body.client_id);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  try {
    // Per-visitor cap, counted from stored rows in Supabase.
    const used = await sbCount("replies", `visitor_id=eq.${vid}&created_at=gte.${since}`);
    if (used >= DAILY_CAP) {
      return res.status(429).json({ error: `You've used all ${DAILY_CAP} free demo replies for today. Join the pilot for unlimited replies.`, remaining: 0 });
    }

    // Call Gemini. Retry on temporary overload (429/503), then fall back to a sibling model.
    const t0 = Date.now();
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: buildUserPrompt({ message, shopType, prices }) }] }],
      generationConfig: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });
    let gj = null, usedModel = MODEL;
    for (const [i, m] of [MODEL, MODEL, FALLBACK_MODEL].entries()) {
      const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: payload,
      });
      gj = await g.json();
      if (g.ok) { usedModel = m; break; }
      if (![429, 500, 503].includes(g.status) || i === 2) throw new Error(gj.error?.message || "Gemini error");
      await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    }

    const text = (gj.candidates?.[0]?.content?.parts || []).map((p) => p.text).join("");
    let out;
    try { out = JSON.parse(text); } catch { throw new Error("The AI reply was cut off. Please try a shorter message."); }

    const usage = gj.usageMetadata || {};
    await sbInsert("replies", {
      visitor_id: vid,
      shop_type: shopType,
      input: message,
      output: out.reply,
      language: out.language,
      request_type: out.request_type,
      item_count: Array.isArray(out.items) ? out.items.length : 0,
      refused: !!out.refused,
      input_tokens: usage.promptTokenCount || null,
      output_tokens: usage.candidatesTokenCount || null,
      latency_ms: Date.now() - t0,
      model: usedModel,
    });

    return res.status(200).json({ ...out, remaining: DAILY_CAP - used - 1 });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Something went wrong drafting the reply. Please try again." });
  }
}
