import { performance } from 'node:perf_hooks';
import { generateCandidates } from '../src/data.ts';
import { parseRubric,evaluate,rank } from '../src/engine.ts';
const rubric=parseRubric('!TypeScript|3\n!React|3\nPython|2\nEvent-driven|2\nCustomer discovery|2\nTesting\nCloud\nOwnership|2');
const candidates=generateCandidates(3518);
const start=performance.now();
const results=rank(candidates.map(c=>evaluate(c,rubric)));
const elapsed=performance.now()-start;
console.log(JSON.stringify({candidates:results.length,criteria:rubric.length,evaluation_ms:+elapsed.toFixed(2),profiles_per_sec:Math.round(results.length/(elapsed/1000)),top_evidence:results[0].score,model_calls:0,includes_generation:false,includes_ui:false}));
