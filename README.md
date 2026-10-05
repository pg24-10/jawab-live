# Jawab: live AI reply demo (Task 4)

The Jawab landing page plus one working feature: **"Reply to my customer."** A visitor pastes a customer's WhatsApp message (Hinglish, Hindi, Marathi, Tamil...), picks a shop type and optionally a price list, and Jawab drafts a courteous reply in the same language plus the next action and a pick list.

## Stack
- **Vercel**: hosts `index.html` and two serverless functions
  - `api/reply.js`: checks the per-visitor cap, calls Gemini, stores the exchange in Supabase, returns the reply
  - `api/stats.js`: reads the Supabase table and returns the numbers shown on the page
- **Gemini API** (`gemini-3.1-flash-lite`): structured JSON output, max 300 output tokens
- **Supabase**: table `replies` (see `schema.sql`), row level security on, server-only access

## Environment variables (set in Vercel, never in this repo)
`GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

## Guardrails
Prices only from the owner's list; no promised refunds, discounts or delivery times; calm replies to abuse; no medical advice; refuses anything that isn't a customer message (prompt injection, essays, resumes). 5 replies per visitor per 24 hours, counted from stored rows.

Student concept project for ISB GenAI 101. Jawab is not a registered company.
