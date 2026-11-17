import { ModuleGrid, type ModuleDef } from "@/components/ModuleGrid";
import { PageHeader, SectionTitle } from "@/components/ui";

export const metadata = { title: "Quantitative Research" };

const modules: ModuleDef[] = [
  { href: "/research/lab", title: "Research Laboratory", description: "Inspect synthetic data, pick a feature, split chronologically, fit OLS, evaluate out of sample, add costs, detect leakage and data-mining, and judge credibility.", difficulty: 6 },
  { href: "/learn/backtest-pitfalls", title: "Backtest pitfalls", description: "Look-ahead, leakage, survivorship, costs and capacity.", difficulty: 5, lesson: "lesson:backtest-pitfalls" },
  { href: "/learn/validation", title: "Walk-forward, purging & embargo", description: "Time-series validation done properly; calibration.", difficulty: 6, lesson: "lesson:validation" },
  { href: "/learn/hypothesis-testing", title: "Multiple testing", description: "FWER, FDR and selection bias in strategy search.", difficulty: 5, lesson: "lesson:hypothesis-testing" },
  { href: "/learn/regression", title: "Regression & regularisation", description: "OLS, ridge, lasso, bias–variance.", difficulty: 5, lesson: "lesson:regression" },
  { href: "/learn/ito-lemma", title: "Itô's lemma & GBM", description: "Stochastic calculus foundations.", difficulty: 8, lesson: "lesson:ito-lemma" },
  { title: "Walk-forward refit mode", description: "Rolling re-estimation inside the lab with purged/embargoed windows.", difficulty: 7, status: "planned" },
  { title: "Tree ensembles & feature importance", description: "Random forests / boosting with stability analysis.", difficulty: 7, status: "planned" },
];

export default function ResearchPage() {
  return (
    <>
      <PageHeader title="Quantitative Research" kicker="Research">
        The lab teaches how not to fool yourself. Datasets are synthetic with a known data-generating process, so the lab can tell you
        whether your conclusion was right.
      </PageHeader>
      <SectionTitle>Modules</SectionTitle>
      <ModuleGrid modules={modules} />
    </>
  );
}
