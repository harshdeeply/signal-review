import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Activity, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, ExternalLink, FileText, FileUp, Github, LayoutDashboard, LogOut, Play, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Square, X } from "lucide-react";
import { generateCandidates } from "./data";
import { parseCsv, parseRubric, type Candidate, type Criterion, type Result } from "./engine";

const INITIAL_RUBRIC = "!TypeScript | 3\n!React | 3\nPython | 2\nEvent-driven | 2\nCustomer discovery | 2\nTesting | 1\nCloud | 1\nOwnership | 2";
const DEFAULT_COUNT = 3518;
const PAGE_SIZE = 20;
type RunState = "idle" | "running" | "done";
type View = "overview" | "criteria" | "applications" | "method";
type Filter = "all" | "ready" | "missing";
const sourceUrl = "https://github.com/harshdeeply/signal-review";

export default function App() {
  const [view, setView] = useState<View>("overview");
  const [rubricText, setRubricText] = useState(INITIAL_RUBRIC);
  const [candidates, setCandidates] = useState<Candidate[]>(() => generateCandidates(DEFAULT_COUNT));
  const [results, setResults] = useState<Result[]>([]);
  const [completed, setCompleted] = useState(0);
  const [state, setState] = useState<RunState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState<Result | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const workerRef = useRef<Worker | null>(null);
  const runId = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const rubric = useMemo(() => { try { return parseRubric(rubricText); } catch { return [] as Criterion[]; } }, [rubricText]);
  const ready = useMemo(() => results.filter(r => !r.needsReview).length, [results]);
  const coverage = results.length ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0;
  const sourceLabel = candidates[0]?.source === "Local CSV" ? "Local CSV" : "Synthetic dataset";
  const visible = useMemo(() => results.filter(r => (filter === "all" || (filter === "ready" ? !r.needsReview : r.needsReview)) && (!search || `${r.candidate.name} ${r.candidate.id} ${r.candidate.location}`.toLowerCase().includes(search.toLowerCase()))), [results, search, filter]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));

  useEffect(() => { setPage(0); }, [search, filter]);
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);
  useEffect(() => () => workerRef.current?.terminate(), []);

  function stop() { workerRef.current?.terminate(); workerRef.current = null; runId.current++; setState("idle"); }
  function reset() { stop(); setResults([]); setCompleted(0); setElapsed(0); setError(""); setSearch(""); setFilter("all"); setPage(0); setSelected(null); }
  function run() {
    let criteria: Criterion[];
    try { criteria = parseRubric(rubricText); } catch (e) { setError((e as Error).message); setView("criteria"); return; }
    workerRef.current?.terminate();
    setError(""); setResults([]); setCompleted(0); setElapsed(0); setState("running");
    setView("overview");
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
    try { if (file.size > 25_000_000) throw new Error("CSV must be under 25 MB."); const data = parseCsv(await file.text()); reset(); setCandidates(data); setNotice(`${data.length.toLocaleString()} profiles loaded in this browser.`); }
    catch (e) { setError((e as Error).message); }
    event.target.value = "";
  }
  function restore() { reset(); setCandidates(generateCandidates(DEFAULT_COUNT)); setRubricText(INITIAL_RUBRIC); setNotice("Sample workspace restored."); }
  function navigate(next: View) { setView(next); document.querySelector(".content-scroll")?.scrollTo({ top: 0, behavior: "smooth" }); }

  const nav = ([
    ["overview", LayoutDashboard, "Overview"], ["criteria", SlidersHorizontal, "Review criteria"],
    ["applications", ClipboardList, "Applications"], ["method", BookOpen, "How it works"],
  ] as const);
  const titles: Record<View, string> = { overview: "Overview", criteria: "Review criteria", applications: "Applications", method: "How it works" };

  function table(rows: Result[], compact = false) {
    return <div className="table-wrap"><table className="candidate-table"><thead><tr><th>Candidate</th><th>Location</th><th>Evidence coverage</th><th>Required evidence</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{rows.map(result => <tr key={result.candidate.id} onClick={() => setSelected(result)}><td><button className="candidate-link" onClick={() => setSelected(result)}>{result.candidate.name}<small>{result.candidate.id}</small></button></td><td className="muted-cell">{result.candidate.location}</td><td><div className="score-cell"><span>{result.score}%</span><span className="score-track"><i style={{ width: `${result.score}%` }} /></span></div></td><td><span className={`status-pill ${result.needsReview ? "status-unknown" : "status-ready"}`}>{result.needsReview ? "Missing in supplied text" : "Found"}</span></td><td><ArrowRight size={15} className="row-arrow" /></td></tr>)}</tbody></table>{!rows.length && <div className="empty-table"><FileText size={22}/><strong>{results.length ? "No applications match" : "No evaluation yet"}</strong><p>{results.length ? "Try another name or evidence filter." : "Run the review to inspect candidates and their cited evidence."}</p>{!results.length && <button className="button button-primary" onClick={run}><Play size={15}/> Run evaluation</button>}</div>}{compact && results.length > rows.length && <button className="table-footer" onClick={() => navigate("applications")}>View all {results.length.toLocaleString()} evaluated applications <ArrowRight size={15}/></button>}</div>;
  }

  return <div className="app-shell">
    <a className="skip" href="#main">Skip to content</a>
    <aside className="sidebar" aria-label="Workspace navigation">
      <div className="brand"><div className="brand-mark" aria-hidden="true"><i/><i/><i/></div><div><strong>Signal Review</strong><span>Evidence workspace</span></div></div>
      <div className="side-group"><div className="side-label">WORKSPACE</div><nav>{nav.map(([key, Icon, label]) => <button key={key} className={`nav-item ${view === key ? "active" : ""}`} aria-current={view === key ? "page" : undefined} onClick={() => navigate(key)}><Icon size={17}/><span>{label}</span>{key === "applications" && state === "done" && <small>{results.length.toLocaleString()}</small>}</button>)}</nav></div>
      <div className="sidebar-bottom"><div className="sandbox-card"><div className="sandbox-title"><ShieldCheck size={15}/> PUBLIC SANDBOX</div><p>Sample profiles are synthetic. CSV imports and review runs stay in this browser.</p><button onClick={restore}><RotateCcw size={13}/> Reset demo</button></div><div className="profile"><div className="avatar">MO</div><div className="profile-copy"><strong>Morgan Operator</strong><span>Demo reviewer</span></div><button aria-label="Log out of demo" title="Log out" onClick={() => setNotice("This public demo has no account session to log out of.")}><LogOut size={17}/></button></div></div>
    </aside>
    <div className="content-scroll"><header className="topbar"><div className="breadcrumbs">WORKSPACE <span>/</span> <strong>{titles[view]}</strong></div><div className="top-actions"><span className="top-badge"><i/>{sourceLabel}</span><a href={sourceUrl} target="_blank" rel="noreferrer" aria-label="View source on GitHub"><Github size={18}/></a></div></header>
      <main id="main" className="main-content">
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
        {error && <div className="alert" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={15}/></button></div>}
        {view === "overview" && <>
          <div className="page-heading"><div><span className="eyebrow">CANDIDATE EVIDENCE CONSOLE</span><h1>Candidate review</h1><p>Find relevant applications in a large pool, then inspect the source text behind every match.</p></div><button className="button button-primary heading-action" onClick={state === "running" ? stop : run}>{state === "running" ? <Square size={14} fill="currentColor"/> : <Play size={15} fill="currentColor"/>}{state === "running" ? "Stop run" : state === "done" ? "Run again" : "Run evaluation"}</button></div>
          <div className="metrics"><Metric label="APPLICATION POOL" value={candidates.length.toLocaleString()} detail={sourceLabel} icon={<FileText size={17}/>}/><Metric label="EVALUATED" value={completed.toLocaleString()} detail={state === "running" ? "Review in progress" : state === "done" ? "This run" : "Awaiting run"} icon={<Activity size={17}/>}/><Metric label="REQUIRED EVIDENCE FOUND" value={state === "done" ? ready.toLocaleString() : "—"} detail={state === "done" ? "For human review" : "After evaluation"} icon={<Check size={17}/>}/><Metric label="EVALUATION TIME" value={state === "done" ? `${elapsed.toFixed(1)} ms` : state === "running" ? "Running…" : "—"} detail="Browser worker only" icon={<CircleHelp size={17}/>}/></div>
          <div className="overview-grid"><section className="card run-card"><div className="card-head"><div><span className="eyebrow">01 / REVIEW PASS</span><h2>Evaluate the application pool</h2></div><span className="subtle-badge">LOCAL WORKER</span></div><p className="card-description">Apply the visible job criteria to each supplied profile. Results are sorted by evidence coverage and whether required statements were found.</p><div className="progress-label"><span>{state === "done" ? "Evaluation complete" : state === "running" ? "Evaluating profiles" : "Ready to evaluate"}</span><strong>{Math.round(completed / Math.max(candidates.length, 1) * 100)}%</strong></div><div className="progress-track"><i style={{width:`${completed / Math.max(candidates.length, 1) * 100}%`}}/></div><div className="run-footer"><span>{completed.toLocaleString()} / {candidates.length.toLocaleString()} profiles</span><button className="button button-primary" onClick={state === "running" ? stop : run}>{state === "running" ? <Square size={13} fill="currentColor"/> : <Play size={14} fill="currentColor"/>}{state === "running" ? "Stop run" : state === "done" ? "Run again" : "Run evaluation"}</button></div></section>
            <section className="card setup-card"><div className="card-head"><div><span className="eyebrow">02 / CURRENT SETUP</span><h2>Review criteria</h2></div><SlidersHorizontal size={18}/></div><p className="card-description">{rubric.length} criteria · {rubric.filter(c => c.required).length} required · weighted evidence coverage</p><div className="criterion-chips">{rubric.slice(0, 6).map(c => <span key={c.id}>{c.required && <b>!</b>}{c.label}</span>)}{rubric.length > 6 && <span>+{rubric.length - 6} more</span>}</div><button className="text-action" onClick={() => navigate("criteria")}>Edit criteria or import a CSV <ArrowRight size={15}/></button></section></div>
          <section className="card results-card"><div className="card-head results-heading"><div><span className="eyebrow">03 / HUMAN REVIEW</span><h2>Applications to inspect</h2><p className="card-description">Evidence coverage is a rubric match, not a suitability score or hiring decision.</p></div><button className="button button-outline" onClick={() => navigate("applications")}>All applications <ArrowRight size={15}/></button></div>{table(results.slice(0, 8), true)}</section>
          <div className="boundary-note"><ShieldCheck size={17}/><p><strong>Review boundary</strong> — A missing match means the supplied text did not contain a recognized phrase. It does not prove the candidate lacks that skill. A human must inspect the complete application.</p></div>
        </>}
        {view === "criteria" && <><div className="page-heading"><div><span className="eyebrow">CONFIGURE / REVIEW PASS</span><h1>Review criteria</h1><p>Set the evidence standard and choose the application pool before running a review.</p></div><button className="button button-primary heading-action" onClick={run}><Play size={15} fill="currentColor"/>Run evaluation</button></div><div className="configure-grid"><section className="card criteria-card"><div className="card-head"><div><span className="eyebrow">JOB DEFINITION</span><h2>What should be found?</h2></div><span className="subtle-badge">{rubric.length} CRITERIA</span></div><label htmlFor="rubric" className="field-label">Evidence criteria <span>One per line</span></label><textarea id="rubric" spellCheck={false} value={rubricText} onChange={e => { setRubricText(e.target.value); if (state !== "idle") reset(); }} /><div className="helper"><strong>Syntax</strong><p>Prefix required criteria with <code>!</code>. Add <code>| 1–5</code> to set weight. For example, <code>!TypeScript | 3</code>. Matches use literal phrases and a small documented synonym set.</p></div></section><section className="card data-card"><div className="card-head"><div><span className="eyebrow">APPLICATION SOURCE</span><h2>Dataset</h2></div><FileText size={18}/></div><div className="dataset-count">{candidates.length.toLocaleString()}<span>profiles ready</span></div><span className="status-pill status-ready">{sourceLabel}</span><div className="dataset-actions"><button className="button button-outline" onClick={() => fileRef.current?.click()}><FileUp size={15}/> Import CSV</button><input ref={fileRef} type="file" accept=".csv,text/csv" onChange={importCsv} hidden/><button className="button button-ghost" onClick={restore}><RotateCcw size={15}/> Reset sample</button></div><p className="fine-print">Required CSV columns: <code>id,name,text</code>. Optional: <code>location</code>. Up to 25,000 rows and 25 MB. Imports remain in this browser tab; this site does not upload them.</p></section></div><div className="boundary-note"><CircleHelp size={17}/><p><strong>Interpretation</strong> — Weighted coverage summarizes which rubric phrases appear in supplied text. It cannot establish ability, experience quality, or whether a candidate should be rejected.</p></div></>}
        {view === "applications" && <><div className="page-heading"><div><span className="eyebrow">RESULTS / EVIDENCE</span><h1>Applications</h1><p>Open a profile to inspect the exact source statements that matched your criteria.</p></div><span className="heading-count">{results.length.toLocaleString()} evaluated</span></div><div className="summary-strip"><span><strong>{ready.toLocaleString()}</strong> required evidence found</span><span><strong>{(results.length - ready).toLocaleString()}</strong> missing required statements</span><span><strong>{results.length ? `${coverage}%` : "—"}</strong> average coverage</span></div><section className="card applications-card"><div className="list-toolbar"><div><h2>Review queue</h2><p>{state === "done" ? `${visible.length.toLocaleString()} applications shown` : "Run the evaluation to build a review queue"}</p></div><div className="list-controls"><label className="search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, ID, location" aria-label="Search applications"/></label><select aria-label="Filter applications" value={filter} onChange={e => setFilter(e.target.value as Filter)}><option value="all">All evidence states</option><option value="ready">Required evidence found</option><option value="missing">Missing required statements</option></select></div></div>{table(visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE))}{results.length > 0 && <div className="pagination"><span>Showing {visible.length ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, visible.length)} of {visible.length.toLocaleString()}</span><div><button aria-label="Previous page" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={17}/></button><span>{page + 1} / {pageCount}</span><button aria-label="Next page" disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={17}/></button></div></div>}</section><div className="boundary-note"><ShieldCheck size={17}/><p>Results are a review aid. Profiles with missing required statements remain available here for human inspection.</p></div></>}
        {view === "method" && <><div className="page-heading"><div><span className="eyebrow">SYSTEM / EXPLAINER</span><h1>How it works</h1><p>A fast first pass with visible criteria, source citations, and clear limits.</p></div><a href={sourceUrl} target="_blank" rel="noreferrer" className="button button-outline heading-action">View implementation <ExternalLink size={15}/></a></div><div className="method-grid"><section className="card method-card"><span className="step-index">01</span><h2>Define criteria</h2><p>A reviewer writes a job rubric with optional required flags and weights. The rubric is displayed and can be changed before a run.</p></section><section className="card method-card"><span className="step-index">02</span><h2>Evaluate locally</h2><p>A browser worker scans each profile with deterministic phrase matching and a small synonym dictionary. The time shown measures only this local pass.</p></section><section className="card method-card"><span className="step-index">03</span><h2>Inspect evidence</h2><p>Each matched criterion cites a sentence from the supplied profile. Unmatched criteria are labeled unknown and every application stays accessible.</p></section></div><div className="method-details"><section className="card explanation"><div className="card-head"><div><span className="eyebrow">LIVE SITE</span><h2>What this demo runs</h2></div><span className="subtle-badge">BROWSER ONLY</span></div><p>The default 3,518 profiles are generated synthetic examples. CSV imports are processed locally in the tab. The hosted demo does not call an AI model or upload résumé text, and it does not make hiring decisions.</p></section><section className="card explanation"><div className="card-head"><div><span className="eyebrow">REFERENCE BACKEND</span><h2>Where AI fits</h2></div><span className="subtle-badge">OPTIONAL LOCAL SETUP</span></div><p>The repository also includes an optional structured model extraction workflow for local use. It checks that cited snippets exist in source text before storing results. Model output still requires human verification; it is not connected to this hosted page.</p></section></div><div className="boundary-note"><ShieldCheck size={17}/><p><strong>Production boundary</strong> — Real recruiting use would require validated criteria, privacy and retention controls, accessibility review, bias assessment, and human oversight. This public sandbox is a systems demonstration.</p></div></>}
      </main><footer className="footer"><span>Signal Review · public sandbox</span><a href="https://thenorth.dev/#work">Harshdeep Singh <ArrowRight size={14}/></a></footer>
    </div>
    <AnimatePresence>{selected && <motion.div className="drawer-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setSelected(null)}><motion.aside className="drawer" role="dialog" aria-modal="true" aria-label={`Evidence for ${selected.candidate.name}`} initial={{x:32,opacity:0}} animate={{x:0,opacity:1}} exit={{x:32,opacity:0}} transition={{duration:.2}} onClick={e => e.stopPropagation()}><div className="drawer-top"><span>EVIDENCE / {selected.candidate.id}</span><button onClick={() => setSelected(null)} aria-label="Close evidence"><X size={19}/></button></div><div className="drawer-scroll"><h2>{selected.candidate.name}</h2><p className="drawer-subtitle">{selected.candidate.location} · {selected.candidate.source}</p><div className="drawer-summary"><div><strong>{selected.score}%</strong><span>WEIGHTED EVIDENCE COVERAGE</span></div><span className={`status-pill ${selected.needsReview ? "status-unknown" : "status-ready"}`}>{selected.needsReview ? "Missing required statements" : "Required evidence found"}</span></div><div className="drawer-section-title">CRITERION EVIDENCE <span>{selected.evidence.filter(e => e.status === "found").length} / {rubric.length} FOUND</span></div><div className="evidence-list">{rubric.map((criterion, i) => { const evidence = selected.evidence[i]; return <div className="evidence-item" key={criterion.id}><div className="evidence-title"><span className={evidence?.status === "found" ? "evidence-found" : "evidence-unknown"}>{evidence?.status === "found" ? <Check size={14}/> : "?"}</span><strong>{criterion.label}</strong><small>{criterion.required ? "REQUIRED" : `WEIGHT ${criterion.weight}`}</small></div><p>{evidence?.quote ? `“${evidence.quote}”` : "No matching statement in supplied text. This does not prove the skill is absent."}</p></div>; })}</div><details className="source-text"><summary>Read full supplied profile text</summary><p>{selected.candidate.text}</p></details><div className="drawer-caution"><ShieldCheck size={17}/><span>Review the complete application before making any decision. Source matches are only a first pass.</span></div></div><div className="drawer-bottom"><button className="button button-outline" onClick={() => setSelected(null)}>Close review</button></div></motion.aside></motion.div>}</AnimatePresence>
  </div>;
}

function Metric({label,value,detail,icon}:{label:string;value:string;detail:string;icon:React.ReactNode}) {
  return <div className="metric"><div className="metric-top"><span>{label}</span>{icon}</div><strong>{value}</strong><small>{detail}</small></div>;
}
