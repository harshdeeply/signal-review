import { evaluate, rank, type Candidate, type Criterion, type Result } from "./engine";
self.onmessage = (event: MessageEvent<{ id: number; candidates: Candidate[]; rubric: Criterion[] }>) => {
  const { id, candidates, rubric } = event.data;
  const results: Result[] = [];
  const started = performance.now();
  let i = 0;
  function step() {
    const end = Math.min(i + 125, candidates.length);
    for (; i < end; i++) results.push(evaluate(candidates[i], rubric));
    self.postMessage({ id, type: "progress", completed: i, total: candidates.length });
    if (i < candidates.length) setTimeout(step, 0);
    else self.postMessage({ id, type: "done", results: rank(results), elapsedMs: performance.now() - started });
  }
  step();
};
