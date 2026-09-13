# Riverbed

A private thought-journaling app. You write; on a cadence you control
(or on demand), it re-reads a window of your entries and surfaces
patterns as gentle, specific questions — never diagnoses, never
verdicts. Every claim it makes cites the entries it came from, so you
can go check for yourself.

## What's here

```
server/   Express API — SQLite/Turso storage, LLM adapter, reflection engine
client/   React + Vite frontend
```

## First-time setup

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
```

Open `.env` and fill in:

- `TURSO_DATABASE_URL` — for local dev, leave it as `file:./riverbed.db`.
  When you're ready to host it (so you can journal from your phone
  too), sign up at https://turso.tech (free tier), create a database,
  and swap in the `libsql://...` URL + auth token it gives you. Nothing
  else in the code changes.
- `GEMINI_API_KEY` — get a free key at https://aistudio.google.com.
  No credit card required for the free tier. This is what powers the
  reflection engine and the Ask feature.

Then:

```bash
npm run migrate   # creates the schema
npm run dev        # starts the API on :3001
```

### 2. Frontend

In a second terminal:

```bash
cd client
npm install
npm run dev        # starts on :5173, proxies /api to :3001
```

Open http://localhost:5173. Start writing.

## Switching LLM providers

Everything the app needs from a model goes through
`server/src/llm/adapter.js`. To switch providers, change one line in
`server/.env`:

```
LLM_PROVIDER=gemini     # or: anthropic, ollama
```

- `gemini` — free tier, 1M token context, good default (see
  `providers/gemini.js`)
- `anthropic` — higher quality, not free; useful for an occasional
  high-stakes reflection pass (`providers/anthropic.js`)
- `ollama` — fully local/offline, needs Ollama running on your machine
  (`providers/ollama.js`)

Each provider file implements the same two functions (`chat`, `embed`),
so adding a new one is a matter of writing a fourth file in the same
shape and registering it in `adapter.js`.

## A note on privacy

Gemini's free tier documentation states that free-tier content may be
used to improve Google's products; the paid tier is handled
differently. Given this app is meant to hold unfiltered private
writing, it's worth deciding deliberately whether that trade-off is
one you're comfortable with — the Settings page in the app always
shows you exactly what would be sent to the model and how many entries
are in scope, before anything is sent. If it bothers you, flipping
`LLM_PROVIDER` to `anthropic` or `ollama` costs one line, not a
rewrite.

## What's built vs. what's a next step

**Built and working end-to-end:**
- Frictionless capture (blank page, autosave to a local draft, no
  required fields)
- Entries: soft delete with undo, exclude-from-AI toggle, full JSON
  export
- Reflection engine: on-demand ("Reflect now" button) and a daily cron
  that checks a configurable weekly/monthly cadence
- Ask: ad-hoc questions grounded in your actual entries, with citations
- Settings: cadence control, and a transparent preview of exactly what
  data would be sent to the model

**Deliberately left as a next step** (the spec called these out but
they're substantial enough to warrant their own pass once the core
loop feels right to you):
- Semantic (embedding-based) search, beyond the current substring
  search — the `embeddings` table and `embed()` adapter function are
  already there, wired for this
- The visual "connection web" between entries — the `entry_links`
  table exists; nothing populates or renders it yet
- A density-over-time / theme visualization for the whole body of
  writing
- Auto-inferred tags (mood/topic/people) — the `tags` table supports
  both user and AI sources; only manual tagging is wired up so far
