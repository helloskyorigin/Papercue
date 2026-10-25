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

const phases = ['Reading the notice', 'Finding dates & requirements', 'Checking supporting quotes', 'Preparing your plan'];

// Fictional sample. Deliberately never sent to the AI or presented as an actual scan.
const DEMO_TEXT = `BIRCHWOOD PUBLIC SCHOOL, PATNA\nStudent Scholarship Assistance — Notice\nDate of issue: 20 October 2026\nStudents of Classes 9 to 12 may apply for the school scholarship assistance programme.\nCompleted applications must be submitted to the school office by 28 October 2026.\nBring a copy of your last examination marksheet and a school identity card.\nApplicants should collect an application form from the administration office.\nIncomplete forms will not be considered.\nFor assistance, contact your class teacher.`;
const DEMO_RESULT: Analysis = {
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
  function demo() {
    if (loading) return;
    setMode('text'); setFile(null); setNoticeText(DEMO_TEXT); setResult(DEMO_RESULT);
    setIsDemo(true); setCompleted([]); setError(''); scrollToResult();
  }
  async function analyze() {
    if (loading) return;
    if (backendStatus === 'unconfigured') { setError(backendMessage); return; }
    if (backendStatus === 'offline') { setError('The backend API is unavailable. This import may be running frontend-only; ensure Next.js server routes run and open /api/health.'); return; }
    if (mode === 'text' && noticeText.trim().length < 35) { setError('Paste at least 35 characters from your notice.'); return; }
    if (mode === 'file' && !file) { setError('Choose a notice file first.'); return; }
    clearResult(); setLoading(true); setPhase(0);
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
      setResult(body.analysis); setIsDemo(false); scrollToResult();
    } catch (err) {
      setError(err instanceof Error && err.name === 'AbortError' ? 'Analysis timed out. Try a smaller notice.' : err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
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
      <section className="hero wrap" aria-labelledby="hero-title">
        <div className="hero-content"><div className="eyebrow"><span className="eyebrow-dot"/> YOUR NOTICE, SIMPLIFIED <span className="eyebrow-arrow">↗</span></div>
          <h1 id="hero-title">Never miss what <em>matters</em> in a notice.</h1>
          <p>Upload a scholarship, admission or exam notice. Get the deadline, a clear checklist and the exact lines worth double-checking.</p>
          <div className="hero-meta"><span><CheckCircle2 size={16}/> No signup</span><span><CheckCircle2 size={16}/> Hindi & English</span><span><CheckCircle2 size={16}/> Source evidence</span></div>
        </div>
        <div className="hero-side" aria-label="PaperCue benefits"><div className="side-num">01 <span>/ 03</span></div><p>Less reading.<br/><strong>More doing.</strong></p><span>Built for the important little details.</span><div className="side-star" aria-hidden="true">✳</div></div>
      </section>

      <section id="workspace" className="workspace-section wrap" aria-label="Analyze your notice">
        <div className="workspace-heading"><div><span className="section-label">YOUR WORKSPACE</span><h2>A clear plan starts here.</h2></div><button className="sample-button" onClick={demo} disabled={loading}><Sparkles size={16}/> Explore with a sample <ArrowRight size={16}/></button></div>
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
            <div className="input-actions"><div className={`connection-status connection-${backendStatus}`} role="status" aria-live="polite"><span className="connection-dot"/><span><strong>{backendStatus==='ready'?'Groq verified':backendStatus==='checking'?'Checking AI connection':backendStatus==='unconfigured'?'AI configuration needed':backendStatus==='unverified'?'Groq verification unavailable':'Backend not connected'}</strong><small>{backendMessage}</small></span><button type="button" disabled={checkingHealth} onClick={()=>void checkConnection()} aria-label="Recheck AI connection" title="Recheck connection"><RotateCcw size={16}/></button></div>{error && <div className="error-message" role="alert"><Info size={17}/><span>{error}</span></div>}<button className="primary-button" disabled={loading || !canAnalyze || backendStatus==='checking'} onClick={analyze}>{loading?<><LoaderCircle className="spin" size={18}/> Analyzing notice…</>:<>Create my action plan <ArrowRight size={18}/></>}</button><p className="fineprint"><LockKeyhole size={14}/> No account needed. Your notice is sent to Groq AI for analysis—avoid personal IDs or sensitive information.</p></div>
          </div>
          <div className="panel result-panel" ref={resultsRef} aria-live="polite"><div className="panel-title"><span className="panel-index">02</span><div><h3>Your action plan</h3><p>Deadlines, tasks and supporting evidence.</p></div>{result && <span className={`status-badge ${isDemo?'demo-badge':''}`}>{isDemo?'Sample data':'Ready to review'}</span>}</div>
            {loading ? <div className="loading-state"><div className="loading-emblem"><Sparkles size={29}/></div><h4>{phases[phase]}</h4><p>We’re turning your notice into a practical checklist.</p><div className="loading-track"><span key={phase}/></div><small>Please keep this tab open</small></div>
              : !result ? <div className="empty-state"><div className="empty-preview"><div className="paper-lines"><span/><span/><span/></div><div className="check-float"><Check size={22}/></div></div><span className="empty-kicker">A LITTLE MORE CLARITY</span><h4>From document to done.</h4><p>Your results will appear here after analysis. Or explore a clearly labeled sample first.</p><button type="button" className="empty-link" onClick={demo}>See an example <ArrowRight size={16}/></button></div>
              : <div className="results">
                <div className="result-document"><span className="result-doc-icon"><FileText size={21}/></span><div><span>DOCUMENT SUMMARY</span><h4>{result.documentTitle}</h4>{result.issuer && <small>{result.issuer}</small>}</div></div>
                <p className="result-summary">{result.summary}</p>
                <div className={`deadline-box ${result.deadline?'':'deadline-unknown'}`}><div><span className="deadline-kicker"><CalendarDays size={16}/> IMPORTANT DATE</span><strong>{dateLabel(result.deadline)}</strong><small>{!result.deadline?'No confirmed deadline extracted':result.deadlineEvidenceStatus==='matched'?'Supporting quote found — verify the date':'Date needs manual verification'}</small></div>{result.deadline && <button type="button" onClick={exportCalendar} title="Save deadlines to calendar" aria-label="Download calendar file"><Download size={18}/></button>}</div>
                {result.deadlineEvidence && <details className="deadline-evidence"><summary><ShieldCheck size={15}/> Read deadline source quote <ChevronDown size={14}/></summary><p>“{result.deadlineEvidence}”</p></details>}
                <div className="checklist-header"><h4>Next steps <span>{total}</span></h4><span>{completed.length}/{total} done</span></div><div className="completion-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Checklist completion"><span style={{width:`${progress}%`}}/></div>
                {total ? <div className="tasks">{result.items.map((item,index)=>{const checked=completed.includes(index); return <div className={`task ${checked?'task-done':''}`} key={index}><button type="button" className="task-check" aria-label={`${checked?'Mark unfinished':'Mark completed'}: ${item.title}`} aria-pressed={checked} onClick={()=>setCompleted(old=>checked?old.filter(x=>x!==index):[...old,index])}>{checked?<Check size={16}/>:null}</button><div className="task-body"><div className="task-head"><strong>{item.title}</strong>{item.dueDate && <span className="task-date"><Clock3 size={12}/>{dateLabel(item.dueDate)}</span>}</div>{item.description && <p>{item.description}</p>}<details className="evidence"><summary><ShieldCheck size={14}/>{item.evidenceStatus==='matched'?'Quote found in source':'Review source manually'}<ChevronDown size={14}/></summary><div>“{item.evidence || 'No supporting quote supplied.'}”<small>A matching quote does not guarantee the interpretation is correct.</small></div></details></div></div>;})}</div> : <p className="empty-steps">No explicit action steps found. Check the notice manually.</p>}
                {result.missingInformation.length>0 && <div className="attention-box"><strong><Info size={16}/> Missing or unclear</strong><ul>{result.missingInformation.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
                {result.cautions.length>0 && <div className="caution-box">{result.cautions.map((x,i)=><p key={i}><Info size={14}/>{x}</p>)}</div>}
                <div className="result-actions"><button onClick={exportChecklist}><Download size={17}/> Download plan</button><button onClick={copyPlan}>{copied?<Check size={17}/>:<ClipboardCopy size={17}/>} {copied?'Copied!':'Copy'}</button>{result.deadline && <button onClick={exportCalendar}><CalendarDays size={17}/> Calendar</button>}</div>
                <details className="original-source" open={isDemo}><summary><FileText size={17}/> Review original notice <ChevronDown size={16}/></summary>{mode==='text'?<pre>{noticeText}</pre>:previewUrl && file?.type==='application/pdf'?<iframe src={previewUrl} title="Original uploaded notice"/>:previewUrl?<img src={previewUrl} alt="Original uploaded notice"/>:<p>Source preview not available.</p>}</details>
                <p className="results-disclaimer"><ShieldCheck size={15}/> Always confirm dates, eligibility and required documents with the official issuer before acting.</p>
              </div>}
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
