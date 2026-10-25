'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2,
  ChevronDown, ClipboardCopy, Clock3, Download, FileCheck2, FileText,
  Info, ListChecks, ShieldCheck,
} from 'lucide-react';
import { AnalysisSchema, type Analysis } from '@/lib/types';
import { calendarContent } from '@/lib/ics';

type SavedResult = { analysis: Analysis; sample: boolean; createdAt: number };

function dateLabel(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Not mentioned';
  const d = new Date(value + 'T12:00:00Z');
  return Number.isNaN(d.getTime()) ? 'Check original notice' : d.toLocaleDateString('en-IN', { day:'numeric',month:'short',year:'numeric',timeZone:'UTC' });
}

function download(data:string,name:string,mime:string) {
  const link=document.createElement('a');
  const url=URL.createObjectURL(new Blob([data],{type:mime}));
  link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1200);
}

export default function ResultsPage() {
  const [saved,setSaved]=useState<SavedResult|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [checked,setChecked]=useState<number[]>([]);
  const [flash,setFlash]=useState('');
  useEffect(()=>{
    try {
      const raw=sessionStorage.getItem('papercue-result-v1');
      if(raw){
        const parsed=JSON.parse(raw) as Partial<SavedResult>;
        const validation=AnalysisSchema.safeParse(parsed.analysis);
        if(validation.success) setSaved({analysis:validation.data,sample:parsed.sample===true,createdAt:typeof parsed.createdAt==='number'?parsed.createdAt:Date.now()});
      }
      const done=sessionStorage.getItem('papercue-done-v1');
      if(done) {
        const arr=JSON.parse(done) as unknown;
        if(Array.isArray(arr))setChecked(arr.filter((v):v is number=>Number.isInteger(v)&&v>=0&&v<12));
      }
    } catch { /* Browser storage may be unavailable. */ }
    setLoaded(true);
  },[]);
  const a=saved?.analysis;
  const tasks=a?.items||[];
  const done=checked.filter(i=>i<tasks.length);
  const progress=tasks.length?Math.round(done.length/tasks.length*100):0;
  const extraReview=a?(a.items.filter(i=>i.evidenceStatus!=='matched').length+(a.deadline&&a.deadlineEvidenceStatus!=='matched'?1:0)+a.missingInformation.length):0;
  function toggle(index:number) {
    const next=checked.includes(index)?checked.filter(i=>i!==index):[...checked,index];
    setChecked(next);
    try{sessionStorage.setItem('papercue-done-v1',JSON.stringify(next));}catch{}
  }
  function plan() {
    if(!a)return '';
    return [
      'PAPERCUE ACTION PLAN',a.documentTitle,
      a.issuer?'Issued by: '+a.issuer:'',
      a.summary,'Important date: '+dateLabel(a.deadline),
      'NEXT STEPS',
      ...a.items.map((it,i)=>(checked.includes(i)?'[x] ':'[ ] ')+it.title+'\n'+it.description+(it.dueDate?'\nDue: '+dateLabel(it.dueDate):'')+'\nSource: '+(it.evidence||'Not provided')),
      'MISSING OR UNCLEAR',...a.missingInformation.map(x=>'- '+x),
      'NOTES',...a.cautions.map(x=>'- '+x),
      'Always confirm details with the original notice.'
    ].filter(Boolean).join('\n\n');
  }
  function copy() {
    if(!a)return;
    void navigator.clipboard.writeText(plan()).then(()=>{setFlash('Action plan copied to clipboard.');}).catch(()=>setFlash('Copy not available. Please download your plan.'));
  }
  if(!loaded)return <div className="report-page"><div className="report-empty"><p>Preparing your results…</p></div></div>;
  if(!a)return <div className="report-page"><header className="report-nav"><div className="report-nav-inner"><Link className="report-brand" href="/"><span><FileCheck2 size={19}/></span>papercue.</Link></div></header><main className="report-empty"><FileText size={35} color="#4a8b6a"/><h1>No result in this tab yet.</h1><p>Upload a notice first. PaperCue keeps your action plan only in this browser tab, not in a saved account.</p><Link className="report-back" href="/"><ArrowLeft size={17}/> Analyze a notice</Link></main></div>;
  const ics=calendarContent(a);
  return <div className="report-page">
    <header className="report-nav"><div className="report-nav-inner">
      <Link className="report-brand" href="/"><span><FileCheck2 size={20}/></span>papercue.</Link>
      <Link className="report-back" href="/"><ArrowLeft size={16}/> New analysis</Link>
    </div></header>
    <main className="report-container">
      {saved?.sample&&<div className="report-sample">Sample preview — fictional school notice. These are not real deadlines or requirements.</div>}
      <section className="report-hero" aria-labelledby="report-title">
        <div>
          <div className="report-eyebrow"><CheckCircle2 size={16}/> YOUR NOTICE, ORGANIZED</div>
          <h1 id="report-title">{a.documentTitle||'Your action plan'}</h1>
          {a.issuer&&<div className="report-subline">{a.issuer} · {a.documentLanguage}</div>}
          <p>{a.summary}</p>
        </div>
        <div className="report-actions" aria-label="Export your plan">
          <button className="report-main-button" onClick={()=>download(plan(),'papercue-action-plan.txt','text/plain;charset=utf-8')}><Download size={16}/> Download plan</button>
          <button onClick={copy}><ClipboardCopy size={16}/> Copy plan</button>
          <button disabled={!ics} onClick={()=>{if(ics)download(ics,'papercue-dates.ics','text/calendar;charset=utf-8');}}><CalendarDays size={16}/> Calendar</button>
        </div>
      </section>
      {flash&&<div role="status" className="report-flash">{flash}</div>}
      <section className="report-metrics" aria-label="Important notice details">
        <div className="metric-tile date-focus"><div className="metric-title"><CalendarDays size={17}/> Important date</div><div className="metric-value">{dateLabel(a.deadline)}</div><div className="metric-caption">{a.deadline?'Confirm the date with the original notice':'No explicit complete date found'}</div></div>
        <div className="metric-tile"><div className="metric-title"><ListChecks size={17}/> Actions to take</div><div className="metric-value">{tasks.length} steps</div><div className="metric-caption">{done.length} completed in this session</div></div>
        <div className="metric-tile"><div className="metric-title"><ShieldCheck size={17}/> Worth checking</div><div className="metric-value">{extraReview} {extraReview===1?'detail':'details'}</div><div className="metric-caption">Missing info or quotes needing review</div></div>
      </section>
      <div className="report-grid">
        <div>
          <section className="report-panel" aria-labelledby="tasks-title">
            <div className="report-section-heading"><h2 id="tasks-title">Your next steps</h2><small>{done.length} of {tasks.length} done</small></div>
            <div className="report-progress-track" role="progressbar" aria-label="Completed steps" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{width:progress+'%'}}/></div>
            {!tasks.length&&<p className="report-note">No explicit tasks were found. Check your notice for any instructions that may have been missed.</p>}
            {tasks.map((it,i)=><article key={i} className={'report-task'+(done.includes(i)?' done':'')}>
              <button className="report-checkbox" type="button" aria-pressed={done.includes(i)} aria-label={(done.includes(i)?'Mark incomplete: ':'Mark complete: ')+it.title} onClick={()=>toggle(i)}>{done.includes(i)&&<Check size={16}/>}</button>
              <div className="report-task-main">
                <div className="report-task-title">{it.title}</div>
                {it.description&&<p className="report-task-desc">{it.description}</p>}
                <div className="report-task-meta">
                  {it.priority==='high'&&<span className="report-chip urgent">Important</span>}
                  {it.required&&<span className="report-chip">Required</span>}
                  {it.dueDate&&<span className="report-chip">{dateLabel(it.dueDate)}</span>}
                </div>
                <details className="report-evidence"><summary><FileText size={14}/> {it.evidenceStatus==='matched'?'View notice excerpt':'Review this against the notice'} <ChevronDown size={14}/></summary>
                  {it.evidence?<blockquote>“{it.evidence}”</blockquote>:<p>No supporting quote found.</p>}
                  <p>{it.evidenceStatus==='matched'?'Quote found in extracted text. Check that the meaning is accurate.':'Text is not independently matched. Please check the original notice.'}</p>
                </details>
              </div>
            </article>)}
          </section>
          <section className="report-panel"><div className="report-section-heading"><h2>Source details</h2><FileText size={18} color="#6c8f74"/></div>
            <p className="report-note">Key wording from your notice, shown so you can compare the interpretation with the original document.</p>
            {a.deadlineEvidence?<><div className="report-eyebrow"><Clock3 size={14}/> Deadline source</div><div className="report-quote">“{a.deadlineEvidence}”</div><p className="report-note">{a.deadlineEvidenceStatus==='matched'?'Matching text was found. Date interpretation still needs checking.':'This quote needs manual review.'}</p></>:<p className="report-note">No exact deadline source quote was available.</p>}
          </section>
        </div>
        <aside>
          <section className="report-panel"><div className="report-section-heading"><h2>Missing or unclear</h2><Info size={18} color="#a98250"/></div>
            {a.missingInformation.length?<ul className="report-points">{a.missingInformation.map((x,i)=><li key={i}>{x}</li>)}</ul>:<p className="report-note">No additional missing details were flagged. Review the notice yourself to be sure.</p>}
          </section>
          {a.cautions.length>0&&<section className="report-panel"><div className="report-section-heading"><h2>Things to keep in mind</h2><AlertCircle size={18} color="#9f8251"/></div><ul className="report-points">{a.cautions.map((x,i)=><li key={i}>{x}</li>)}</ul></section>}
          <div className="report-warning"><ShieldCheck size={19}/><span>PaperCue helps organize information; it does not confirm eligibility, official deadlines or application status. Double-check with the issuing school or organization.</span></div>
          <div className="report-row-divider"/>
          <Link className="report-back" href="/">Have another notice? <ArrowRight size={15}/></Link>
        </aside>
      </div>
    </main>
    <footer className="report-footer">PaperCue · Your plan is kept temporarily in this browser tab.</footer>
  </div>;
}
