import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { AssessmentRunner } from "@/features/assessments/AssessmentRunner";
import { PRESETS } from "@/features/assessments/presets";

export function generateStaticParams() {
  return PRESETS.map((p) => ({ preset: p.key }));
}

export default async function Page({ params }: { params: Promise<{ preset: string }> }) {
  const { preset } = await params;
  const p = PRESETS.find((x) => x.key === preset);
  if (!p) notFound();
  return (
    <>
      <PageHeader title={p.title} kicker="Assessments"><Link href="/assessments" className="text-blue hover:text-cyan">← All formats</Link></PageHeader>
      <AssessmentRunner presetKey={p.key} />
    </>
  );
}
