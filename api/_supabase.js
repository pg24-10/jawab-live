// Tiny Supabase REST helper (no npm packages needed).
// Keys come only from Vercel environment variables.
const URL_ = () => (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = () => process.env.SUPABASE_SERVICE_KEY || "";

function headers(extra = {}) {
  const key = KEY();
  const h = { apikey: key, "Content-Type": "application/json", ...extra };
  // Legacy service_role keys are JWTs and also go in Authorization.
  if (!key.startsWith("sb_")) h.Authorization = `Bearer ${key}`;
  return h;
}

export async function sbInsert(table, row) {
  const r = await fetch(`${URL_()}/rest/v1/${table}`, {
    method: "POST",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`Supabase insert failed: ${r.status} ${await r.text()}`);
}

export async function sbCount(table, query) {
  const r = await fetch(`${URL_()}/rest/v1/${table}?${query}&select=id`, {
    method: "HEAD",
    headers: headers({ Prefer: "count=exact" }),
  });
  const range = r.headers.get("content-range") || "*/0";
  return parseInt(range.split("/")[1] || "0", 10);
}

export async function sbSelect(table, query) {
  const r = await fetch(`${URL_()}/rest/v1/${table}?${query}`, { headers: headers() });
  if (!r.ok) throw new Error(`Supabase select failed: ${r.status}`);
  return r.json();
}
