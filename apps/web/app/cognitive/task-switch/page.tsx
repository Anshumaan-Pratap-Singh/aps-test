import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { TaskSwitchGame } from "@/features/cognitive/CognitiveGames";

export const metadata = { title: "Task Switch" };

export default function Page() {
  return (
    <>
      <PageHeader title="Task Switch" kicker="Cognitive Training"><Link href="/cognitive" className="text-blue hover:text-cyan">← All drills</Link></PageHeader>
      <TaskSwitchGame />
    </>
  );
}
