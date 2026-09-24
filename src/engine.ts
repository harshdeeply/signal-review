export type Criterion = { id: string; label: string; phrases: string[]; weight: number; required: boolean };
export type Candidate = { id: string; name: string; location: string; text: string; source: string };
export type Evidence = { criterionId: string; status: "found" | "unknown"; quote?: string; phrase?: string };
export type Result = { candidate: Candidate; score: number; coverage: number; evidence: Evidence[]; needsReview: boolean };

const expansions: Record<string, string[]> = {
  "typescript": ["typescript", "ts"], "react": ["react", "react.js", "react native"],
  "python": ["python"], "distributed systems": ["distributed systems", "distributed services", "microservices"],
  "event-driven": ["event-driven", "event driven", "kafka", "message queues"],
  "customer discovery": ["customer discovery", "customer interviews", "requirements discovery"],
  "cloud": ["aws", "gcp", "azure", "cloud infrastructure"],
  "testing": ["unit tests", "integration tests", "test suite", "pytest", "jest"],
  "ownership": ["owned", "led", "shipped", "launched", "built end-to-end"],
};
const normalize = (value: string) => value.toLowerCase().normalize("NFKC").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9+#.\s-]/g, " ").replace(/\s+/g, " ").trim();
const terms = (label: string) => expansions[normalize(label)] || [normalize(label)];
const hasPhrase = (sentence: string, phrase: string) => {
  const hay = ` ${normalize(sentence)} `;
  const needle = ` ${normalize(phrase)} `;
  if (!hay.includes(needle)) return false;
  // An explicit negative near the phrase is not evidence of a skill.
  const i = hay.indexOf(needle);
  return !/\b(no|without|lacks|not experienced with)\s*$/.test(hay.slice(Math.max(0, i - 25), i));
};
export function parseRubric(input: string): Criterion[] {
  const lines = input.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length || lines.length > 25) throw new Error("Enter 1–25 criteria, one per line.");
  const seen = new Set<string>();
  return lines.map((line, index) => {
    const required = line.startsWith("!");
    const raw = required ? line.slice(1).trim() : line;
    const [name, weightText] = raw.split("|").map(s => s.trim());
    const weight = weightText ? Number(weightText) : required ? 3 : 1;
    if (!name || name.length > 80 || !Number.isFinite(weight) || weight < 1 || weight > 5 || seen.has(normalize(name))) throw new Error(`Invalid or duplicate criterion on line ${index + 1}.`);
    seen.add(normalize(name));
    return { id: `c${index}`, label: name, phrases: terms(name), weight, required };
  });
}
export function evaluate(candidate: Candidate, rubric: Criterion[]): Result {
  const sentences = candidate.text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
  const evidence = rubric.map(criterion => {
    for (const sentence of sentences) for (const phrase of criterion.phrases) if (hasPhrase(sentence, phrase)) {
      return { criterionId: criterion.id, status: "found" as const, quote: sentence.slice(0, 350), phrase };
    }
    return { criterionId: criterion.id, status: "unknown" as const };
  });
  const total = rubric.reduce((n, c) => n + c.weight, 0);
  const matched = rubric.reduce((n, c, i) => n + (evidence[i].status === "found" ? c.weight : 0), 0);
  const coverage = Math.round(100 * matched / total);
  const missingRequired = rubric.some((c, i) => c.required && evidence[i].status === "unknown");
  return { candidate, score: coverage, coverage, evidence, needsReview: missingRequired };
}
export function rank(results: Result[]): Result[] {
  return [...results].sort((a, b) => (a.needsReview ? 1 : 0) - (b.needsReview ? 1 : 0) || b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));
}
export function parseCsv(input: string): Candidate[] {
  // RFC 4180-style quoted fields, including embedded commas and newlines.
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') { if (quoted && input[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) { if (ch === "\r" && input[i + 1] === "\n") i++; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (quoted) throw new Error("CSV contains an unclosed quote.");
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  const head = rows.shift()?.map(s => s.trim().toLowerCase());
  if (!head) throw new Error("CSV is empty.");
  const index = (name: string) => head.indexOf(name);
  if (index("id") < 0 || index("name") < 0 || index("text") < 0) throw new Error("CSV needs id, name, and text columns.");
  if (rows.length > 25000) throw new Error("Import is limited to 25,000 rows per browser run.");
  const ids = new Set<string>();
  return rows.map((fields, i) => {
    const id = fields[index("id")]?.trim(), name = fields[index("name")]?.trim(), text = fields[index("text")]?.trim();
    if (!id || !name || !text || ids.has(id) || text.length > 50000) throw new Error(`Invalid, duplicate, or oversized candidate at row ${i + 2}.`);
    ids.add(id);
    return { id, name, text, location: fields[index("location")]?.trim() || "Not supplied", source: "Local CSV" };
  });
}
