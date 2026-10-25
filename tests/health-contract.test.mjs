import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const results=readFileSync(new URL('../app/results/page.tsx',import.meta.url),'utf8');
const health=readFileSync(new URL('../app/api/health/route.ts',import.meta.url),'utf8');

test('upload keeps full-stack routes and redirects after real analysis',()=>{
  assert.match(page,/fetch\('\/api\/health'/);
  assert.match(page,/fetch\('\/api\/analyze'/);
  assert.match(page,/sessionStorage\.setItem\('papercue-result-v1'/);
  assert.match(page,/window\.location\.replace\('\/results'\)/);
  assert.doesNotMatch(page,/Groq verified/);
});
test('standalone results can recover session data and display important actions',()=>{
  assert.match(results,/sessionStorage\.getItem\('papercue-result-v1'/);
  assert.match(results,/AnalysisSchema\.safeParse/);
  assert.match(results,/Action checklist/);
  assert.match(results,/Missing or unclear/);
  assert.match(results,/calendarContent/);
});
test('health never embeds API secret in responses',()=>{
  assert.match(health,/hasConfiguredKey/);
  assert.match(health,/probeGroq/);
  assert.doesNotMatch(health,/Bearer|Authorization/);
});
