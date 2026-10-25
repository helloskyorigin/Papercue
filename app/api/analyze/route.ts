import { NextRequest, NextResponse } from 'next/server';
import { AnalysisSchema } from '@/lib/types';
import { groqFailure, hasConfiguredKey } from '@/lib/diagnostics.mjs';
import { safeOutput } from '@/lib/analysis.mjs';
import { makeGroqRequest, fileSignatureMatches, GROQ_ENDPOINT, DEFAULT_GROQ_MODEL, MAX_UPLOAD_BYTES, MAX_SOURCE_CHARS, resolveSupportedMime } from '@/lib/groq.mjs';

export const runtime = 'nodejs';
export const maxDuration = 60;
const MIME = new Set(['application/pdf','image/png','image/jpeg','image/webp']);
const RECENT = new Map<string,{at:number;count:number}>();
const MAX_FORM_BYTES = MAX_UPLOAD_BYTES + 200_000;
const fail = (error:string,status:number,code='ANALYSIS_ERROR') => NextResponse.json({error,code},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

/** Parse selectable-text PDFs locally; scanned PDFs should be sent as photos. */
async function pdfText(bytes:Buffer) {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({data:new Uint8Array(bytes)});
  try {
    const result = await parser.getText({first:1,last:10});
    return String(result.text || '').trim().slice(0, MAX_SOURCE_CHARS);
  } finally { await parser.destroy(); }
}

export async function POST(req:NextRequest) {
  try {
    if (!hasConfiguredKey(process.env.GROQ_API_KEY)) {
      return fail('Groq API key is missing. Open AI Studio Settings > Secrets, add GROQ_API_KEY, then restart the app.',503,'GROQ_NOT_CONFIGURED');
    }
    if (Number(req.headers.get('content-length') || 0) > MAX_FORM_BYTES) {
      return fail('File exceeds the 3 MB upload limit.',413);
    }
    // Per-function best-effort protection. Set a shared rate limiter before public traffic.
    const ip = (req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const now = Date.now();
    const prev=RECENT.get(ip);
    if (prev && now-prev.at<60_000 && prev.count>=4) return fail('Too many scans. Please try again in a minute.',429);
    RECENT.set(ip,prev && now-prev.at<60_000 ? {...prev,count:prev.count+1}:{at:now,count:1});
    if(RECENT.size>2500) for (const [k,v] of RECENT) if(now-v.at>120_000) RECENT.delete(k);

    const form = await req.formData();
    const source = form.get('text');
    const file = form.get('file');
    if (source !== null && typeof source !== 'string') return fail('Invalid notice text.',400);
    if (file !== null && !(file instanceof File)) return fail('Invalid uploaded file.',400);
    const pasted = typeof source==='string' ? source.trim() : '';
    if (pasted && file) return fail('Choose pasted text OR a file.',400);
    if (pasted.length > MAX_SOURCE_CHARS) return fail('Text is too long (18,000 character maximum).',413);
    if (!file && pasted.length < 35) return fail('Upload a notice or paste at least 35 characters.',400);

    let text = pasted;
    let image:string | undefined;
    let mime:string | undefined;
    let mode:'text'|'file'=file?'file':'text';
    if (file) {
      mime = resolveSupportedMime(file.type,file.name) || undefined;
      if (!mime || !MIME.has(mime)) return fail('Supported files: PDF, PNG, JPG, WEBP. HEIC photos should be converted to JPG first.',415);
      if (!file.size || file.size>MAX_UPLOAD_BYTES) return fail('File must be no more than 3 MB.',413);
      const bytes=Buffer.from(await file.arrayBuffer());
      if (!fileSignatureMatches(bytes,mime)) return fail('File extension/type does not match its actual contents.',415);
      if(mime==='application/pdf') {
        try { text=await pdfText(bytes); }
        catch { return fail('This PDF could not be read. Try a selectable-text PDF or upload a clear JPG/PNG screenshot instead.',422); }
        if(text.length<35) return fail('This PDF has no readable/selectable text. Upload a screenshot of the notice instead.',422);
      } else image=bytes.toString('base64');
    }
    const model=process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
    const payload=makeGroqRequest({text,image,mime,model});
    const controller=new AbortController();
    const stop=setTimeout(()=>controller.abort(),42_000);
    let upstream:Response;
    try {
      upstream=await fetch(GROQ_ENDPOINT,{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.GROQ_API_KEY}`},
        body:JSON.stringify(payload),signal:controller.signal,cache:'no-store',
      });
    } catch(e) { return fail(e instanceof Error && e.name==='AbortError'?'Groq timed out; try a smaller notice.':'Groq could not be reached. Check network access or try again.',504,'GROQ_NETWORK'); }
    finally {clearTimeout(stop);}
    if(!upstream.ok) {
      let upstreamMessage='';
      try {
        const problem: {error?: {message?: string}} = await upstream.json();
        upstreamMessage = problem.error?.message || '';
      } catch { /* No safe error details available. */ }
      const detail = groqFailure(upstream.status, upstreamMessage);
      return fail(detail.error,detail.status,detail.code);
    }
    let response: {choices?:Array<{message?:{content?:string|null}}>};
    try {response=await upstream.json();} catch {return fail('AI returned an unreadable response.',502);}
    const generated=response.choices?.[0]?.message?.content;
    if(!generated || generated.length>40_000) return fail('AI could not read this notice. Try a sharper image or shorter text.',422);
    let parsed:unknown;
    try {parsed=JSON.parse(generated);} catch {return fail('AI returned incomplete JSON. Try a smaller notice or clearer image.',502,'GROQ_RESPONSE_INVALID');}
    if(!parsed || typeof parsed!=='object' || Array.isArray(parsed)) return fail('AI returned an invalid result. Please retry.',502);
    const cleaned=safeOutput(parsed as Record<string,unknown>,text);
    const validated=AnalysisSchema.safeParse(cleaned);
    if(!validated.success) return fail('AI could not structure this notice reliably; please retry.',502);
    return NextResponse.json({analysis:validated.data},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  } catch(e) {
    if(e instanceof TypeError || e instanceof SyntaxError) return fail('Invalid document submission.',400);
    return fail('Could not process the notice. Please retry.',500);
  }
}
