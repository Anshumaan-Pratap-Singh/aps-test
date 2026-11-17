import Link from "next/link";
import { notFound } from "next/navigation";
import { Difficulty, PageHeader } from "@/components/ui";
import { PROBLEMS } from "@/features/coding/problems";
import { Workspace } from "@/features/coding/Workspace";

export function generateStaticParams() {
  return PROBLEMS.map((p) => ({ problem: p.id }));
}

export default async function ProblemPage({ params }: { params: Promise<{ problem: string }> }) {
  const { problem } = await params;
  const p = PROBLEMS.find((x) => x.id === problem);
  if (!p) notFound();
  return (
    <>
      <PageHeader title={p.title} kicker="Coding Laboratory"><span className="flex items-center gap-3"><Difficulty level={p.difficulty} /> {p.tags.join(" · ")} · <Link href="/coding" className="text-blue hover:text-cyan">← Problems</Link></span></PageHeader>
      <Workspace problem={p} />
    </>
  );
}
