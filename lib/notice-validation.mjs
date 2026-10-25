/** Conservative input gates for notice extraction. These validate model claims and evidence,
 * not an independent proof that an uploaded document is official or accurate. */
export function inspectVision(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {ok:false,code:'IMAGE_UNREADABLE',error:'Could not understand this image. Upload a clear, straight photo of a notice.'};
  if (raw.noticeFound !== true) return {ok:false,code:'NOT_A_NOTICE',error:'This does not look like a school, exam, admission or scholarship notice. Upload a notice with visible instructions.'};
  const text = typeof raw.visibleText === 'string' ? raw.visibleText.trim().slice(0,18000) : '';
  if (raw.readable !== true || text.length < 35) return {ok:false,code:'IMAGE_UNREADABLE',error:'The notice text is too blurry, cropped or short to read reliably. Upload a clearer photo showing the instructions.'};
  const missing = Array.isArray(raw.missingParts) ? raw.missingParts.filter(x => typeof x === 'string' && x.trim()).slice(0,6).map(x=>x.slice(0,160)) : [];
  return {ok:true,text,partial:raw.partial === true,missing};
}

export function verifyExtractedNotice(raw, analysis, opts={}) {
  if (!raw || raw.noticeFound !== true) return {ok:false,code:'NOT_A_NOTICE',error:'This content is not a recognizable educational notice. Upload an actual notice with instructions.'};
  // Do not turn generic prose, blank images or headlines into a fictional action plan.
  const supportedItems = analysis.items.filter(x=>x.evidenceStatus==='matched' && x.evidence.trim().length>=8);
  const supportedDeadline = !!analysis.deadline && analysis.deadlineEvidenceStatus==='matched' && analysis.deadlineEvidence.trim().length>=8;
  if (raw.hasActionableInfo !== true || (supportedItems.length===0 && !supportedDeadline)) {
    return {ok:false,code:'NO_ACTIONS',error:'We could not find reliable actions or a complete deadline in this copy. Upload the full notice with readable instructions, or paste its text.'};
  }
  // Don't expose unsupported AI guesses as actionable tasks.
  analysis.items = supportedItems;
  if (!supportedDeadline) { analysis.deadline = null; analysis.deadlineEvidence = ''; analysis.deadlineEvidenceStatus = 'missing'; }
  const unique = new Set(analysis.missingInformation.filter(x=>typeof x==='string'&&x.trim()));
  for (const m of opts.missing || []) unique.add(m);
  if (!analysis.deadline) unique.add('A complete deadline was not found in the supplied notice.');
  if (opts.partial === true && unique.size===0) unique.add('The photo may be cropped. Compare the full original notice.');
  analysis.missingInformation = [...unique].slice(0,12);
  analysis.sourceStatus = opts.partial === true || raw.sourceStatus === 'partial' || analysis.missingInformation.length>0 ? 'partial':'complete';
  return {ok:true,analysis};
}
