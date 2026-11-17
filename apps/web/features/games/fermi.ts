/**
 * Fermi estimation. Reference values are approximate figures from standard
 * public references (physical constants exact or to stated precision; economic
 * and demographic values circa 2023). Each item lists a defensible estimation chain.
 *
 * Scoring: interval score (Gneiting & Raftery 2007) on log10 values — a proper
 * scoring rule, so over-wide intervals are penalised by their width and misses by
 * (2/α) × distance. composite = 100·exp(−IS/2)·speed, speed ∈ [0.8, 1].
 */
export interface FermiItem { id: string; question: string; truth: number; unit: string; assumptions: string[]; category: string }

export const FERMI: FermiItem[] = [
  { id: "sec-year", question: "How many seconds are in a year?", truth: 31_557_600, unit: "s", category: "physical", assumptions: ["365.25 days × 24 h × 3600 s ≈ 3.16 × 10⁷ s", "Mnemonic: π × 10⁷"] },
  { id: "world-pop", question: "World population (2023)?", truth: 8.0e9, unit: "people", category: "population", assumptions: ["≈ 8 billion (UN, Nov 2022 crossing)"] },
  { id: "us-pop", question: "Population of the United States (2023)?", truth: 3.35e8, unit: "people", category: "population", assumptions: ["≈ 335 million"] },
  { id: "earth-circ", question: "Circumference of the Earth at the equator?", truth: 40_075, unit: "km", category: "physical", assumptions: ["Metre was originally 1/10⁷ of pole-to-equator distance → 4 × 10⁴ km"] },
  { id: "moon-dist", question: "Average distance from Earth to the Moon?", truth: 384_400, unit: "km", category: "physical", assumptions: ["Light takes ≈1.3 s; 1.3 × 3 × 10⁵ km/s ≈ 3.8 × 10⁵ km"] },
  { id: "sun-dist", question: "Average distance from Earth to the Sun?", truth: 1.496e8, unit: "km", category: "physical", assumptions: ["Light takes ≈ 8.3 min ≈ 500 s; 500 × 3 × 10⁵ km/s = 1.5 × 10⁸ km"] },
  { id: "everest", question: "Height of Mount Everest?", truth: 8_849, unit: "m", category: "physical", assumptions: ["Cruising altitude of jets ≈ 10–11 km is just above it"] },
  { id: "pool", question: "Litres of water in an Olympic swimming pool (50 m × 25 m × 2 m minimum depth)?", truth: 2.5e6, unit: "L", category: "physical", assumptions: ["50 × 25 × 2 = 2500 m³; 1 m³ = 1000 L"] },
  { id: "heartbeats", question: "Heartbeats in an 80-year human life at 70 bpm?", truth: 70 * 60 * 24 * 365.25 * 80, unit: "beats", category: "physical", assumptions: ["70/min × 1440 min/day × 365 days × 80 years ≈ 2.9 × 10⁹"] },
  { id: "us-gdp", question: "US nominal GDP (2023)?", truth: 2.7e13, unit: "USD", category: "economic", assumptions: ["≈ 335 M people × ≈ $80k per capita ≈ $27 trillion"] },
  { id: "world-gdp", question: "World nominal GDP (2023)?", truth: 1.05e14, unit: "USD", category: "economic", assumptions: ["8 bn people × ≈ $13k per capita ≈ $105 trillion"] },
  { id: "oil", question: "Global oil consumption per day (2023)?", truth: 1.0e8, unit: "barrels", category: "energy", assumptions: ["≈ 100 million barrels/day (IEA)", "≈ 0.0125 barrels/person/day × 8 bn"] },
  { id: "us-elec", question: "Average annual electricity use of a US household?", truth: 10_500, unit: "kWh", category: "energy", assumptions: ["≈ 1.2 kW average draw × 8766 h ≈ 10,500 kWh (EIA ≈ 10.5–10.8 MWh)"] },
  { id: "flights", question: "Commercial flights worldwide per day (pre-2020 typical)?", truth: 1.0e5, unit: "flights", category: "transport", assumptions: ["≈ 4.5 bn passengers/year ÷ 365 ÷ ≈ 120 passengers/flight ≈ 10⁵"] },
  { id: "light", question: "Speed of light?", truth: 299_792, unit: "km/s", category: "physical", assumptions: ["Exactly 299,792.458 km/s by definition of the metre"] },
  { id: "sound", question: "Speed of sound in air at 20 °C?", truth: 343, unit: "m/s", category: "physical", assumptions: ["Thunder ≈ 3 s per km → ≈ 333 m/s"] },
  { id: "nyc-pop", question: "Population of New York City (2023)?", truth: 8.3e6, unit: "people", category: "population", assumptions: ["≈ 8.3 million in the five boroughs"] },
  { id: "uk-pop", question: "Population of the United Kingdom (2023)?", truth: 6.8e7, unit: "people", category: "population", assumptions: ["≈ 68 million"] },
  { id: "earth-mass", question: "Mass of the Earth?", truth: 5.97e24, unit: "kg", category: "physical", assumptions: ["Volume (4/3)π(6.4×10⁶ m)³ ≈ 1.1×10²¹ m³ × mean density ≈ 5.5×10³ kg/m³"] },
  { id: "minutes-week", question: "Minutes in a week?", truth: 10_080, unit: "min", category: "physical", assumptions: ["7 × 24 × 60"] },
  { id: "747", question: "Maximum take-off weight of a Boeing 747-400?", truth: 396_890, unit: "kg", category: "transport", assumptions: ["≈ 400 tonnes: ≈ 180 t empty + ≈ 170 t fuel + payload"] },
  { id: "cells", question: "Number of human cells in an adult body (estimate)?", truth: 3.7e13, unit: "cells", category: "physical", assumptions: ["Bianconi et al. (2013) ≈ 3.7 × 10¹³; red blood cells dominate the count"] },
];

export function intervalScore(lo: number, hi: number, x: number, alpha: number): number {
  if (!(alpha > 0 && alpha < 1)) throw new RangeError("alpha in (0,1)");
  if (hi < lo) throw new RangeError("upper < lower");
  let s = hi - lo;
  if (x < lo) s += (2 / alpha) * (lo - x);
  else if (x > hi) s += (2 / alpha) * (x - hi);
  return s;
}

export function fermiScore(point: number, lo: number, hi: number, truth: number, confidence: number, seconds: number, limit = 60) {
  if ([point, lo, hi, truth].some((v) => !(v > 0))) throw new RangeError("values must be positive");
  const L = Math.log10;
  const is = intervalScore(L(lo), L(hi), L(truth), 1 - confidence);
  const speed = Math.max(0.8, 1 - 0.2 * Math.min(1, seconds / limit));
  return { intervalScoreLog10: is, pointLog10Error: Math.abs(L(point) - L(truth)), covered: lo <= truth && truth <= hi, widthOrders: L(hi) - L(lo), composite: 100 * Math.exp(-is / 2) * speed };
}

/** Parse "3e6", "3,000,000", "3.2 million", "40k", "1.5bn". */
export function parseMagnitude(text: string): number | null {
  const s = text.trim().toLowerCase().replace(/,/g, "").replace(/\s+/g, " ");
  const m = s.match(/^([0-9]*\.?[0-9]+(?:e[+-]?\d+)?)\s*(k|thousand|m|mn|million|b|bn|billion|t|tn|trillion)?$/);
  if (!m) return null;
  const mult: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9, t: 1e12, tn: 1e12, trillion: 1e12 };
  const v = Number(m[1]) * (m[2] ? (mult[m[2]] as number) : 1);
  return Number.isFinite(v) && v > 0 ? v : null;
}
