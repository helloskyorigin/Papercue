# PaperCue AI — NextSpark Hacks 2026 submission

## Project title
PaperCue AI

## Tagline
Every notice. A clear next step.

## Live demo
https://papercue.ai.studio/

## Public source
https://github.com/helloskyorigin/Papercue

## Inspiration / problem
A school notice might contain a scholarship deadline, a list of documents, or an important admission instruction. Yet for students and families, those details are often buried in long screenshots, PDFs, crowded announcements and unfamiliar language. Missing one line can mean missing an opportunity. PaperCue was built to help students move from “What does this notice say?” to “What should I do next?”

## What it does
PaperCue turns a school, exam, scholarship or admission notice into a structured action plan. Students can upload a clear JPG/PNG/WEBP image or a text-based PDF, or paste notice text. The app identifies the key deadline (only when supported by the source), action steps, supporting excerpts and anything missing or unclear. Students can tick off the steps, copy or download a checklist, and export supported dates to a calendar file.

Instead of confidently inventing details, PaperCue uses a separate image check to reject unrelated or unreadable photos. Cropped or incomplete notices can produce a partial plan with clear warnings if enough actual instructions are readable; otherwise the app asks for a better upload. Every result asks the student to verify important details against the original issuing institution.

## How I built it
I built PaperCue with Next.js, TypeScript, React and CSS. Its server-side routes call the Groq API, using a vision-capable Qwen model for image inspection and text extraction. Text-based PDFs are parsed server-side. Strict schema validation, verbatim evidence matching, conservative date handling, file-signature checks and upload limits help reduce misleading results. The results page presents the first next step, a checklist, important dates and unclear information. GitHub Actions runs tests, TypeScript validation, a production build and HTTP smoke checks.

## Challenges
The hardest challenge was preventing an ordinary photograph or unreadable image from being treated like a real school notice. Another challenge was making partial input useful without pretending missing information was known. I improved this by separating image inspection from action extraction and refusing unsupported checklists. I also simplified navigation so the plan opens on its own page after scanning.

## What I learned
Useful AI experiences need clear boundaries. A quick answer is less valuable if it invents a deadline or requirement. Building PaperCue taught me to make uncertainty visible, keep sensitive API keys server-side, and focus the UI on what students need to do next.

## What's next
Improve multilingual evaluation with real permissioned school-notice examples, add better scanned-PDF support, improve accessibility and consider opt-in reminders. These are future ideas, not current features.

## Built with
Next.js, React, TypeScript, CSS, Groq API, Qwen vision-language model, pdf-parse, Zod, Lucide, GitHub, GitHub Actions and Google AI Studio (deployment/testing).

## AI tool disclosure
I used ChatGPT as an AI-assisted development collaborator for planning, implementation, debugging and test-writing. Groq-hosted AI performs document interpretation at runtime. I reviewed and iterated on the application and its user flows. Fictional sample notices are labeled as demonstrations. I do not claim official verification, perfect image recognition, automatic reminders or automatic application submission.

## Remaining submission attachments (required)
- [ ] 1–3 minute video of the **real, live working website** (publicly accessible YouTube/unlisted or other Devpost-compatible link).
- [ ] At least one screenshot captured from the live PaperCue website, ideally the standalone results page. Do not use an AI-generated mockup as an actual screenshot.
- [ ] Test one clear valid notice, one unrelated photo and one cropped notice; if any behavior differs from the description, explain the limitation in the submission.
- [ ] On Devpost, explicitly enter this live URL, repo, video, screenshots and tool credits before the deadline: 27 Oct 2026, 08:30 IST.

## Demo recording (approximately 2 minutes)
0:00–0:15: “School notices contain important deadlines, but it is easy to miss the action hidden in long text.”
0:15–0:30: Open papercue.ai.studio. Show the upload and paste options.
0:30–0:55: Upload a fictional notice with visible instructions and run a **real scan**.
0:55–1:20: Show the standalone result page: deadline, first action, checklist, and a quote from the notice.
1:20–1:35: Check a task, then download the checklist or calendar file.
1:35–1:50: Upload a non-notice photo to demonstrate the rejection if it works in the live app.
1:50–2:05: “PaperCue does not assume missing details. It tells students what to review. Every notice, a clear next step.”

## Eligibility and originality
The project was developed during the NextSpark Hacks submission window. Clearly disclose external libraries, AI contributions, and the actual implemented features. The developer submits as an eligible student, not as a company. Do not include private API keys or sensitive documents.
