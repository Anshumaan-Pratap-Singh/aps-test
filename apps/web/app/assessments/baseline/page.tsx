import { PageHeader } from "@/components/ui";
import { Baseline } from "@/features/assessments/Baseline";

export const metadata = { title: "Baseline Assessment" };

export default function Page() {
  return (
    <>
      <PageHeader title="Baseline Assessment" kicker="Assessments" />
      <Baseline />
    </>
  );
}
