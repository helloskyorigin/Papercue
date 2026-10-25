import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectVision,verifyExtractedNotice } from '../lib/notice-validation.mjs';
import {safeOutput} from '../lib/analysis.mjs';
import {makeVisionInspectionRequest} from '../lib/groq.mjs';

const goodText='OFFICIAL SCHOOL NOTICE\nStudents must submit forms with parent signature to the school office by 28 October 2026.';
const validRaw={
 noticeFound:true,hasActionableInfo:true,sourceStatus:'complete',
 documentTitle:'Application Notice',summary:'Students must submit forms.',
 deadline:'2026-10-28',deadlineEvidence:'by 28 October 2026',
 items:[{title:'Submit form',description:'Submit to school office',evidence:'Students must submit forms with parent signature',priority:'high',required:true,dueDate:'2026-10-28'}],
 missingInformation:[],cautions:[]
};
test('a random portrait is rejected before analysis',()=>{
 const x=inspectVision({noticeFound:false,readable:true,visibleText:'Happy birthday, here is my vacation photo.'});
 assert.equal(x.ok,false);assert.equal(x.code,'NOT_A_NOTICE');
});
test('a blurry photo of a real notice is rejected before results',()=>{
 const x=inspectVision({noticeFound:true,readable:false,visibleText:'blurred'});
 assert.equal(x.ok,false);assert.equal(x.code,'IMAGE_UNREADABLE');
});
test('cropped notice with readable instructions continues as partial',()=>{
 const x=inspectVision({noticeFound:true,readable:true,partial:true,visibleText:goodText,missingParts:['Lower edge cut off']});
 assert.equal(x.ok,true);assert.equal(x.partial,true);
 const checked=verifyExtractedNotice(validRaw,safeOutput(validRaw,x.text),{partial:true,missing:x.missing});
 assert.equal(checked.ok,true);assert.equal(checked.analysis.sourceStatus,'partial');
 assert.match(checked.analysis.missingInformation.join(' '),/Lower edge cut off/);
});
test('unrelated text gets rejected even when it has a generic date',()=>{
 const x={...validRaw,noticeFound:false};
 assert.equal(verifyExtractedNotice(x,safeOutput(x,goodText)).code,'NOT_A_NOTICE');
});
test('zero-step, no-deadline results never reach the results screen',()=>{
 const x={...validRaw,hasActionableInfo:false,items:[],deadline:null};
 assert.equal(verifyExtractedNotice(x,safeOutput(x,goodText)).code,'NO_ACTIONS');
});
test('hallucinated tasks without matched verbatim evidence are not displayed',()=>{
 const x={...validRaw,items:[{...validRaw.items[0],evidence:'Bring a birth certificate and ₹3000 fee.'}],deadline:null};
 assert.equal(verifyExtractedNotice(x,safeOutput(x,goodText)).code,'NO_ACTIONS');
});
test('partial notice with only a supported task but missing deadline is still useful',()=>{
 const x={...validRaw,deadline:null,deadlineEvidence:'',sourceStatus:'partial'};
 const y=verifyExtractedNotice(x,safeOutput(x,goodText));
 assert.equal(y.ok,true);assert.equal(y.analysis.deadline,null);
 assert.match(y.analysis.missingInformation.join(' '),/deadline/i);
});
test('vision gate uses the same Groq API without releasing API credentials',()=>{
 const r=makeVisionInspectionRequest({image:'YWJj',mime:'image/png'});
 assert.equal(r.response_format.type,'json_object');
 assert.equal(r.messages[1].content[1].image_url.url,'data:image/png;base64,YWJj');
 assert.ok(!JSON.stringify(r).includes('GROQ_API_KEY'));
});
