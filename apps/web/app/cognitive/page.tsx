import { ModuleGrid, type ModuleDef } from "@/components/ModuleGrid";
import { PageHeader, SectionTitle } from "@/components/ui";

export const metadata = { title: "Cognitive Training" };

const modules: ModuleDef[] = [
  { href: "/cognitive/task-switch", title: "Task Switch", description: "Alternate parity and magnitude rules on cue. Reports switch cost, RT variability, accuracy after switches and errors under time pressure.", difficulty: 5, game: "task_switch" },
  { href: "/cognitive/response-conflict", title: "Response Conflict", description: "Flanker and Simon trials in a balanced design. Reports congruency, flanker and Simon effects, commission and omission errors.", difficulty: 5, game: "response_conflict" },
  { href: "/cognitive/pincode", title: "Pincode", description: "Working-memory sequences with eight transformations and an adaptive length staircase; classifies error types.", difficulty: 4, game: "pincode" },
];

export default function CognitivePage() {
  return (
    <>
      <PageHeader title="Cognitive Training" kicker="Compete">
        Reaction times use the browser&apos;s high-resolution clock: stimulus onset is stamped at the first animation frame after
        display and responses use the input event timestamp. Typical display/input latency adds a roughly constant offset, so compare
        your results on the same device. These are training drills, not clinical or psychometric assessments.
      </PageHeader>
      <SectionTitle>Drills</SectionTitle>
      <ModuleGrid modules={modules} />
    </>
  );
}
