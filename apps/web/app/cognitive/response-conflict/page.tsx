import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { ConflictGame } from "@/features/cognitive/CognitiveGames";

export const metadata = { title: "Response Conflict" };

export default function Page() {
  return (
    <>
      <PageHeader title="Response Conflict" kicker="Cognitive Training"><Link href="/cognitive" className="text-blue hover:text-cyan">← All drills</Link></PageHeader>
      <ConflictGame />
    </>
  );
}
