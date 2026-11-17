/**
 * Exact rational arithmetic on BigInt. Used for answer generation and checking so
 * that e.g. 0.1 + 0.2 === 0.3 and 66 × 2.1 === 138.6 hold exactly.
 */
function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

export class Q {
  readonly n: bigint;
  readonly d: bigint;

  constructor(n: bigint | number, d: bigint | number = 1n) {
    let nn = BigInt(n), dd = BigInt(d);
    if (dd === 0n) throw new RangeError("zero denominator");
    if (dd < 0n) { nn = -nn; dd = -dd; }
    const g = gcd(nn, dd) || 1n;
    this.n = nn / g;
    this.d = dd / g;
  }

  static of(x: number | string | Q): Q {
    if (x instanceof Q) return x;
    const p = parseNumber(String(x));
    if (!p) throw new RangeError(`not a number: ${x}`);
    return p;
  }

  add(o: Q): Q { return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o: Q): Q { return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o: Q): Q { return new Q(this.n * o.n, this.d * o.d); }
  div(o: Q): Q { if (o.n === 0n) throw new RangeError("division by zero"); return new Q(this.n * o.d, this.d * o.n); }
  neg(): Q { return new Q(-this.n, this.d); }
  abs(): Q { return this.n < 0n ? this.neg() : this; }
  eq(o: Q): boolean { return this.n === o.n && this.d === o.d; }
  cmp(o: Q): number { const l = this.n * o.d, r = o.n * this.d; return l < r ? -1 : l > r ? 1 : 0; }
  isInt(): boolean { return this.d === 1n; }
  toNumber(): number { return Number(this.n) / Number(this.d); }

  isTerminating(): boolean {
    let d = this.d;
    while (d % 2n === 0n) d /= 2n;
    while (d % 5n === 0n) d /= 5n;
    return d === 1n;
  }

  /** Exact decimal string if terminating (≤ maxDp places), else "n/d". */
  toString(maxDp = 8): string {
    if (this.d === 1n) return this.n.toString();
    if (!this.isTerminating()) return `${this.n}/${this.d}`;
    let dp = 0, scale = 1n;
    while ((this.n * scale) % this.d !== 0n) { scale *= 10n; dp++; if (dp > maxDp) return `${this.n}/${this.d}`; }
    const v = (this.n * scale) / this.d;
    const neg = v < 0n;
    const s = (neg ? -v : v).toString().padStart(dp + 1, "0");
    return `${neg ? "-" : ""}${s.slice(0, s.length - dp)}.${s.slice(s.length - dp)}`;
  }

  toFixed(dp: number): string { return this.toNumber().toFixed(dp); }
}

const NUM_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

function parseDecimal(s: string): Q | null {
  if (!NUM_RE.test(s)) return null;
  const neg = s.startsWith("-");
  const body = s.replace(/^[+-]/, "");
  const [ip = "0", fp = ""] = body.split(".");
  const n = BigInt((ip || "0") + fp) * (neg ? -1n : 1n);
  return new Q(n, 10n ** BigInt(fp.length));
}

/** Parse user input: integers, decimals, "a/b", optional trailing %, commas/spaces ignored. */
export function parseNumber(text: string): Q | null {
  let s = text.trim().replace(/[,\s]/g, "").replace(/−/g, "-");
  if (s.endsWith("%")) s = s.slice(0, -1);
  if (!s) return null;
  if (s.includes("/")) {
    const parts = s.split("/");
    if (parts.length !== 2) return null;
    const a = parseDecimal(parts[0] as string), b = parseDecimal(parts[1] as string);
    if (!a || !b || b.n === 0n) return null;
    return a.div(b);
  }
  return parseDecimal(s);
}

export const q = (n: number | bigint, d: number | bigint = 1) => new Q(n, d);
/** Exact rational from a decimal literal string or finite number (via its shortest repr). */
export const dec = (x: string | number) => {
  const p = parseNumber(typeof x === "number" ? String(x) : x);
  if (!p) throw new RangeError(`bad decimal ${x}`);
  return p;
};
