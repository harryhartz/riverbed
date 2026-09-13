# Riverbed

A private thought-journal. You write; on a cadence you control (or on
demand), it quietly re-reads a window of your entries and surfaces
patterns as gentle, specific questions — never diagnoses, never
verdicts. Every claim it makes cites the entries it came from.

## What's here

```
netlify/    Netlify Functions backend — this is what actually runs in production
client/     React + Vite frontend
server/     Old Express backend — kept for reference only, not used when deployed to Netlify
```

## Deploying (Netlify + GitHub)

1. Push this folder to a new GitHub repository.
2. On https://app.netlify.com, "Add new site" → "Import an existing project" → connect the GitHub repo.
3. Netlify will read `netlify.toml` automatically (build command, publish
   dir, and functions dir are all set there — you don't need to configure
   these by hand).
4. Before the first deploy, set environment variables: Site settings →
   Environment variables → add everything from `netlify/.env.example`
   (Turso URL/token, Gemini key, Cloudinary cloud name + preset).
5. Deploy. Every push to the connected branch redeploys automatically.

## Running it locally first (recommended before deploying)

```bash
npm install -g netlify-cli
cd riverbed
cp netlify/.env.example netlify/.env    # fill in your real keys
netlify dev
```

Open the URL it prints (usually http://localhost:8888). This runs the
real functions + the real frontend together, the same shape as
production.

## Environment variables you need

- **Turso** (https://turso.tech, free tier) — `TURSO_DATABASE_URL` +
  `TURSO_AUTH_TOKEN`. Create a database, copy both from its dashboard.
- **Gemini** (https://aistudio.google.com, free tier, no card) —
  `GEMINI_API_KEY`. As of April 2026 the free tier is Flash-only —
  keep `GEMINI_CHAT_MODEL` pointed at a Flash model (check
  https://ai.google.dev/gemini-api/docs/models for the current name
  if you get a 404).
- **Cloudinary** (https://cloudinary.com, free tier) —
  `CLOUDINARY_CLOUD_NAME` (from your dashboard home page) and
  `CLOUDINARY_UPLOAD_PRESET` (create one at Settings → Upload →
  Upload presets, **signing mode: Unsigned**). Only needed if you
  want photo attachments / standalone image posts.

Full list with comments: `netlify/.env.example`.

## Switching LLM providers

Everything the app needs from a model goes through
`netlify/lib/llm/adapter.js`. Change one variable:

```
LLM_PROVIDER=gemini     # or: anthropic, ollama
```

- `gemini` — free tier, good default
- `anthropic` — higher quality, not free
- `ollama` — fully local/offline, needs Ollama running

## Using it on your phone

Once deployed, visit the same Netlify URL from your phone's browser —
it's the same app, same data. On iOS Safari or Android Chrome, use
"Add to Home Screen" and it installs like a small app (the manifest
and icons for this are already set up in `client/public/`).

## What's built and tested

- Frictionless capture: blank page, auto-expanding textarea (starts
  small, grows as you write), local draft safety net, no required
  fields
- Photo attachment to any entry, or a standalone photo-only post —
  same flow, photo and text are both optional
- Entries: soft delete with undo, exclude-from-AI toggle, full JSON
  export, a quiet "root-tendril" spine connecting entries chronologically
- Reflection engine: on-demand ("Reflect now") and a daily scheduled
  function that checks a configurable weekly/monthly cadence
- Constellation view: a node-graph of every AI-detected connection
  between entries, laid out with a simple force simulation, with an
  accessible list-based fallback for keyboard/screen-reader use
- Ask: ad-hoc questions grounded in your actual entries, with citations
- Settings: cadence control, and a transparent preview of exactly what
  data would be sent to the model before anything is sent
- Dark forest-floor visual design (Fraunces + Spectral fonts), PWA
  manifest for home-screen install

## Honestly, what to check yourself before relying on it

- `netlify dev` was verified starting correctly and loading all
  functions, but a full click-through wasn't possible in the build
  sandbox (network restrictions blocked a one-time asset download
  the Netlify CLI needs) — run through it once yourself after `netlify dev`
  starts cleanly on your machine.
- Cloudinary upload/delete was written and reviewed carefully but not
  tested against a real Cloudinary account — test the "+ photo" flow
  once you've set your environment variables.
- Auto-inferred tags, semantic (embedding-based) search, and populating
  `entry_links` automatically from reflections are not built yet — the
  reflection engine currently generates prose reflections, not
  structured links between specific entries. This would be a natural
  next step if the connection features (Constellation, the Entries
  page's connection markers) feel worth investing in further.
