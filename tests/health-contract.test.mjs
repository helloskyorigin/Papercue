import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
const health=readFileSync(new URL("../app/api/health/route.ts",import.meta.url),"utf8");
test("browser checks backend before Groq scanning",()=>{assert.match(page,/fetch\("\/api\/health"/);assert.match(page,/Groq API key missing/);});
test("health endpoint never logs or returns a secret",()=>{assert.match(health,/hasConfiguredKey/);assert.doesNotMatch(health,/Authorization|Bearer/);});
