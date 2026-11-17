import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { PincodeGame } from "@/features/cognitive/CognitiveGames";

export const metadata = { title: "Pincode" };

export default function Page() {
  return (
    <>
      <PageHeader title="Pincode" kicker="Cognitive Training"><Link href="/cognitive" className="text-blue hover:text-cyan">← All drills</Link></PageHeader>
      <PincodeGame />
    </>
  );
}
