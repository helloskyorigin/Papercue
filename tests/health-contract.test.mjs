import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const health=readFileSync(new URL('../app/api/health/route.ts',import.meta.url),'utf8');
test('frontend uses full-stack /api/health and shows real API failures',()=>{
 assert.match(page,/fetch\('\/api\/health'/);
 assert.match(page,/fetch\('\/api\/analyze'/);
 assert.match(page,/AI configuration needed/);
});
test('health never embeds API secret in responses',()=>{
 assert.match(health,/hasConfiguredKey/);
 assert.match(health,/probeGroq/);
 assert.doesNotMatch(health,/Bearer|Authorization/);
});