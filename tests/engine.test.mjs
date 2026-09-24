import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRubric, evaluate, rank, parseCsv } from '../src/engine.ts';
const candidate = (id,text) => ({id,name:id,location:'Canada',text,source:'test'});
test('cites only actual sentence and marks absent evidence unknown',()=>{
 const rubric=parseRubric('!React|3\nPython|2'); const result=evaluate(candidate('a','Built React services. No Python experience.'),rubric);
 assert.equal(result.score,60); assert.deepEqual(result.evidence.map(e=>e.status),['found','unknown']); assert.equal(result.evidence[0].quote,'Built React services.');
});
test('missing required evidence remains a review flag, not an automatic rejection',()=>{
 const result=evaluate(candidate('a','Built Python services.'),parseRubric('!React\nPython'));
 assert.equal(result.needsReview,true); assert.equal(result.score,25);
});
test('weight boundaries, duplicate criteria, and deterministic tie break',()=>{
 assert.throws(()=>parseRubric('React\nreact'),/duplicate/); assert.throws(()=>parseRubric('React|6'),/Invalid/);
 const rubric=parseRubric('React'); const output=rank([evaluate(candidate('b','React.'),rubric),evaluate(candidate('a','React.'),rubric)]);
 assert.deepEqual(output.map(x=>x.candidate.id),['a','b']);
});
test('quoted CSV fields and duplicate application IDs',()=>{
 const input='id,name,text,location\r\n1,"Morgan, J","Built React, TypeScript.\nShipped tests.",BC\r\n';
 const candidates=parseCsv(input); assert.equal(candidates[0].name,'Morgan, J'); assert.match(candidates[0].text,/Shipped tests/);
 assert.throws(()=>parseCsv('id,name,text\n1,A,React\n1,B,Python'),/duplicate/);
});
