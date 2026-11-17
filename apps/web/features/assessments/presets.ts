export interface Preset {
  key: string; title: string; trainer: string; difficulty: number; questions: number; seconds: number; description: string; serverOnly?: boolean;
}

/** Unofficial practice formats. None replicates any firm's proprietary test. */
export const PRESETS: Preset[] = [
  { key: "speed80", title: "80 in 8", trainer: "mixed", difficulty: 6, questions: 80, seconds: 480, description: "80 mixed arithmetic questions in 8 minutes — inspired by common trading aptitude formats." },
  { key: "seq20", title: "Sequences 20", trainer: "sequence", difficulty: 6, questions: 20, seconds: 600, description: "20 number sequences in 10 minutes." },
  { key: "frac40", title: "Fractions 40", trainer: "fraction_conversion", difficulty: 5, questions: 40, seconds: 300, description: "40 fraction/decimal/percentage conversions in 5 minutes." },
  { key: "missing30", title: "Missing operand 30", trainer: "missing_operand", difficulty: 6, questions: 30, seconds: 300, description: "30 missing-operand equations in 5 minutes." },
  { key: "prob10", title: "Probability 10", trainer: "probability", difficulty: 5, questions: 10, seconds: 900, description: "10 probability / EV problems in 15 minutes.", serverOnly: true },
  { key: "olymp5", title: "Competition 5", trainer: "olympiad", difficulty: 6, questions: 5, seconds: 1200, description: "5 competition-style problems in 20 minutes.", serverOnly: true },
];
