# Fix PaperCue in Google AI Studio Build

PaperCue is a **full-stack Next.js** app, not an HTML-only design. Its AI is served from `app/api/analyze/route.ts` and requires the **server-side** `GROQ_API_KEY` secret.

## Get the latest version into AI Studio

1. Open AI Studio Build → **Settings → GitHub**, select `helloskyorigin/Papercue` and **Pull** the newest `main` commit. If import occurred before these fixes, the AI Studio copy is stale until synced.
2. Preserve the Node.js backend / Next.js App Router. GET `/api/health` on the preview origin must return JSON with `backend: "nextjs-node"`.
3. Open AI Studio **Settings → Secrets**. Add `GROQ_API_KEY` using your key from Groq Console. Don't paste it into chat, client-side code, GitHub, or `NEXT_PUBLIC_` variables.
4. Restart/reload the preview. GET `/api/health` should now contain `configured: true`. This only checks the key is present; it does **not** make a live Groq request.
5. Paste a real, non-sensitive notice (at least 35 characters), click **Create my action plan**, and verify real results. The fictional **sample** button must not be used as proof of API integration.
6. Test a clear JPG/PNG and a text-based PDF up to 3 MB. Scanned PDFs without selectable text need a clear JPG/PNG instead.

## If AI Studio imported only the frontend

Tell the AI Studio agent:

> Keep PaperCue's premium React interface but restore a real server-side Node API. Ensure GET /api/health and POST /api/analyze return JSON and are not caught by a frontend HTML fallback. Use GROQ_API_KEY from Settings > Secrets, never in the browser. Preserve document validations and Groq qwen/qwen3.8-27b vision support. If you convert the app to React/Vite, implement equivalent server endpoints rather than assuming Next.js routes exist. Don't generate fake analysis when an API call fails. Verify GET /api/health and a live test request.

## Troubleshooting

| Error | Meaning |
| --- | --- |
| `/api/health` returns HTML/404 | Backend missing or frontend-only import |
| `configured: false` | `GROQ_API_KEY` absent from running server |
| `GROQ_INVALID_KEY` | Invalid or revoked Groq key |
| `GROQ_MODEL_UNAVAILABLE` | Model missing or blocked by account access |
| `GROQ_RATE_LIMIT` | Groq quota or rate limit |
| `GROQ_BAD_REQUEST` | Invalid input for Groq |
| PDF says no selectable text | Scanned PDF: upload JPG/PNG |
| File too large | Reduce to 3 MB or less |

## Before hackathon submission

`npm install && npm test && npm run lint && npm run build`

Then run an actual scan. Unit tests or healthy `/api/health` alone do **not** prove real Groq API connectivity.