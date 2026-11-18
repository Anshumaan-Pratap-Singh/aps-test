import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { TrainEntry } from "./TrainEntry";

export const metadata = { title: "Speed Trainer" };

export default function TrainPage() {
  return (
    <>
      <PageHeader title="Speed Arithmetic Console" kicker="Mental Mathematics">
        <Link href="/mental-math" className="text-blue hover:text-cyan">← All modules</Link>
      </PageHeader>
      <Suspense fallback={null}>
        <TrainEntry />
      </Suspense>
    </>
  );
}
