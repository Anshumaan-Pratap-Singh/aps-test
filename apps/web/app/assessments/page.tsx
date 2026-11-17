import { ModuleGrid, type ModuleDef } from "@/components/ModuleGrid";
import { PageHeader, SectionTitle } from "@/components/ui";
import { PRESETS } from "@/features/assessments/presets";

export const metadata = { title: "Assessments" };

export default function AssessmentsPage() {
  const presets: ModuleDef[] = PRESETS.map((p) => ({ href: `/assessments/${p.key}`, title: p.title, description: `${p.description}${p.serverOnly ? " Server-validated only." : ""}`, difficulty: p.difficulty, trainer: p.trainer }));
  return (
    <>
      <PageHeader title="Assessments" kicker="Compete">
        Timed, feedback-free formats. Server-validated attempts are graded by the backend from the question seeds — client-reported scores
        are never trusted for benchmarks. These are unofficial practice formats and do not replicate any firm&apos;s proprietary test.
      </PageHeader>
      <SectionTitle>Onboarding</SectionTitle>
      <ModuleGrid modules={[{ href: "/assessments/baseline", title: "Baseline assessment", description: "Adaptive staircase across arithmetic, sequences and fractions; sets your starting levels.", difficulty: 3, trainer: "baseline" }]} />
      <SectionTitle>Assessment formats</SectionTitle>
      <ModuleGrid modules={presets} />
    </>
  );
}
