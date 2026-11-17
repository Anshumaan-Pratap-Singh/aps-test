import { PageHeader } from "@/components/ui";
import { ProblemTrainer } from "@/features/problems/ProblemTrainer";

export const metadata = { title: "Probability & EV Trainer" };

export default function Page() {
  return (
    <>
      <PageHeader title="Probability & Expected Value" kicker="Probability & Statistics" />
      <ProblemTrainer questionType="probability" title="Configure problem set" />
    </>
  );
}
