import test from 'node:test';
import assert from 'node:assert/strict';
import {makeGroqRequest,fileSignatureMatches,DEFAULT_GROQ_MODEL,MAX_UPLOAD_BYTES} from '../lib/groq.mjs';
test('Groq text request has strict JSON instruction and no Gemini data shape',()=>{
 const r=makeGroqRequest({text:'School notice: submit by 28 Oct 2026'});
 assert.equal(r.model,DEFAULT_GROQ_MODEL);
 assert.equal(r.response_format.type,'json_object');
 assert.equal(r.messages[1].role,'user');
 assert.match(r.messages[1].content,/submit by 28 Oct/);
 assert.equal('inlineData' in r,false);
});
test('image request is Groq chat vision content',()=>{
 const r=makeGroqRequest({text:'',image:'AQID',mime:'image/png'});
 assert.equal(r.messages[1].content[1].image_url.url,'data:image/png;base64,AQID');
});
test('signature validation rejects mismatched user-supplied MIME',()=>{
 assert.ok(fileSignatureMatches(Buffer.from('%PDF-1.7     '),'application/pdf'));
 assert.ok(!fileSignatureMatches(Buffer.from('%PDF-1.7     '),'image/png'));
 assert.ok(fileSignatureMatches(Buffer.from('89504e470d0a1a0a00000000','hex'),'image/png'));
 assert.equal(MAX_UPLOAD_BYTES,3*1024*1024);
});
test('source text is capped to Groq prompt size',()=>{
 const r=makeGroqRequest({text:'a'.repeat(40_000)});
 assert.ok(r.messages[1].content.length<20_000);
});

import {resolveSupportedMime,probeGroq} from '../lib/groq.mjs';
test('Android file picker without MIME type falls back to supported extension',()=>{
 assert.equal(resolveSupportedMime('', 'admission.JPG'),'image/jpeg');
 assert.equal(resolveSupportedMime('application/octet-stream','notice.pdf'),'application/pdf');
 assert.equal(resolveSupportedMime('image/webp','foo.blob'),'image/webp');
 assert.equal(resolveSupportedMime('image/heic','photo.heic'),null);
 assert.equal(resolveSupportedMime('','malware.exe'),null);
});
test('health checks Groq key and selected model rather than key presence alone',async()=>{
 let hits=0;
 const fetchFn=async(_url,opts)=>{hits++; assert.equal(opts.headers.Authorization,'Bearer test_key'); return {ok:true,status:200,json:async()=>({data:[{id:'qwen/qwen3.8-27b'}]})};};
 const r=await probeGroq({key:'test_key',fetchFn});
 assert.equal(r.status,'ready');assert.equal(hits,1);
});
test('health catches invalid keys, model access issues and upstream outages',async()=>{
 const invalid=await probeGroq({key:'test_key',fetchFn:async()=>({ok:false,status:401})});
 assert.equal(invalid.status,'invalid');
 const absent=await probeGroq({key:'test_key',fetchFn:async()=>({ok:true,status:200,json:async()=>({data:[{id:'other-model'}]})})});
 assert.equal(absent.status,'model_missing');
 const offline=await probeGroq({key:'test_key',fetchFn:async()=>{throw new Error('network')}});
 assert.equal(offline.status,'unverified');
});
