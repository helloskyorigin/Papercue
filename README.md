# PaperCue AI

**Every notice. A clear next step.** A student-friendly, evidence-aware AI tool that turns complicated school, scholarship, admission and exam notices into reviewable tasks, dates and a checklist.

**Live:** https://papercue.ai.studio/ · **Hackathon submission draft:** [HACKATHON_SUBMISSION.md](./HACKATHON_SUBMISSION.md)

## Features

- Responsive upload → scan → separate results page: upload PDF/PNG/JPG/WEBP (3 MB max) or paste up to 18,000 characters of text.
- Real analysis is powered by **Groq** (not Gemini). Supports Hindi and English, though accuracy depends on legibility and model behavior.
- Clear deadline status: unspecified dates are not invented. Each action displays the model's supporting quote with an evidence confidence label.
- Complete actions interactively; download a plain-text checklist or `.ics` calendar file. No account, payment, form submission or automatic notifications.
- Clearly labeled **fictional sample** to demonstrate the UI without an API key. This is not a live scan.
- The results page shows matched source excerpts for human review. Always keep the original notice available to compare independently.

## Local development

```bash
npm install
cp .env.example .env.local
# Set GROQ_API_KEY in .env.local (server-side only)
npm run dev
npm test
npm run lint
npm run build
```

For Vercel, import `helloskyorigin/Papercue` as a Next.js project and configure `GROQ_API_KEY` in the appropriate environment. `GROQ_MODEL` can override the current Groq vision model. Never place the API key in a `NEXT_PUBLIC_` variable or commit it.

## Documents and evidence

- **Pasted text:** AI analysis with substring-matched evidence quotes. Quote matching verifies the quote appears in the original text, **not** that the interpretation is correct.
- **Text PDFs:** Server parses selectable text from the first 10 pages. Scanned PDFs are not OCR-supported; upload clear JPG/PNG screenshots of their pages instead.
- **Images:** A first Groq vision check screens for readable educational notices and transcribes visible text; a second model call extracts actions from that text. Unrelated/unreadable photos are rejected and incomplete notices warn about missing details. This screening can make mistakes and is **not** independently OCR-verified.
- The 3 MB file limit protects Vercel's request-size limit. Date normalization and schema validation are conservative.
- Text and files are sent to Groq for inference. No PaperCue document database is configured. Do not upload IDs or private records. Groq's retention policies are separate.
- In-memory rate limiting is best effort only; use a shared limiter before scaling public traffic.

## Hackathon submission checklist

- [ ] `npm test` and `npm run lint` and `npm run build` pass in GitHub Actions.
- [ ] Set `GROQ_API_KEY` securely in the deployed environment.
- [ ] Run actual scans using a real English notice, Hindi image, selectable-text PDF and a scanned-PDF error case.
- [ ] Test on narrow mobile screens and desktop, plus drag/drop and copy/export.
- [ ] Record a truthful demo video (sample mode explicitly labeled), then add the deployed URL, GitHub repository, screenshots and AI-tool disclosure to the competition submission.

## AI Studio import troubleshooting (important)

Google AI Studio Build defaults to React and supports a Node.js server, but import/remix must retain the actual server-side `/api/*` endpoints. **PaperCue requires a running backend plus the GROQ_API_KEY server secret**; the automatic Gemini key does not configure Groq.

- [AI Studio full setup and repair prompt](./AI_STUDIO_SETUP.md)
- Check GET `/api/health`: `configured: true` means backend and secret are visible (it **does not** call Groq).
- Only successful POST `/api/analyze` with a **real** notice proves live analysis.
- Missing key / wrong deployment / invalid model / rate limit now produce distinct user-visible errors. Never ship an API key to client code.
