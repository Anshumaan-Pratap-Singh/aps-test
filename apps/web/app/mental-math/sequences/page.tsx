import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { SequenceTrainer } from "@/features/trainer/SequenceTrainer";

export const metadata = { title: "Number Sequences" };

export default function SequencesPage() {
  return (
    <>
      <PageHeader title="Sequence Pattern Trainer" kicker="Mental Mathematics">
        Twelve rule families (arithmetic, geometric, polynomial, interleaved, recursive, primes, prime gaps, modular…). Every
        sequence is checked against simpler models; if a simpler rule fits the shown terms but predicts a different next term,
        the sequence is discarded as ambiguous. <Link href="/mental-math" className="text-blue hover:text-cyan">← All modules</Link>
      </PageHeader>
      <SequenceTrainer />
    </>
  );
}
