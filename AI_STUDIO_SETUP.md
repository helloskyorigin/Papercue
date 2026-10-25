# PaperCue in Google AI Studio Build mode

PaperCue is a **Next.js full-stack application**, not a static React website. Its analysis API is implemented by Node route `app/api/analyze/route.ts`. Importing just the UI does **not** import a working backend.

## 1. Import and preserve the backend

1. In AI Studio **Build**, use **Import from GitHub** and select `helloskyorigin/Papercue`, or, if already imported, open **Settings > GitHub** and **Pull** the latest `main` commit (resolve conflicts deliberately). Do not assume a fresh GitHub push was pulled automatically.
2. Ask the AI Studio agent to preserve the Next.js App Router, `app/api/analyze/route.ts`, and `app/api/health/route.ts`. The app must run the full-stack Node runtime, not a client-only preview. If AI Studio rewrites the project as Vite/React, it must implement the equivalent **server-side** `/api/analyze` and `/api/health` handlers instead of calling Groq from the browser.
3. Add `GROQ_API_KEY` under **Settings > Secrets**, using the key from the Groq console. **Never** paste keys into chat, React components, commits or `NEXT_PUBLIC_*` variables. Optional `GROQ_MODEL=qwen/qwen3.8-27b`.
4. Restart/reload the app preview so the Node backend picks up the secret.
5. Open `/api/health` on the running preview's origin. Expected response when ready: `{"ok":true,"backend":"nextjs-node","provider":"groq","configured":true, ...}`. This endpoint **does not contact Groq**; it checks only server routing and secret presence.
6. Paste a short **real but non-sensitive** notice (at least 35 characters) and click **Create my action plan**. It must generate a response different from the demo and show actual source quotes. Try an image, then a text-based PDF.

## AI Studio prompt to paste if the import becomes frontend-only

> Repair the imported PaperCue app as a full-stack Node.js application. Keep the existing premium React UI, but make `/api/health` and `/api/analyze` real server-side endpoints. Do not call Groq directly from React and never reveal GROQ_API_KEY to the browser. Read it from AI Studio Settings > Secrets. Preserve the `qwen/qwen3.8-27b` model, file validation, text-based PDF support, and the existing JSON response shape. The health endpoint must indicate `configured: false` if the key is missing, without exposing it. On a live paste-text scan, POST FormData to `/api/analyze` and show the actual returned checklist, deadlines, evidence and clear upstream error states. Do not generate demo responses on API failures. Run a real server smoke test for `/api/health` and a test with a Groq key and report their statuses.

## Troubleshooting by result

| Symptom | Cause / fix |
| --- | --- |
| `/api/health` is HTML / 404 | Backend is not running or the import is frontend-only. Restore server route handlers. |
| `/api/health` is JSON, `configured: false` | `GROQ_API_KEY` not configured in the server's Secrets. Restart after adding. |
| `GROQ_INVALID_KEY` | Key invalid/revoked; generate another in Groq console. |
| `GROQ_MODEL_UNAVAILABLE` | Groq model unavailable to your account; change `GROQ_MODEL` to an image-capable model if scanning photos. |
| `GROQ_RATE_LIMIT` | Groq quota/rate limit exceeded; retry according to account limits. |
| PDF unsupported/scanned | Upload a clear JPG/PNG of the notice or a selectable-text PDF. |
| Upload too large | Max 3MB, reduce image resolution. |
| Works locally but not on Vercel | Add `GROQ_API_KEY` to the Vercel project environment, redeploy, and check `/api/health`. |

## Verify independently

`npm install && npm test && npm run lint && npm run build`

Then run `npm run dev`, GET `/api/health`, POST `/api/analyze` with FormData and a valid Groq secret. **Passing unit tests does not establish live Groq connectivity.**
