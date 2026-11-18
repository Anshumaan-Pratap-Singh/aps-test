"use client";

import { useSearchParams } from "next/navigation";
import { ARITHMETIC } from "@/features/trainer/generators/arithmetic";
import { TrainerSetup, type ModeKey } from "@/features/trainer/TrainerSetup";

const CHOICES = [{ key: "mixed", label: "Mixed" }, ...Object.entries(ARITHMETIC).map(([key, v]) => ({ key, label: v.title }))];

/** Reads ?type= and ?mode= in the browser so the page can be statically exported. */
export function TrainEntry() {
  const sp = useSearchParams();
  const t = sp.get("type");
  const type = t && (t === "mixed" || t in ARITHMETIC) ? t : "mixed";
  const mode: ModeKey = sp.get("mode") === "timed" ? "timed60" : "untimed";
  return <TrainerSetup key={type} trainer={type} title="Configure session" initialMode={mode} typeChoices={CHOICES} />;
}
