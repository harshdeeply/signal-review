import type { Candidate } from "./engine";
const namesA = ["Avery", "Morgan", "Sam", "Jordan", "Mika", "Robin", "Casey", "Riley", "Taylor", "Alex", "Jules", "Devon", "Quinn", "Kai", "Aria", "Noor", "Emery", "Harper", "Jin", "Drew"];
const namesB = ["Chen", "Patel", "Nguyen", "Rivera", "Singh", "Martin", "Kim", "Brown", "Shah", "Garcia", "Wilson", "Lee", "Kaur", "Ahmed", "Park", "Roy", "Tran", "Ali", "Reed", "Das"];
const snippets = [
  "Built TypeScript and React dashboards for logistics operators, adding unit tests and accessible workflows.",
  "Owned a Python service that reconciled event-driven data from Kafka and documented recovery steps.",
  "Led customer interviews and requirements discovery, then shipped an internal workflow tool on AWS.",
  "Implemented Java APIs and PostgreSQL queries with integration tests and observability.",
  "Supported an operations team with data quality checks and daily incident reviews.",
  "Built end-to-end onboarding in React Native and Go with cloud infrastructure on GCP.",
  "Maintained an analytics pipeline and improved its error reporting and rollback process.",
  "Designed distributed systems for commerce integrations with queue retries and idempotency.",
  "Wrote Python scripts for sales reporting and a small admin UI in TypeScript.",
  "Partnered with product and support teams to clarify failure cases before rollout.",
  "Shipped an AI-assisted document extraction prototype with human review and citations.",
  "Developed static sites and improved visual accessibility across mobile screens.",
];
export function generateCandidates(count = 3518): Candidate[] {
  const result: Candidate[] = [];
  let seed = 729151;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < count; i++) {
    const selected = new Set<number>();
    const n = 2 + Math.floor(rand() * 5);
    while (selected.size < n) selected.add(Math.floor(rand() * snippets.length));
    result.push({ id: `SYN-${String(i + 1).padStart(5, "0")}`, name: `${namesA[Math.floor(rand() * namesA.length)]} ${namesB[Math.floor(rand() * namesB.length)]}`, location: ["Vancouver, BC", "Toronto, ON", "Calgary, AB", "Remote, Canada"][Math.floor(rand() * 4)], text: [...selected].map(x => snippets[x]).join("\n"), source: "Generated synthetic profile" });
  }
  return result;
}
