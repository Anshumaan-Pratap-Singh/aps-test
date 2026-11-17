import type { ComponentType } from "react";
import * as D from "./developer";
import { LESSON_INDEX } from "./meta";
import * as R from "./researcher";
import * as T from "./trader";

export const LESSON_COMPONENTS: Record<string, ComponentType> = {
  "mental-arithmetic": T.MentalArithmetic, "percentages-fractions": T.PercentagesFractions, "conditional-probability": T.ConditionalProbability,
  "expectation-variance": T.ExpectationVariance, "indicator-variables": T.IndicatorVariables, "optimal-stopping": T.OptimalStopping,
  "order-books": T.OrderBooks, "etf-mechanics": T.EtfMechanics, "market-making": T.MarketMaking, "adverse-selection": T.AdverseSelection,
  "probability-spaces": R.ProbabilitySpaces, "limit-theorems": R.LimitTheorems, "hypothesis-testing": R.HypothesisTesting,
  "markov-chains": R.MarkovChains, martingales: R.Martingales, "brownian-motion": R.BrownianMotion, "ito-lemma": R.ItoLemma,
  regression: R.Regression, "backtest-pitfalls": R.BacktestPitfalls, validation: R.Validation,
  complexity: D.Complexity, "cpp-raii-move": D.CppRaiiMove, "cache-locality": D.CacheLocality, "memory-ordering": D.MemoryOrdering,
  "limit-order-book": D.LimitOrderBook, latency: D.Latency,
};

export function lessonBySlug(slug: string) {
  const meta = LESSON_INDEX[`lesson:${slug}`];
  const Component = LESSON_COMPONENTS[slug];
  return meta && Component ? { ...meta, Component } : undefined;
}
