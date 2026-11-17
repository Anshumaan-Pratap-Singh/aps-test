import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { FractionTrainer } from "@/features/trainer/FractionTrainer";

export const metadata = { title: "Fractions to Decimals" };

export default function FractionsPage() {
  return (
    <>
      <PageHeader title="Fractions ↔ Decimals ↔ Percentages" kicker="Mental Mathematics">
        Conversion rounds adapt in difficulty; recognition rounds drill the fraction table traders memorise, timing recognition
        speed separately from conversion accuracy. <Link href="/mental-math" className="text-blue hover:text-cyan">← All modules</Link>
      </PageHeader>
      <FractionTrainer />
    </>
  );
}
