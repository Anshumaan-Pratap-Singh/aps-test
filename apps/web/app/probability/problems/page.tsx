import { PageHeader } from "@/components/ui";
import { ProblemTrainer } from "@/features/problems/ProblemTrainer";

export const metadata = { title: "Competition Problems" };

export default function Page() {
  return (
    <>
      <PageHeader title="Competition Problem Set" kicker="Probability & Statistics">
        Parameterised, computational problems with integer answers. Each is cross-checked by brute force. Proof-style problems
        require human review and are intentionally not generated.
      </PageHeader>
      <ProblemTrainer questionType="olympiad" title="Configure problem set" count={8} />
    </>
  );
}
