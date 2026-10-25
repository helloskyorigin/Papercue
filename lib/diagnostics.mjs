export function hasConfiguredKey(k){return typeof k==="string"&&k.trim().length>12&&!/^(replace_|your_|example|placeholder|sk-xxx)/i.test(k.trim());}
export function groqFailure(status,msg=""){
 const m=String(msg).toLowerCase();
 if(status===401)return {status:503,code:"GROQ_INVALID_KEY",error:"Groq rejected the API key. Check GROQ_API_KEY in server Secrets."};
 if(status===403)return {status:503,code:"GROQ_NO_ACCESS",error:"Groq account cannot access the configured model."};
 if(status===404||(status===400&&/model|does not exist|not found/.test(m)))return {status:503,code:"GROQ_MODEL_UNAVAILABLE",error:"Configured Groq model is unavailable. Check GROQ_MODEL."};
 if(status===429)return {status:429,code:"GROQ_RATE_LIMIT",error:"Groq rate limit reached. Retry shortly."};
 if(status===413)return {status:413,code:"GROQ_TOO_LARGE",error:"File exceeds Groq upload limits."};
 if(status===400)return {status:502,code:"GROQ_BAD_REQUEST",error:"Groq cannot process this input. Try shorter text or a clear image."};
 return {status:502,code:"GROQ_UNAVAILABLE",error:"Groq is temporarily unavailable."};
}
