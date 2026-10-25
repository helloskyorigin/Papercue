import test from "node:test";
import assert from "node:assert/strict";
import {hasConfiguredKey,groqFailure} from "../lib/diagnostics.mjs";
test("secrets missing or placeholders are rejected",()=>{assert.equal(hasConfiguredKey(undefined),false);assert.equal(hasConfiguredKey("replace_with_your_key"),false);});
test("invalid Groq key surfaces precise status",()=>assert.equal(groqFailure(401).code,"GROQ_INVALID_KEY"));
test("missing or blocked model error is distinct",()=>{assert.equal(groqFailure(404).code,"GROQ_MODEL_UNAVAILABLE");assert.equal(groqFailure(403).code,"GROQ_NO_ACCESS");});
test("rate limits are reported",()=>assert.equal(groqFailure(429).code,"GROQ_RATE_LIMIT"));
