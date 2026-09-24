import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowDownRight, ArrowRight, Check, CircleHelp, FileUp, GitBranch, Github, Pause, Play, RotateCcw, Search, ShieldCheck, X } from "lucide-react";
import { generateCandidates } from "./data";
import { parseCsv, parseRubric, type Candidate, type Criterion, type Result } from "./engine";

const INITIAL_RUBRIC = "!TypeScript | 3\n!React | 3\nPython | 2\nEvent-driven | 2\nCustomer discovery | 2\nTesting | 1\nCloud | 1\nOwnership | 2";
const DEFAULT_COUNT = 3518;
type RunState = "idle" | "running" | "done";

export default function App() {
  const [rubricText, setRubricText] = useState(INITIAL_RUBRIC);
  const [candidates, setCandidates] = useState<Candidate[]>(() => generateCandidates(DEFAULT_COUNT));
  const [results, setResults] = useState<Result[]>([]);
  const [completed, setCompleted] = useState(0);
  const [state, setState] = useState<RunState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState<Result | null>(null);
  const [search, setSearch] = useState("");
  const [showOnlyReview, setShowOnlyReview] = useState(false);
  const [error, setError] = useState("");
  const workerRef = useRef<Worker | null>(null);
  const runId = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const rubric = useMemo(() => { try { return parseRubric(rubricText); } catch { return [] as Criterion[]; } }, [rubricText]);
  const visible = useMemo(() => results.filter(r => (!showOnlyReview || !r.needsReview) && (!search || `${r.candidate.name} ${r.candidate.id}`.toLowerCase().includes(search.toLowerCase()))), [results, search, showOnlyReview]);
  const leaders = results.filter(r => !r.needsReview).slice(0, 12);
  const queue = results.slice(0, 150);
  const coverage = results.length ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0;
  const sourceLabel = candidates[0]?.source === "Local CSV" ? "LOCAL CSV" : "SYNTHETIC DATA";
  function stop() { workerRef.current?.terminate(); workerRef.current = null; runId.current++; setState("idle"); }
  function reset() { stop(); setResults([]); setCompleted(0); setElapsed(0); setError(""); setSearch(""); }
  function run() {
    let criteria: Criterion[];
    try { criteria = parseRubric(rubricText); } catch (e) { setError((e as Error).message); return; }
    setError(""); setResults([]); setCompleted(0); setElapsed(0); setState("running");
    const id = ++runId.current;
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (message: MessageEvent<{ id: number; type: "progress" | "done"; completed?: number; results?: Result[]; elapsedMs?: number }>) => {
      const msg = message.data;
      if (id !== runId.current || msg.id !== id) return;
      if (msg.type === "progress") setCompleted(msg.completed || 0);
      else { setResults(msg.results || []); setElapsed(msg.elapsedMs || 0); setCompleted(candidates.length); setState("done"); worker.terminate(); workerRef.current = null; }
    };
    worker.onerror = () => { if (id !== runId.current) return; setError("The browser worker stopped. Try a smaller import."); stop(); };
    worker.postMessage({ id, candidates, rubric: criteria });
  }
  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try { if (file.size > 25_000_000) throw new Error("CSV must be under 25 MB."); const data = parseCsv(await file.text()); reset(); setCandidates(data); }
    catch (e) { setError((e as Error).message); }
    event.target.value = "";
  }
  function restore() { reset(); setCandidates(generateCandidates(DEFAULT_COUNT)); setRubricText(INITIAL_RUBRIC); }
  return <>
    <a href="#main" className="skip">Skip to workbench</a>
    <header className="topbar"><div className="wordmark"><div className="mark" aria-hidden="true"><span/><span/><span/></div><strong>SIGNAL<span>/</span>REVIEW</strong><span className="top-tag">CANDIDATE EVIDENCE CONSOLE</span></div><div className="top-right"><span className="local-indicator"><i/> LOCAL-FIRST DEMO</span><a href="https://github.com/harshdeeply/signal-review" target="_blank" rel="noopener noreferrer" aria-label="Source code on GitHub"><Github size={17}/></a></div></header>
    <main id="main">
      <section className="intro"><div><div className="eyebrow"><span>01 / THE FIRST PASS</span><span>REVIEW, NOT REJECTION</span></div><h1>Find the signal.<br/><em>Keep the evidence.</em></h1><p className="intro-copy">A fast review workbench for large application pools. Define the job criteria, inspect cited résumé lines, and send uncertain profiles to a human. This hosted demo runs entirely in your browser.</p><div className="intro-meta"><span><ShieldCheck size={15}/> No automatic hiring decision</span><span><GitBranch size={15}/> Transparent criteria</span><span><CircleHelp size={15}/> Missing means unknown</span></div></div><div className="intro-aside"><span className="aside-label">WHAT THE COUNTER MEASURES</span><strong>3,518<span> profiles</span></strong><p>Generated, synthetic candidates in the default scenario. Runtime below measures this browser’s actual evaluation pass, excluding model API time, résumé extraction, network transfer, and human review.</p><ArrowDownRight size={26}/></div></section>
      <section className="workspace" id="workspace"><div className="workspace-head"><div><span className="section-label">02 / CONFIGURE THE REVIEW</span><h2>Set the evidence standard.</h2></div><span className="mode-pill">{sourceLabel}</span></div>
        <div className="configure"><div className="rubric-panel"><label htmlFor="rubric">JOB CRITERIA <span>one per line · ! required · optional | weight 1–5</span></label><textarea id="rubric" spellCheck={false} value={rubricText} onChange={e => { setRubricText(e.target.value); if (state !== "idle") reset(); }} /><p>Example: <code>!TypeScript | 3</code>. Matching is literal plus a small visible synonym dictionary in source. The score is evidence coverage, not a prediction of job performance.</p></div><div className="data-panel"><span className="panel-label">APPLICATION POOL</span><strong>{candidates.length.toLocaleString()}</strong><span>profiles ready for a local review pass</span><div className="data-actions"><button onClick={() => fileRef.current?.click()}><FileUp size={16}/> Import CSV</button><input ref={fileRef} type="file" accept=".csv,text/csv" onChange={importCsv} hidden/><button onClick={restore}><RotateCcw size={15}/> Reset demo</button></div><p>CSV columns: <code>id,name,text,location</code>. Imported text stays in this tab and is never uploaded by this site. Close the tab to discard it.</p></div></div>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="runbar"><div className="run-progress" style={{ transform: `scaleX(${completed / Math.max(candidates.length,1)})` }}/><div className="run-time"><span>RUN TIME</span><strong>{elapsed ? `${elapsed.toFixed(1)} ms` : state === "running" ? "Running…" : "—"}</strong></div><div className="run-stat"><span>SCANNED</span><strong>{completed.toLocaleString()} <small>/ {candidates.length.toLocaleString()}</small></strong></div><div className="run-stat"><span>AVG. EVIDENCE</span><strong>{results.length ? `${coverage}%` : "—"}</strong></div><div className="run-controls"><button className="run-button" onClick={state === "running" ? stop : run}>{state === "running" ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor"/>}{state === "running" ? "Stop run" : state === "done" ? "Run again" : "Evaluate profiles"}</button><button className="reset-button" onClick={reset} title="Clear this run"><RotateCcw size={16}/></button></div></div>
        <p className="run-note">{state === "done" ? `Measured ${candidates.length.toLocaleString()} profiles in ${elapsed.toFixed(1)} ms on this device. ${leaders.length} profiles shown in the review queue.` : "Run a measured evaluation. No LLM is invoked in this browser demo; see the repository for the optional model-assisted local workflow."}</p>
      </section>
      <section className="review-section"><div className="workspace-head"><div><span className="section-label">03 / INSPECT THE FINDINGS</span><h2>Read before you decide.</h2></div><span className="mode-pill">{results.length ? `${results.length.toLocaleString()} SCORED` : "AWAITING RUN"}</span></div>
        <div className="review-layout"><div className="results-panel"><div className="results-head"><div><strong>Candidate matrix</strong><span>Each cell is a profile. Dark cells lack required evidence; light cells are ready for review.</span></div><span>{visible.length.toLocaleString()} shown</span></div><div className="matrix-shell"><div className="matrix" role="group" aria-label="Candidate evidence matrix">{(state === "done" ? visible.slice(0, 5000) : candidates.slice(0, 420)).map((item, i) => {
          const result = state === "done" ? item as Result : null;
          return <button key={result?.candidate.id || i} disabled={!result} className={`cell ${result ? result.needsReview ? "uncertain" : result.score >= 75 ? "strong" : "possible" : "waiting"}`} title={result ? `${result.candidate.id}: ${result.score}% evidence` : "Awaiting evaluation"} aria-label={result ? `Inspect ${result.candidate.name}, ${result.score}% evidence` : undefined} onClick={() => result && setSelected(result)}/>;
        })}</div></div><div className="legend"><span><i className="swatch waiting"/> Waiting</span><span><i className="swatch uncertain"/> Needs evidence</span><span><i className="swatch possible"/> Reviewable</span><span><i className="swatch strong"/> Strong evidence</span></div><p className="matrix-caption">Sorted by weighted evidence coverage, then stable candidate ID. The matrix is a visual index, not an automated hiring outcome.</p></div>
        <aside className="queue-panel"><div className="queue-head"><span>REVIEW QUEUE</span><strong>{leaders.length.toString().padStart(2,"0")}<small> / 12</small></strong></div><label className="search"><Search size={16}/><input placeholder="Search name or ID" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search candidates"/></label><label className="filter"><input type="checkbox" checked={showOnlyReview} onChange={e=>setShowOnlyReview(e.target.checked)}/> Evidence complete only</label><div className="queue-list">{(state === "done" ? queue.filter(r => (!showOnlyReview || !r.needsReview) && (!search || `${r.candidate.name} ${r.candidate.id}`.toLowerCase().includes(search.toLowerCase()))) : []).slice(0, 12).map((result,i)=><button key={result.candidate.id} onClick={()=>setSelected(result)}><span className="queue-rank">{String(i+1).padStart(2,"0")}</span><span className="queue-name"><strong>{result.candidate.name}</strong><small>{result.candidate.id} · {result.needsReview ? "MISSING REQUIRED" : "EVIDENCE READY"}</small></span><strong className="queue-score">{result.score}%</strong><ArrowRight size={16}/></button>)}{!results.length && <div className="empty">Your evidence queue will appear after a run.</div>}{results.length && !visible.length && <div className="empty">No profiles match these filters.</div>}</div></aside></div>
      </section>
      <section className="method"><div><span className="section-label">04 / THE BOUNDARY</span><h2>Fast is useful.<br/><em>Inspectable is essential.</em></h2></div><div className="method-grid"><div><span>01</span><h3>Source grounded</h3><p>Every found criterion points to the résumé sentence that matched it. Missing source evidence is marked unknown.</p></div><div><span>02</span><h3>Human judgment</h3><p>Scores represent rubric coverage. They are not calibrated probabilities, suitability judgments, or rejection decisions.</p></div><div><span>03</span><h3>Real integration path</h3><p>The repository contains a local ingestion pipeline and optional structured model extraction with citation checks. The hosted page uses deterministic matching for a safe, reproducible demo.</p></div></div></section>
    </main><footer><strong>SIGNAL/REVIEW</strong><span>REFERENCE SYSTEM · SYNTHETIC BY DEFAULT</span><a href="https://thenorth.dev/#work">HARSHDEEP SINGH <ArrowRight size={15}/></a></footer>
    <AnimatePresence>{selected && <motion.div className="dialog-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setSelected(null)}><motion.div className="dialog" role="dialog" aria-modal="true" aria-label={`Evidence for ${selected.candidate.name}`} initial={{opacity:0,y:25}} animate={{opacity:1,y:0}} exit={{opacity:0,y:25}} onClick={e=>e.stopPropagation()}><div className="dialog-top"><span>APPLICATION / {selected.candidate.id}</span><button aria-label="Close evidence" onClick={()=>setSelected(null)}><X size={20}/></button></div><h2>{selected.candidate.name}</h2><p>{selected.candidate.location} · {selected.candidate.source}</p><div className="dialog-score"><strong>{selected.score}%</strong><span>WEIGHTED EVIDENCE COVERAGE<br/>{selected.needsReview ? "REQUIRED EVIDENCE MISSING — HUMAN REVIEW" : "EVIDENCE READY FOR HUMAN REVIEW"}</span></div><div className="dialog-evidence">{rubric.map((criterion, i)=>{const evidence=selected.evidence[i];return <div key={criterion.id} className="evidence-row"><div><span className={evidence?.status === "found" ? "found" : "unknown"}>{evidence?.status === "found" ? <Check size={15}/> : "?"}</span><strong>{criterion.label}</strong><small>{criterion.required ? "REQUIRED" : `WEIGHT ${criterion.weight}`}</small></div><blockquote>{evidence?.quote ? `“${evidence.quote}”` : "No matching statement in the supplied text. This does not prove the skill is absent."}</blockquote></div>})}</div><div className="dialog-end">Evidence is not a hiring decision. Review the complete application before acting.<button onClick={()=>setSelected(null)}>Close review <ArrowRight size={15}/></button></div></motion.div></motion.div>}</AnimatePresence>
  </>;
}
