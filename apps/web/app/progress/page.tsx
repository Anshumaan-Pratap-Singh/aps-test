import { PageHeader } from "@/components/ui";
import { Progress } from "@/features/progress/Progress";

export const metadata = { title: "Progress & Analytics" };

export default function Page() {
  return (
    <>
      <PageHeader title="Progress & Analytics" kicker="Analyse">
        Every metric is computed from your recorded attempts; definitions are shown next to the numbers. Percentiles come only from
        server-validated assessments in comparable cohorts and are suppressed when the cohort is too small.
      </PageHeader>
      <Progress />
    </>
  );
}
