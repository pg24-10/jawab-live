-- Run once in Supabase > SQL Editor
create table if not exists public.replies (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  visitor_id    text not null,          -- one-way hash, no IP or name stored
  shop_type     text,
  input         text not null,          -- customer message pasted by visitor
  output        text,                   -- reply drafted by Gemini
  language      text,
  request_type  text,
  item_count    int default 0,
  refused       boolean default false,
  input_tokens  int,
  output_tokens int,
  latency_ms    int,
  model         text
);
create index if not exists replies_visitor_idx on public.replies (visitor_id, created_at);
-- Lock the table: only the server (service key) can read or write.
alter table public.replies enable row level security;
