import { NextResponse } from 'next/server';
import { hasConfiguredKey } from '@/lib/diagnostics.mjs';
import { probeGroq, DEFAULT_GROQ_MODEL } from '@/lib/groq.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Checks actual Groq key/model availability; never returns secrets or model details. */
export async function GET() {
  const key=process.env.GROQ_API_KEY;
  const configured=hasConfiguredKey(key);
  const result=configured
    ? await probeGroq({key,model:process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL})
    : {status:'missing',message:'GROQ_API_KEY is missing. Set it as a server-side Secret on the platform running this app.'};
  return NextResponse.json({
    ok: result.status==='ready',
    backend:'nextjs-node',
    provider:'groq',
    configured,
    checkStatus:result.status,
    message:result.message,
  }, {headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
