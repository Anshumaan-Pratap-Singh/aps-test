import { ModuleGrid, type ModuleDef } from "@/components/ModuleGrid";
import { Notice, PageHeader, SectionTitle } from "@/components/ui";
import { PLANNED, PROBLEMS } from "@/features/coding/problems";

export const metadata = { title: "Coding Laboratory" };

export default function CodingPage() {
  const problems: ModuleDef[] = PROBLEMS.map((p) => ({ href: `/coding/${p.id}`, title: p.title, description: `${p.tags.join(" · ")} — ${p.tests.length} tests (${p.tests.filter((t) => t.hidden).length} hidden)`, difficulty: p.difficulty, lesson: `coding:${p.id}` }));
  const extra: ModuleDef[] = [
    { href: "/coding/performance", title: "Systems Performance Simulator", description: "Measure cache locality, AoS vs SoA, branch prediction and allocation effects in your browser with p50/p95/p99.", difficulty: 6 },
    { href: "/learn/memory-ordering", title: "Atomics & SPSC queues", description: "Memory ordering lesson with an annotated lock-free ring buffer.", difficulty: 8, lesson: "lesson:memory-ordering" },
    { href: "/learn/limit-order-book", title: "Order books & matching", description: "Data structures behind the matching-engine problem.", difficulty: 6, lesson: "lesson:limit-order-book" },
    ...PLANNED.map((p) => ({ title: p.title, description: p.description, difficulty: 8, status: "planned" as const })),
  ];
  return (
    <>
      <PageHeader title="Coding Laboratory" kicker="Build">
        Problems have real executable tests. Python executes in WebAssembly (Pyodide) inside a Web Worker in your own browser — never
        inside the API. Server-side judging (secret hidden tests, C++) is designed as a separate isolated service and is not enabled here.
      </PageHeader>
      <Notice>Execution security: the API never runs submitted code. See docs/architecture.md § Code execution for the sandbox design (gVisor/Firecracker, no network, CPU/memory/wall-clock limits, read-only FS).</Notice>
      <SectionTitle>Problems</SectionTitle>
      <ModuleGrid modules={problems} />
      <SectionTitle>Systems & concurrency</SectionTitle>
      <ModuleGrid modules={extra} />
    </>
  );
}
