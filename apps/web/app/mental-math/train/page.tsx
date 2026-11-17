import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { ARITHMETIC } from "@/features/trainer/generators/arithmetic";
import { TrainerSetup, type ModeKey } from "@/features/trainer/TrainerSetup";

export const metadata = { title: "Speed Trainer" };

const CHOICES = [{ key: "mixed", label: "Mixed" }, ...Object.entries(ARITHMETIC).map(([key, v]) => ({ key, label: v.title }))];

export default async function TrainPage({ searchParams }: { searchParams: Promise<{ type?: string; mode?: string }> }) {
  const sp = await searchParams;
  const type = sp.type && (sp.type === "mixed" || sp.type in ARITHMETIC) ? sp.type : "mixed";
  const mode: ModeKey = sp.mode === "timed" ? "timed60" : "untimed";
  return (
    <>
      <PageHeader title="Speed Arithmetic Console" kicker="Mental Mathematics">
        <Link href="/mental-math" className="text-blue hover:text-cyan">← All modules</Link>
      </PageHeader>
      <TrainerSetup key={type} trainer={type} title="Configure session" initialMode={mode} typeChoices={CHOICES} />
    </>
  );
}
