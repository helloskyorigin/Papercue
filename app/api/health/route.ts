import {NextResponse} from "next/server";
import {hasConfiguredKey} from "@/lib/diagnostics.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 const configured=hasConfiguredKey(process.env.GROQ_API_KEY);
 return NextResponse.json({ok:configured,configured,backend:"nextjs-node",provider:"groq",message:configured?"Backend is running and Groq key is present. Test a real scan.":"GROQ_API_KEY missing. Add to AI Studio Settings > Secrets or Vercel Environment Variables, then restart."},{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
