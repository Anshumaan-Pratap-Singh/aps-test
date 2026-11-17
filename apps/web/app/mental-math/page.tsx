import { ModuleGrid, type ModuleDef } from "@/components/ModuleGrid";
import { PageHeader, SectionTitle } from "@/components/ui";
import { ARITHMETIC } from "@/features/trainer/generators/arithmetic";

export const metadata = { title: "Mental Mathematics" };

const LEVEL: Record<string, number> = { multiplication: 3, division: 3, add_sub: 2, decimal_mult: 4, decimal_div: 4, percent_of: 4, percent_change: 5,
  squares: 3, cubes: 4, sqrt: 3, fraction_arith: 5, approximation: 5, missing_operand: 5, missing_operator: 3, multi_step: 5 };

const core: ModuleDef[] = [
  { href: "/mental-math/train?type=mixed", title: "Speed Arithmetic", description: "Mixed operations at your adaptive level — the core daily drill.", difficulty: 4, trainer: "mixed" },
  { href: "/mental-math/train?type=missing_operand", title: "Missing Operand", description: "Solve for the blank: 66 × ? = 138.6, ?% of 480 = 84.", difficulty: 5, trainer: "missing_operand" },
  { href: "/mental-math/train?type=multiplication", title: "Multiplication", description: ARITHMETIC.multiplication!.description, difficulty: 3, trainer: "multiplication" },
  { href: "/mental-math/train?type=decimal_mult", title: "Decimal Arithmetic", description: "Decimal × and ÷ with place-value control.", difficulty: 4, trainer: "decimal_mult" },
  { href: "/mental-math/train?type=percent_of", title: "Percentage Calculations", description: "Percent of, increases, decreases and % change.", difficulty: 4, trainer: "percent_of" },
  { href: "/mental-math/fractions", title: "Fractions to Decimals", description: "Recognition and conversion: 3/16 → 18.75%, recurring decimals, comparison.", difficulty: 3, trainer: "fraction_conversion" },
  { href: "/mental-math/sequences", title: "Number Sequences", description: "12 pattern families with ambiguity checks, hint ladders and explanations.", difficulty: 4, trainer: "sequence" },
  { href: "/mental-math/train?type=approximation", title: "Estimation", description: "Fast approximate answers inside a stated tolerance.", difficulty: 5, trainer: "approximation" },
  { href: "/mental-math/train?type=mixed&mode=timed", title: "Timed Challenges", description: "60/120-second sprints and personal-best attempts.", difficulty: 5, trainer: "mixed" },
  { href: "/assessments", title: "Assessment Simulations", description: "80 questions in 8 minutes and other unofficial practice formats.", difficulty: 7 },
];

const all: ModuleDef[] = Object.entries(ARITHMETIC).map(([k, v]) => ({
  href: `/mental-math/train?type=${k}`, title: v.title, description: v.description, difficulty: LEVEL[k] ?? 4, trainer: k,
}));

export default function MentalMathPage() {
  return (
    <>
      <PageHeader title="Mental Mathematics" kicker="Practise">
        All questions are generated locally from a seed with exact rational arithmetic, so practice works offline and the
        next question appears without any network round-trip.
      </PageHeader>
      <SectionTitle>Training modules</SectionTitle>
      <ModuleGrid modules={core} />
      <SectionTitle>Every question type</SectionTitle>
      <ModuleGrid modules={all} />
    </>
  );
}
