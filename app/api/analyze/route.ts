import {NextRequest,NextResponse} from 'next/server';
import {AnalysisSchema} from '@/lib/types';
import {groqFailure,hasConfiguredKey} from '@/lib/diagnostics.mjs';
import {safeOutput} from '@/lib/analysis.mjs';
import {inspectVision,verifyExtractedNotice} from '@/lib/notice-validation.mjs';
import {makeGroqRequest,makeVisionInspectionRequest,fileSignatureMatches,GROQ_ENDPOINT,DEFAULT_GROQ_MODEL,MAX_UPLOAD_BYTES,MAX_SOURCE_CHARS,resolveSupportedMime} from '@/lib/groq.mjs';

export const runtime='nodejs';
export const maxDuration=60;
const MIME=new Set(['application/pdf','image/png','image/jpeg','image/webp']);
const RECENT=new Map<string,{at:number;count:number}>();
const MAX_FORM_BYTES=MAX_UPLOAD_BYTES+200_000;
const fail=(error:string,status:number,code='ANALYSIS_ERROR')=>NextResponse.json({error,code},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

async function pdfText(bytes:Buffer) {
  const {PDFParse}=await import('pdf-parse');
  const parser=new PDFParse({data:new Uint8Array(bytes)});
  try {
    const result=await parser.getText({first:1,last:10});
    return String(result.text||'').trim().slice(0,MAX_SOURCE_CHARS);
  } finally {await parser.destroy();}
}

type ModelReply={ok:true;data:Record<string,unknown>}|{ok:false;status:number;code:string;error:string};
async function callGroq(payload:unknown,key:string,signal:AbortSignal):Promise<ModelReply>{
  let response:Response;
  try{
    response=await fetch(GROQ_ENDPOINT,{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
      body:JSON.stringify(payload),cache:'no-store',signal
    });
  }catch(err){
    return {ok:false,status:504,code:'AI_TIMEOUT',error:err instanceof Error&&err.name==='AbortError'
      ? 'The notice scan took too long. Try a smaller, clearer image.'
      : 'The analysis service could not be reached. Please retry.'};
  }
  if(!response.ok){
    let detail='';
    try{const data:{error?:{message?:string}}=await response.json();detail=data.error?.message||'';}catch{}
    const problem=groqFailure(response.status,detail);
    return {ok:false,...problem};
  }
  let data:{choices?:Array<{message?:{content?:string|null}}>};
  try{data=await response.json();}catch{return {ok:false,status:502,code:'AI_RESPONSE',error:'The analysis service returned an unreadable response.'};}
  const content=data.choices?.[0]?.message?.content;
  if(!content||content.length>50_000)return {ok:false,status:422,code:'AI_EMPTY',error:'We could not read enough information. Try a clearer copy.'};
  try{
    const parsed:unknown=JSON.parse(content);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Wrong shape');
    return {ok:true,data:parsed as Record<string,unknown>};
  }catch{return {ok:false,status:502,code:'AI_RESPONSE',error:'The notice could not be interpreted reliably. Please retry with a clearer image.'};}
}

export async function POST(req:NextRequest) {
  try{
    const key=process.env.GROQ_API_KEY;
    if(!hasConfiguredKey(key))return fail('Analysis is not configured. Please contact the app owner.',503,'AI_NOT_CONFIGURED');
    if(Number(req.headers.get('content-length')||0)>MAX_FORM_BYTES)return fail('File exceeds the 3 MB upload limit.',413,'FILE_TOO_LARGE');

    const ip=(req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
    const now=Date.now();const prev=RECENT.get(ip);
    if(prev&&now-prev.at<60_000&&prev.count>=4)return fail('Too many scans. Please try again in a minute.',429,'RATE_LIMIT');
    RECENT.set(ip,prev&&now-prev.at<60_000?{at:prev.at,count:prev.count+1}:{at:now,count:1});
    if(RECENT.size>2500)for(const [k,v] of RECENT)if(now-v.at>120_000)RECENT.delete(k);

    const form=await req.formData();
    const source=form.get('text');const file=form.get('file');
    if(source!==null&&typeof source!=='string')return fail('Invalid notice text.',400);
    if(file!==null&&!(file instanceof File))return fail('Invalid uploaded file.',400);
    const pasted=typeof source==='string'?source.trim():'';
    if(pasted&&file)return fail('Choose either pasted text or one file.',400);
    if(pasted.length>MAX_SOURCE_CHARS)return fail('Maximum text length is 18,000 characters.',413,'TEXT_TOO_LONG');
    if(!file&&pasted.length<35)return fail('Paste at least 35 characters of notice text or upload a readable notice.',400,'SOURCE_TOO_SHORT');

    let text=pasted;
    let image:string|undefined;let mime:string|undefined;
    let partial=false;let missing:string[]=[];
    if(file){
      mime=resolveSupportedMime(file.type,file.name)||undefined;
      if(!mime||!MIME.has(mime))return fail('Supported formats: PDF, JPG, PNG and WEBP.',415,'BAD_FILE_TYPE');
      if(!file.size||file.size>MAX_UPLOAD_BYTES)return fail('File must be no larger than 3 MB.',413,'FILE_TOO_LARGE');
      const bytes=Buffer.from(await file.arrayBuffer());
      if(!fileSignatureMatches(bytes,mime))return fail('The selected file is not a valid supported image or PDF.',415,'INVALID_FILE');
      if(mime==='application/pdf'){
        try{text=await pdfText(bytes);}catch{return fail('Cannot read this PDF. Upload a selectable-text PDF or a clear photo of the notice.',422,'PDF_UNREADABLE');}
        if(text.length<35)return fail('This PDF has no readable text. Please upload a clearer photo of the notice.',422,'PDF_UNREADABLE');
      }else image=bytes.toString('base64');
    }
    const model=process.env.GROQ_MODEL||DEFAULT_GROQ_MODEL;
    // A single total time budget covers both image inspection and subsequent extraction.
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),45_000);
    try{
      if(image&&mime){
        const inspected=await callGroq(makeVisionInspectionRequest({image,mime,model}),key!,controller.signal);
        if(!inspected.ok)return fail(inspected.error,inspected.status,inspected.code);
        const gate=inspectVision(inspected.data);
        if(!gate.ok)return fail(gate.error!,422,gate.code);
        text=gate.text!;
        partial=gate.partial===true;
        missing=gate.missing||[];
      }
      const answer=await callGroq(makeGroqRequest({text,image:undefined,mime:undefined,model}),key!,controller.signal);
      if(!answer.ok)return fail(answer.error,answer.status,answer.code);
      const cleaned=safeOutput(answer.data,text);
      const parsed=AnalysisSchema.safeParse(cleaned);
      if(!parsed.success)return fail('We could not create a reliable action plan from this notice.',422,'BAD_RESULT');
      const verified=verifyExtractedNotice(answer.data,parsed.data,{partial,missing});
      if(!verified.ok)return fail(verified.error!,422,verified.code);
      return NextResponse.json({analysis:verified.analysis},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }finally{clearTimeout(timer);}
  }catch(err){
    if(err instanceof TypeError||err instanceof SyntaxError)return fail('Invalid document submission.',400,'INVALID_REQUEST');
    return fail('Could not process this notice. Try again with a clearer copy.',500,'ANALYSIS_FAILED');
  }
}
