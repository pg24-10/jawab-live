import { sbSelect } from "./_supabase.js";

export default async function handler(req, res) {
  try {
    const rows = await sbSelect("replies", "select=language,request_type,item_count,refused&refused=eq.false&limit=10000");
    const langs = {}, types = {};
    let items = 0;
    for (const r of rows) {
      if (r.language) langs[r.language] = (langs[r.language] || 0) + 1;
      if (r.request_type) types[r.request_type] = (types[r.request_type] || 0) + 1;
      items += r.item_count || 0;
    }
    const top = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      replies: rows.length,
      languages: Object.keys(langs).length,
      language_list: Object.entries(langs).sort((a, b) => b[1] - a[1]).map(([k]) => k),
      items_captured: items,
      top_request: top ? top[0] : null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "stats unavailable" });
  }
}
