import { M, MD } from "@/components/Math";
import { Callout, Check } from "./kit";

const t = String.raw;

export function MentalArithmetic() {
  const L = "lesson:mental-arithmetic";
  return (
    <>
      <p>Speed comes from <strong>restructuring</strong> a calculation into steps you can hold in working memory, not from computing faster. Every technique below is an algebraic identity.</p>
      <h2>Distribution</h2>
      <p>Split one factor at a round number: <M>{t`47 \times 8 = 40\times 8 + 7 \times 8 = 320 + 56 = 376`}</M>. For factors near a round number, subtract instead: <M>{t`49 \times 6 = 50\times6 - 6 = 294`}</M>.</p>
      <h2>Difference of squares</h2>
      <p>When two factors are symmetric about a round number <M>m</M>:</p>
      <MD>{t`(m-k)(m+k) = m^2 - k^2 \quad\Rightarrow\quad 48 \times 52 = 2500 - 4 = 2496.`}</MD>
      <h2>Squaring near a base</h2>
      <MD>{t`(m+k)^2 = m^2 + 2mk + k^2 \quad\Rightarrow\quad 67^2 = 4900 - 2\cdot70\cdot3 + 9 = 4489.`}</MD>
      <h2>Decimal place control</h2>
      <p>Multiply as integers and restore the scale: <M>{t`0.12 \times 3.5 = (12 \times 35)\times 10^{-3} = 0.42`}</M>. For division, scale numerator and denominator together until the divisor is an integer: <M>{t`3.6 \div 0.12 = 360 \div 12 = 30`}</M>.</p>
      <h2>Missing operands</h2>
      <p>Treat <M>{t`66 \times ? = 138.6`}</M> as a division, but estimate first: <M>{t`66 \times 2 = 132`}</M>, remainder <M>6.6 = 66 \times 0.1</M>, so <M>?=2.1</M>. Estimating the integer part before refining prevents order-of-magnitude errors, the most expensive mistake under time pressure.</p>
      <Callout title="Drill discipline">Accuracy first, then speed. The adaptive trainer only raises your level after 20 consecutive attempts at ≥90% accuracy with a median response under the level's target time.</Callout>
      <Check lesson={L} id="c1" prompt="Compute $53 \times 47$ using a difference of squares." answer="2491" explanation="$(50+3)(50-3) = 2500 - 9 = 2491$." />
      <Check lesson={L} id="c2" prompt="$4.8 \div 0.016 = ?$" answer="300" explanation="Scale by 1000: $4800 \div 16 = 300$." />
      <Check lesson={L} id="c3" prompt="$? \times 24 = 816$" answer="34" explanation="$24 \times 30 = 720$, remainder $96 = 24 \times 4$." />
    </>
  );
}

export function PercentagesFractions() {
  const L = "lesson:percentages-fractions";
  return (
    <>
      <p>Percentages are fractions with denominator 100. Fluency means moving between the three representations instantly.</p>
      <h2>Composition</h2>
      <p>Build awkward percentages from easy ones: <M>{t`17.5\% = 10\% + 5\% + 2.5\%`}</M>, so <M>{t`17.5\%\text{ of }480 = 48 + 24 + 12 = 84`}</M>.</p>
      <h2>Commutativity</h2>
      <p><M>{t`x\%\text{ of }y = y\%\text{ of }x`}</M> because both equal <M>{t`xy/100`}</M>. Hence <M>{t`8\%\text{ of }25 = 25\%\text{ of }8 = 2`}</M>.</p>
      <h2>Percentage change is asymmetric</h2>
      <p>A rise of <M>p</M>% followed by a fall of <M>p</M>% leaves <M>{t`(1+p)(1-p) = 1-p^2`}</M> of the original. To undo a 20% fall you need a 25% rise: <M>{t`1/0.8 = 1.25`}</M>.</p>
      <h2>Terminating decimals</h2>
      <p>A reduced fraction <M>{t`a/b`}</M> has a terminating decimal expansion iff <M>b</M> has no prime factors other than 2 and 5. Otherwise it recurs with period dividing the multiplicative order of 10 modulo the remaining factor — e.g. <M>{t`1/7 = 0.\overline{142857}`}</M>, period 6.</p>
      <MD>{t`\tfrac18 = 12.5\%,\quad \tfrac{3}{16} = 18.75\%,\quad \tfrac{7}{40} = 17.5\%,\quad \tfrac16 = 16.\overline{6}\%,\quad \tfrac{1}{9} = 11.\overline{1}\%.`}</MD>
      <Check lesson={L} id="c1" prompt="A price falls 20% and then rises 20%. Net percentage change?" answer="-4" explanation="$0.8 \times 1.2 = 0.96$, i.e. −4%." />
      <Check lesson={L} id="c2" prompt="$\frac{5}{16}$ as a percentage?" answer="31.25" explanation="$1/16 = 6.25\%$, times 5." />
      <Check lesson={L} id="c3" prompt="Does $\frac{7}{56}$ have a terminating decimal?" choices={["Yes", "No"]} answer="Yes" explanation="$7/56 = 1/8$ after reducing; 8 = 2³." />
    </>
  );
}

export function ConditionalProbability() {
  const L = "lesson:conditional-probability";
  return (
    <>
      <p>For events with <M>{t`P(B) > 0`}</M>, the conditional probability of <M>A</M> given <M>B</M> is</p>
      <MD>{t`P(A \mid B) = \frac{P(A \cap B)}{P(B)}.`}</MD>
      <p>Conditioning restricts the sample space to <M>B</M> and renormalises. Independence means <M>{t`P(A\cap B) = P(A)P(B)`}</M>, equivalently <M>{t`P(A\mid B) = P(A)`}</M>.</p>
      <h2>Law of total probability</h2>
      <p>If <M>{t`B_1,\dots,B_n`}</M> partition the sample space,</p>
      <MD>{t`P(A) = \sum_{i=1}^n P(A \mid B_i)\,P(B_i).`}</MD>
      <h2>Bayes&apos; theorem</h2>
      <MD>{t`P(B_j \mid A) = \frac{P(A\mid B_j)P(B_j)}{\sum_i P(A\mid B_i)P(B_i)}.`}</MD>
      <p>In odds form, which is how traders update on news: <M>{t`\text{posterior odds} = \text{prior odds} \times \text{likelihood ratio}`}</M>, where the likelihood ratio is <M>{t`P(\text{evidence}\mid H)/P(\text{evidence}\mid \neg H)`}</M>. Taking logs makes independent pieces of evidence additive.</p>
      <h2>Worked example: the base-rate trap</h2>
      <p>Prevalence 1%, sensitivity 99%, false-positive rate 5%. Prior odds <M>1:99</M>, likelihood ratio <M>{t`0.99/0.05 = 19.8`}</M>, posterior odds <M>{t`19.8 : 99`}</M>, so <M>{t`P(D\mid +) = 19.8/118.8 = 1/6`}</M>. A positive test leaves the condition unlikely because false positives from the large healthy population dominate.</p>
      <Callout title="Assumptions">Bayes needs the likelihoods to be correct and the hypotheses to be exhaustive. In markets, “evidence” is often correlated with what others already know — double-counting it is a classic overreaction.</Callout>
      <Check lesson={L} id="c1" prompt="Two fair dice. Given the sum is 8, what is the probability that both show 4?" answer="1/5" explanation="Sum 8 has outcomes (2,6),(3,5),(4,4),(5,3),(6,2): 1 of 5." />
      <Check lesson={L} id="c2" prompt="Prior 20%, a signal with likelihood ratio 4 arrives. Posterior probability?" answer="1/2" explanation="Prior odds 1:4, times 4 gives 1:1." />
    </>
  );
}

export function ExpectationVariance() {
  const L = "lesson:expectation-variance";
  return (
    <>
      <p>For a discrete random variable, <M>{t`\mathbb{E}[X] = \sum_x x\,P(X=x)`}</M>. Expectation is <strong>linear</strong> for any random variables, dependent or not:</p>
      <MD>{t`\mathbb{E}[aX + bY] = a\,\mathbb{E}[X] + b\,\mathbb{E}[Y].`}</MD>
      <h2>Variance and covariance</h2>
      <MD>{t`\operatorname{Var}(X) = \mathbb{E}[(X-\mu)^2] = \mathbb{E}[X^2] - \mu^2,\qquad \operatorname{Cov}(X,Y) = \mathbb{E}[XY] - \mathbb{E}[X]\mathbb{E}[Y].`}</MD>
      <MD>{t`\operatorname{Var}(X+Y) = \operatorname{Var}X + \operatorname{Var}Y + 2\operatorname{Cov}(X,Y).`}</MD>
      <p>One fair die: <M>{t`\mathbb{E}X = 7/2`}</M>, <M>{t`\mathbb{E}X^2 = 91/6`}</M>, so <M>{t`\operatorname{Var}X = 91/6 - 49/4 = 35/12`}</M>. For a sum of <M>n</M> independent dice the variance is <M>{t`35n/12`}</M>; the standard deviation grows like <M>{t`\sqrt n`}</M>, which is why diversification works.</p>
      <h2>Tail-sum formula</h2>
      <p>For non-negative integer <M>X</M>: <M>{t`\mathbb{E}X = \sum_{k\ge1} P(X\ge k)`}</M>. For the maximum of two dice, <M>{t`P(\max\ge k) = 1 - ((k-1)/6)^2`}</M>, giving <M>{t`\mathbb{E}[\max] = 161/36`}</M>.</p>
      <h2>Conditional expectation</h2>
      <p>The tower property <M>{t`\mathbb{E}[X] = \mathbb{E}[\mathbb{E}[X\mid Y]]`}</M> lets you condition on the first step of a process — the workhorse of interview recursions.</p>
      <Check lesson={L} id="c1" prompt="Var of the sum of 4 fair dice?" answer="35/3" explanation="$4 \times 35/12 = 35/3$." />
      <Check lesson={L} id="c2" prompt="$\operatorname{Var}(X)=4,\ \operatorname{Var}(Y)=9,\ \operatorname{Cov}(X,Y)=-3$. $\operatorname{Var}(X+Y)=?$" answer="7" explanation="$4 + 9 - 6 = 7$." />
    </>
  );
}

export function IndicatorVariables() {
  const L = "lesson:indicator-variables";
  return (
    <>
      <p>An indicator <M>{t`I_A`}</M> equals 1 if <M>A</M> occurs and 0 otherwise, so <M>{t`\mathbb{E}[I_A] = P(A)`}</M>. Writing a count as a sum of indicators and applying linearity sidesteps dependence entirely.</p>
      <h2>Fixed points of a permutation</h2>
      <p>Let <M>{t`I_i = 1`}</M> if item <M>i</M> stays in place. Then <M>{t`P(I_i = 1) = 1/n`}</M> and the expected number of fixed points is <M>{t`n \cdot 1/n = 1`}</M>, for every <M>n</M>, even though the <M>{t`I_i`}</M> are dependent.</p>
      <h2>Distinct faces</h2>
      <p>Roll <M>n</M> dice; let <M>{t`J_k = 1`}</M> if face <M>k</M> appears. <M>{t`P(J_k=1) = 1-(5/6)^n`}</M>, hence <M>{t`\mathbb{E}[\#\text{distinct}] = 6(1-(5/6)^n)`}</M>.</p>
      <h2>Variance needs pairs</h2>
      <MD>{t`\operatorname{Var}\Big(\sum_i I_i\Big) = \sum_i \operatorname{Var}I_i + \sum_{i\ne j}\operatorname{Cov}(I_i,I_j).`}</MD>
      <p>For fixed points, <M>{t`P(I_i I_j=1)=\frac{1}{n(n-1)}`}</M>, so the covariance terms sum to <M>{t`n(n-1)\big(\tfrac{1}{n(n-1)}-\tfrac1{n^2}\big) = \tfrac1n`}</M> and the variance is <M>{t`(1-\tfrac1n) + \tfrac1n = 1`}</M>.</p>
      <Check lesson={L} id="c1" prompt="Expected number of distinct faces when rolling 2 dice?" answer="11/6" explanation="$6(1 - 25/36) = 66/36 = 11/6$." />
      <Check lesson={L} id="c2" prompt="10 people throw hats in a pile and each draws one at random. Expected number with their own hat?" answer="1" explanation="Each has probability 1/10; ten indicators sum to 1." />
    </>
  );
}

export function OptimalStopping() {
  const L = "lesson:optimal-stopping";
  return (
    <>
      <p>Optimal stopping problems are solved by <strong>backward induction</strong>: the value of continuing is computed first, then you stop exactly when the current reward exceeds it.</p>
      <h2>Die with one re-roll</h2>
      <p>With no re-rolls left the value is <M>{t`V_0 = 7/2`}</M>. With one re-roll, keep a roll <M>x</M> iff <M>{t`x > V_0`}</M>, i.e. keep 4, 5, 6:</p>
      <MD>{t`V_1 = \tfrac16(4+5+6) + \tfrac36 \cdot \tfrac72 = \tfrac{15}{6} + \tfrac74 = \tfrac{17}{4}.`}</MD>
      <p>In general <M>{t`V_{k+1} = \mathbb{E}[\max(X, V_k)]`}</M> — the Bellman equation.</p>
      <h2>Recursion via first-step analysis</h2>
      <p>Expected flips to see HH: let <M>a</M> be the expectation from scratch and <M>b</M> after one H. Then <M>{t`a = 1 + \tfrac12 b + \tfrac12 a`}</M> and <M>{t`b = 1 + \tfrac12\cdot 0 + \tfrac12 a`}</M>, giving <M>a=6</M>.</p>
      <h2>Secretary problem</h2>
      <p>Observing <M>n</M> candidates in random order and committing irrevocably, the rule “reject the first <M>{t`n/e`}</M>, then take the first record” succeeds with probability tending to <M>{t`1/e\approx 0.368`}</M>.</p>
      <Check lesson={L} id="c1" prompt="Value of a die game with up to two re-rolls (keep last)?" answer="14/3" explanation="$V_2 = \mathbb{E}\max(X, 17/4)$: keep 5,6 → $(5+6)/6 + (4/6)(17/4) = 11/6 + 17/6 = 14/3$." />
      <Check lesson={L} id="c2" prompt="Expected number of fair-coin flips to see HT?" answer="4" explanation="Wait for H (2 flips), then for T (2 flips)." />
    </>
  );
}

export function OrderBooks() {
  const L = "lesson:order-books";
  return (
    <>
      <p>A <strong>limit order book</strong> lists resting buy orders (bids) and sell orders (asks) by price. The best bid <M>{t`b`}</M> and best ask <M>{t`a`}</M> define the spread <M>{t`a - b`}</M> and mid <M>{t`(a+b)/2`}</M>.</p>
      <h2>Order types</h2>
      <ul>
        <li><strong>Limit order</strong>: rests at a price; provides liquidity; may never fill.</li>
        <li><strong>Market order</strong>: executes immediately against resting liquidity; pays the spread and possibly walks the book.</li>
        <li><strong>Price-time priority</strong>: better price first; at equal price, earlier orders first.</li>
      </ul>
      <h2>Cost of immediacy</h2>
      <p>A round trip by market orders costs the spread plus impact. If you buy 3,000 shares against asks of 1,000 @ 10.02, 1,000 @ 10.03, 2,000 @ 10.05, your average price is <M>{t`(10.02 + 10.03 + 10.05)/3 = 10.0333`}</M>, i.e. 3.33¢ above a 10.00 mid.</p>
      <h2>Liquidity and microprice</h2>
      <p>Queue imbalance predicts short-term moves. The size-weighted microprice <M>{t`\frac{a\,Q_b + b\,Q_a}{Q_a + Q_b}`}</M> leans toward the side with less resting size.</p>
      <Check lesson={L} id="c1" prompt="Bid 99.98 × 500, ask 100.02 × 1500. Microprice?" answer="99.99" explanation="$(100.02 \cdot 500 + 99.98 \cdot 1500)/2000 = 99.99$." />
      <Check lesson={L} id="c2" prompt="Under price-time priority, which fills first at the same price: an order placed at 09:30:01 or one at 09:30:00?" choices={["09:30:00", "09:30:01"]} answer="09:30:00" explanation="Earlier time has priority at equal price." />
    </>
  );
}

export function EtfMechanics() {
  const L = "lesson:etf-mechanics";
  return (
    <>
      <p>An ETF share represents a basket. Its <strong>NAV</strong> per share is the basket value: <M>{t`\text{NAV} = \sum_i w_i P_i X_i`}</M>, with <M>{t`w_i`}</M> shares of stock <M>i</M> per ETF share, prices <M>{t`P_i`}</M> and FX rates <M>{t`X_i`}</M>.</p>
      <h2>Creation and redemption</h2>
      <p>Authorised participants exchange baskets for ETF units (creation) or units for baskets (redemption). This keeps the ETF price near NAV: if it trades rich, create and sell ETF; if cheap, buy ETF and redeem.</p>
      <h2>Executable edge</h2>
      <p>Gross mispricing is not profit. When selling a rich ETF you sell at the ETF <em>bid</em> and buy the basket at constituent <em>asks</em>:</p>
      <MD>{t`\text{edge}_{\text{sell ETF}} = \text{ETF}_{\text{bid}} - \text{NAV}_{\text{ask}} - c,\qquad \text{edge}_{\text{buy ETF}} = \text{NAV}_{\text{bid}} - \text{ETF}_{\text{ask}} - c,`}</MD>
      <p>where <M>c</M> collects fees, creation costs and slippage. Trade only when an edge is positive. Executing one leg before the other exposes you to <strong>legging risk</strong>.</p>
      <Check lesson={L} id="c1" prompt="NAV ask = 100.00, ETF bid = 100.12, costs 0.05/share. Edge from selling ETF/buying basket?" answer="0.07" explanation="$100.12 - 100.00 - 0.05$." />
    </>
  );
}

export function MarketMaking() {
  const L = "lesson:market-making";
  return (
    <>
      <p>A market maker posts a bid and an ask around an estimate of fair value and earns the spread from uninformed flow, while managing inventory and avoiding informed flow.</p>
      <h2>The quoting model used in APS</h2>
      <MD>{t`\begin{aligned} h &= \max\big(\text{tick},\; h_0 + k_\sigma \sigma + k_\tau \tau \sigma\big) \\ s &= \gamma\, q\, \sigma^2 \\ m &= \hat V - s,\qquad \text{bid} = \lfloor m - h \rfloor_{\text{tick}},\quad \text{ask} = \lceil m + h \rceil_{\text{tick}} \end{aligned}`}</MD>
      <p>Here <M>{t`\hat V`}</M> is fair value, <M>σ</M> uncertainty, <M>τ∈[0,1]</M> order-flow toxicity, <M>q</M> inventory and <M>γ</M> risk aversion. The skew <M>s</M> is the reservation-price shift of Avellaneda–Stoikov: holding <M>q &gt; 0</M>, you lower both quotes, making buyers more likely to take your inventory and sellers less likely to add to it.</p>
      <h2>Why not just trade a lot?</h2>
      <p>Each fill earns roughly the half-spread relative to fair value, but inventory exposes you to price moves of size σ. Expected P&amp;L per round trip is about <M>2h</M>; the variance of inventory P&amp;L grows like <M>{t`q^2\sigma^2`}</M>. Widen when σ or τ rise; skew when <M>|q|</M> grows; stop quoting a side at the risk limit.</p>
      <h2>Realised vs mark-to-market P&amp;L</h2>
      <p>Realised P&amp;L locks in gains on closed units (average-cost accounting). Mark-to-market adds <M>{t`q(\text{mark} - \bar c)`}</M> on open inventory. Total P&amp;L = cash + <M>q</M>·mark.</p>
      <Check lesson={L} id="c1" prompt="Fair 100, half-spread 0.40, γ = 0.1, σ = 2, inventory +5. Bid (tick 0.01)?" answer="97.6" explanation="Skew $= 0.1 \cdot 5 \cdot 4 = 2$, mid 98, bid $98 - 0.40 = 97.60$." />
      <Check lesson={L} id="c2" prompt="Bought 3 @ 10 and 1 @ 11, then sold 2 @ 12. Realised P&L?" answer="3.5" explanation="Average cost 10.25; $2 \times (12 - 10.25) = 3.5$." />
    </>
  );
}

export function AdverseSelection() {
  const L = "lesson:adverse-selection";
  return (
    <>
      <p><strong>Adverse selection</strong>: the trades you get are disproportionately the ones you should not have wanted. Informed traders hit your bid when value is falling and lift your ask when it is rising.</p>
      <h2>Glosten–Milgrom intuition</h2>
      <p>Suppose value is <M>{t`V_H`}</M> or <M>{t`V_L`}</M> with equal probability, and a fraction <M>μ</M> of traders know it. A competitive ask equals the expected value <em>given a buy</em>:</p>
      <MD>{t`a = \mathbb{E}[V\mid\text{buy}] = \tfrac12 (V_H + V_L) + \tfrac{\mu}{2}(V_H - V_L).`}</MD>
      <p>The spread <M>{t`a - b = \mu(V_H - V_L)`}</M> exists purely to break even against informed flow.</p>
      <h2>Measuring it: markouts</h2>
      <p>After each fill, record fair value some time later. A maker buy at <M>p</M> with later fair <M>{t`f'`}</M> has markout <M>{t`f' - p`}</M>; average markouts below zero mean you are being picked off. APS reports this as the adverse-selection metric in market games.</p>
      <Check lesson={L} id="c1" prompt="$V_H=110$, $V_L=90$, 25% informed. Competitive spread?" answer="5" explanation="$\mu(V_H - V_L) = 0.25 \times 20$." />
    </>
  );
}
