'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCircle2, ChevronDown,
  ClipboardCopy, Clock3, Download, FileCheck2, FileText, Info, LoaderCircle,
  LockKeyhole, RotateCcw, ShieldCheck, Sparkles, UploadCloud, X,
} from 'lucide-react';
import type { Analysis } from '@/lib/types';
import { calendarContent } from '@/lib/ics';
import { resolveSupportedMime } from '@/lib/groq.mjs';

type Mode = 'file' | 'text';
type BackendStatus = 'checking' | 'ready' | 'unconfigured' | 'unverified' | 'offline';
const MAX_FILE_SIZE = 3 * 1024 * 1024;
const MAX_TEXT = 18000;

const phases = ['Checking the photo is a notice', 'Reading the instructions', 'Finding missing details', 'Preparing your next steps'];

// Fictional sample. Deliberately never sent to the AI or presented as an actual scan.
const DEMO_TEXT = `BIRCHWOOD PUBLIC SCHOOL, PATNA\nStudent Scholarship Assistance — Notice\nDate of issue: 20 October 2026\nStudents of Classes 9 to 12 may apply for the school scholarship assistance programme.\nCompleted applications must be submitted to the school office by 28 October 2026.\nBring a copy of your last examination marksheet and a school identity card.\nApplicants should collect an application form from the administration office.\nIncomplete forms will not be considered.\nFor assistance, contact your class teacher.`;
const DEMO_RESULT: Analysis = {
  sourceStatus: 'complete',
  documentTitle: 'Student Scholarship Assistance',
  documentLanguage: 'English', issuer: 'Birchwood Public School (fictional)',
  summary: 'Students in Classes 9–12 can apply for scholarship assistance. Collect the form, prepare documents, and submit it to the school office by the deadline.',
  deadline: '2026-10-28', deadlineEvidence: 'Completed applications must be submitted to the school office by 28 October 2026.', deadlineEvidenceStatus: 'matched',
  items: [
    { title: 'Collect the application form', description: 'Get the form from the administration office.', evidence: 'Applicants should collect an application form from the administration office.', evidenceStatus: 'matched', dueDate: null, required: true, priority: 'medium' },
    { title: 'Prepare the required documents', description: 'Bring a copy of your latest marksheet and your school ID.', evidence: 'Bring a copy of your last examination marksheet and a school identity card.', evidenceStatus: 'matched', dueDate: null, required: true, priority: 'high' },
    { title: 'Submit your completed application', description: 'Hand it in at the school office by the deadline.', evidence: 'Completed applications must be submitted to the school office by 28 October 2026.', evidenceStatus: 'matched', dueDate: '2026-10-28', required: true, priority: 'high' },
  ],
  missingInformation: ['The scholarship amount is not stated.', 'No application fee is specified.'],
  cautions: ['Fictional demonstration only. Do not use this as an official notice.'],
};

function dateLabel(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Not mentioned';
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? 'Check original notice' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function Brand() {
  return <a className="brand" href="#top" aria-label="PaperCue home"><span className="brand-symbol"><FileCheck2 size={21} strokeWidth={2.2}/></span><span>paper<span className="brand-strong">cue</span><span className="brand-dot">.</span></span></a>;
}
function saveFile(data: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link);
  link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [noticeText, setNoticeText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState('');
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [backendMessage, setBackendMessage] = useState('Checking the AI connection…');
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  async function checkConnection() {
    setCheckingHealth(true);
    try {
      const controller=new AbortController();
      const stop=window.setTimeout(()=>controller.abort(),8500);
      let response:Response;
      try {response=await fetch('/api/health',{cache:'no-store',signal:controller.signal});}
      finally {window.clearTimeout(stop);}
      const type=response.headers.get('content-type') || '';
      if (!response.ok || !type.includes('application/json')) throw new Error('Next.js backend unavailable. Deploy the full-stack app, not a static AI Studio preview.');
      const body:{backend?:string;configured?:boolean;checkStatus?:string;message?:string}=await response.json();
      if(body.backend!=='nextjs-node') throw new Error('Wrong backend detected. Check the Next.js server.');
      const status:BackendStatus = !body.configured || body.checkStatus==='invalid' || body.checkStatus==='model_missing' || body.checkStatus==='blocked'
        ? 'unconfigured' : body.checkStatus==='ready' ? 'ready' : 'unverified';
      setBackendStatus(status);
      setBackendMessage(body.message || 'Groq connection status unknown.');
    } catch (e) {
      setBackendStatus('offline');
      setBackendMessage(e instanceof Error ? e.message : 'Cannot contact the backend.');
    } finally {setCheckingHealth(false);}
  }
  useEffect(() => {void checkConnection();}, []);

  useEffect(() => {
    if (!file) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!loading) return;
    const interval = window.setInterval(() => setPhase(p => (p + 1) % phases.length), 1900);
    return () => window.clearInterval(interval);
  }, [loading]);
  const scrollToResult = () => window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 130);
  const clearResult = () => { setResult(null); setIsDemo(false); setCompleted([]); setError(''); setCopied(false); };
  const setTab = (next: Mode) => { if (loading) return; setMode(next); clearResult(); };

  function chooseFile(next?: File) {
    if (!next) return;
    if (!resolveSupportedMime(next.type,next.name) || !next.size || next.size > MAX_FILE_SIZE) {
      setFile(null); clearResult();
      setError('Unsupported file or too large. Choose one PDF, PNG, JPG or WEBP under 3 MB (convert HEIC to JPG).');
      return;
    }
    setMode('file'); setFile(next); setNoticeText(''); clearResult();
  }
  function onFileChange(e: ChangeEvent<HTMLInputElement>) { chooseFile(e.target.files?.[0]); e.target.value = ''; }
  function onDrop(e: DragEvent<HTMLLabelElement>) { e.preventDefault(); setDragOver(false); if (!loading) chooseFile(e.dataTransfer.files[0]); }
  function reset() { setFile(null); setNoticeText(''); clearResult(); if (fileInput.current) fileInput.current.value = ''; }
  function openResults(analysis: Analysis, sample = false) {
    try {
      sessionStorage.setItem('papercue-result-v1', JSON.stringify({ analysis, sample, createdAt: Date.now() }));
      sessionStorage.removeItem('papercue-done-v1');
      // Full navigation avoids transient Home flashes during client route transitions.
      // replace() also prevents browser Back from bouncing through the scan screen.
      window.location.replace('/results');
      return true;
    } catch {
      setError('Could not open your plan. Allow temporary browser storage and retry.');
      return false;
    }
  }
  function demo() {
    if (loading) return;
    if (openResults(DEMO_RESULT, true)) setLoading(true);
  }
  async function analyze() {
    if (loading) return;
    if (backendStatus === 'unconfigured') { setError('Notice scanning is temporarily unavailable. Please try again later.'); return; }
    if (backendStatus === 'offline') { setError('Notice scanning is temporarily unavailable. Please try again later.'); return; }
    if (mode === 'text' && noticeText.trim().length < 35) { setError('Paste at least 35 characters from your notice.'); return; }
    if (mode === 'file' && !file) { setError('Choose a notice file first.'); return; }
    clearResult(); setLoading(true); setPhase(0);
    let redirected = false;
    try {
      const form = new FormData();
      if (mode === 'file' && file) form.append('file', file);
      else form.append('text', noticeText.trim());
      const controller = new AbortController();
      const stop = window.setTimeout(() => controller.abort(), 52_000);
      let response: Response;
      try { response = await fetch('/api/analyze', { method: 'POST', body: form, cache: 'no-store', signal: controller.signal }); }
      finally { window.clearTimeout(stop); }
      const type = response.headers.get('content-type') || '';
      if (!type.includes('application/json')) { throw new Error('The AI backend returned a webpage instead of JSON. This often means AI Studio imported only the frontend: verify /api/analyze and /api/health in the server runtime.'); }
      const body: { analysis?: Analysis; error?: string; code?: string } = await response.json();
      if (!response.ok || !body.analysis) throw new Error(body.error || `AI request failed (${response.status}). Check server logs and Groq configuration.`);
      redirected = openResults(body.analysis);
    } catch (err) {
      setError(err instanceof Error && err.name === 'AbortError' ? 'Analysis timed out. Try a smaller notice.' : err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally { if (!redirected) setLoading(false); }
  }
  function planText() {
    if (!result) return '';
    return [result.documentTitle, result.summary, `Important deadline: ${dateLabel(result.deadline)}`, '', 'ACTION CHECKLIST',
      ...result.items.map((item, idx) => `${completed.includes(idx) ? '[x]' : '[ ]'} ${item.title}\n${item.description}\nSource quote (${item.evidenceStatus}): ${item.evidence || 'Not provided'}`),
      '', 'MISSING OR UNCLEAR', ...result.missingInformation.map(s => `- ${s}`), '', 'Important: Verify all details against the official notice.'].join('\n\n');
  }
  function exportChecklist() { if (result) saveFile(planText(), 'papercue-action-plan.txt', 'text/plain;charset=utf-8'); }
  function exportCalendar() {
    if (!result) return;
    const ics = calendarContent(result);
    if (ics) saveFile(ics, 'papercue-deadlines.ics', 'text/calendar;charset=utf-8');
  }
  async function copyPlan() {
    if (!result) return;
    try { await navigator.clipboard.writeText(planText()); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setError('Clipboard access is unavailable. Please use “Download plan” instead.'); }
  }
  const total = result?.items.length ?? 0;
  const progress = total ? Math.round(completed.length / total * 100) : 0;
  const canAnalyze = mode === 'file' ? !!file : noticeText.trim().length >= 35;

  return <div id="top" className="site">
    <header className="site-header"><div className="wrap header-inner"><Brand/><nav aria-label="Primary navigation"><a href="#how-it-works">How it works</a><a href="#privacy">Privacy</a></nav><a className="header-action" href="#workspace">Try for free <ArrowUpRight size={16}/></a></div></header>
    <main>
      {loading && <div className="scan-screen" role="status" aria-live="polite"><div className="scan-card"><div className="scan-mark"><FileText size={27}/></div><p className="scan-kicker">CHECKING YOUR NOTICE</p><h2>{phases[phase]}</h2><p>Checking readability and turning clear instructions into next steps.</p><div className="scan-bar"><span key={phase}/></div><small>Keep this tab open while your plan is prepared.</small></div></div>}
      <section className="hero wrap" aria-labelledby="hero-title">
        <div className="hero-content"><div className="eyebrow"><span className="eyebrow-dot"/> YOUR NOTICE, SIMPLIFIED <span className="eyebrow-arrow">↗</span></div>
          <h1 id="hero-title">Never miss what <em>matters</em> in a notice.</h1>
          <p>Upload a scholarship, admission or exam notice. Get a simple action plan with important dates, steps and supporting quotes.</p>
          <div className="hero-meta"><span><CheckCircle2 size={16}/> No signup</span><span><CheckCircle2 size={16}/> Hindi & English</span><span><CheckCircle2 size={16}/> Clear next steps</span></div>
        </div>
        <div className="hero-side" aria-label="PaperCue benefits"><div className="side-num">01 <span>/ 03</span></div><p>Less reading.<br/><strong>More doing.</strong></p><span>Built for the important little details.</span><div className="side-star" aria-hidden="true">✳</div></div>
      </section>

      <section id="workspace" className="workspace-section wrap" aria-label="Analyze your notice">
        <div className="workspace-heading"><div><span className="section-label">START HERE</span><h2>Start with your notice.</h2></div><button className="sample-button" onClick={demo} disabled={loading}><Sparkles size={16}/> Explore with a sample <ArrowRight size={16}/></button></div>
        <div className="workspace-grid">
          <div className="panel input-panel"><div className="panel-title"><span className="panel-index">01</span><div><h3>Add your notice</h3><p>Select a file or paste the notice text.</p></div></div>
            <div className="tabs" role="tablist" aria-label="Notice input method"><button type="button" role="tab" aria-selected={mode==='file'} className={mode==='file'?'active':''} onClick={()=>setTab('file')} disabled={loading}><UploadCloud size={17}/> Upload file</button><button type="button" role="tab" aria-selected={mode==='text'} className={mode==='text'?'active':''} onClick={()=>setTab('text')} disabled={loading}><FileText size={17}/> Paste text</button></div>
            {mode === 'file' ? <div className="input-area">
              <label htmlFor="notice-file" className={`upload-zone ${dragOver?'drag-over':''} ${file?'has-file':''}`} onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={onDrop}>
                <input ref={fileInput} id="notice-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" onChange={onFileChange} disabled={loading}/>
                <span className="upload-illustration"><UploadCloud size={28} strokeWidth={1.8}/></span>
                {file ? <><strong className="file-name">{file.name}</strong><span>{(file.size/1024/1024).toFixed(2)} MB · Click to replace</span></> : <><strong>Drop your notice here</strong><span>or <u>browse files</u> from your device</span></>}
                <small>PDF, PNG, JPG, WEBP · Up to 3 MB</small>
              </label>
              {file && previewUrl && resolveSupportedMime(file.type,file.name)?.startsWith('image/') && <img className="selected-image-preview" src={previewUrl} alt="Selected notice preview"/>}
      {file && <div className="selection-row"><span><FileCheck2 size={16}/> File ready for analysis</span><button type="button" onClick={reset} disabled={loading} aria-label="Remove file"><X size={17}/></button></div>}
            </div> : <div className="input-area"><label className="input-label" htmlFor="notice-text">Notice text</label><textarea id="notice-text" rows={9} placeholder="Paste the text of a school notice here…" maxLength={MAX_TEXT} value={noticeText} disabled={loading} onChange={e=>{setNoticeText(e.target.value); if(result) clearResult();}}/><div className="text-count">{noticeText.length.toLocaleString('en-IN')} / 18,000 characters</div></div>}
            <div className="input-actions">{error && <div className="error-message" role="alert"><Info size={17}/><span>{error}</span></div>}<button className="primary-button" disabled={loading || !canAnalyze || backendStatus==='checking'} onClick={analyze}>{loading?<><LoaderCircle className="spin" size={18}/> Analyzing notice…</>:<>Analyze notice <ArrowRight size={18}/></>}</button><p className="fineprint"><LockKeyhole size={14}/> No signup. Your notice is processed by an external AI service. Avoid IDs and sensitive records.</p></div>
          </div>

        </div>
      </section>
      <section id="how-it-works" className="how wrap"><div className="how-intro"><span className="section-label">HOW IT WORKS</span><h2>Three steps. <em>Less confusion.</em></h2></div><div className="how-grid"><div><span>01</span><h3>Add the notice</h3><p>Upload a clear photo, text-based PDF or paste the original text.</p></div><div><span>02</span><h3>Review what matters</h3><p>See deadlines, instructions and source quotes in one place.</p></div><div><span>03</span><h3>Get it done</h3><p>Tick off tasks, copy your plan or export calendar dates.</p></div></div></section>
      <section className="trust-section" id="privacy"><div className="wrap trust-inner"><div><span className="section-label light-label">BUILT WITH CARE</span><h2>Helpful AI.<br/><em>Human judgment.</em></h2></div><div className="trust-details"><p><ShieldCheck size={19}/> AI can misread a notice. Check important details against the original, even when a quote matches.</p><p><LockKeyhole size={19}/> No signup or document database. Uploaded content is processed by Groq; avoid sensitive personal records.</p><p><FileText size={19}/> Text-based PDFs work best. For scanned PDFs, upload clear images of the notice instead.</p></div></div></section>
      <section className="faq-section wrap"><div className="faq-title"><span className="section-label">GOOD TO KNOW</span><h2>Before you begin.</h2></div><div className="faq-list"><details><summary>Can PaperCue read Hindi notices? <ChevronDown size={18}/></summary><p>Yes, you can try Hindi text and images. Recognition quality varies, especially with blurry photos or complex layouts. Verify every important detail.</p></details><details><summary>Will PaperCue remind me automatically? <ChevronDown size={18}/></summary><p>No. You can download calendar events manually. This prototype does not send notifications or submit applications.</p></details><details><summary>What if the notice has no deadline? <ChevronDown size={18}/></summary><p>PaperCue marks the deadline as not mentioned instead of inventing one. Relative or ambiguous dates should be checked against the original.</p></details></div></section>
    </main>
    <footer className="footer"><div className="wrap footer-inner"><Brand/><span>Made to help students move forward.</span><small>© 2026 PaperCue · Independent student hackathon prototype</small></div></footer>
  </div>;
}
