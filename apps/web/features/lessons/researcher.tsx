import { M, MD } from "@/components/Math";
import { Callout, Check } from "./kit";

const t = String.raw;

export function ProbabilitySpaces() {
  const L = "lesson:probability-spaces";
  return (
    <>
      <p>A probability space is a triple <M>{t`(\Omega, \mathcal F, P)`}</M>: a sample space, a σ-algebra of events closed under complements and countable unions, and a measure with <M>{t`P(\Omega)=1`}</M> that is countably additive on disjoint events.</p>
      <h2>Random variables</h2>
      <p>A random variable is a measurable map <M>{t`X:\Omega\to\mathbb R`}</M>, meaning <M>{t`\{X\le x\}\in\mathcal F`}</M> for all <M>x</M>. Its distribution is summarised by the CDF <M>{t`F_X(x) = P(X\le x)`}</M>, which is non-decreasing, right-continuous, with limits 0 and 1.</p>
      <h2>Moment-generating and characteristic functions</h2>
      <MD>{t`M_X(s) = \mathbb E[e^{sX}],\qquad \varphi_X(u) = \mathbb E[e^{iuX}].`}</MD>
      <p>When <M>{t`M_X`}</M> exists near 0, <M>{t`\mathbb E X^k = M_X^{(k)}(0)`}</M>. The characteristic function always exists, determines the distribution, and turns sums of independent variables into products: <M>{t`\varphi_{X+Y} = \varphi_X\varphi_Y`}</M>.</p>
      <p>Example: for <M>{t`X\sim\text{Poisson}(\lambda)`}</M>, <M>{t`M_X(s) = \exp(\lambda(e^s-1))`}</M>, so <M>{t`\mathbb E X = \operatorname{Var} X = \lambda`}</M>, and sums of independent Poissons are Poisson.</p>
      <Check lesson={L} id="c1" prompt="If $M_X(s) = (1-2s)^{-3}$ (Gamma), what is $\mathbb E X$?" answer="6" explanation="$M'(0) = 3 \cdot 2 \cdot (1-0)^{-4} = 6$." />
    </>
  );
}

export function LimitTheorems() {
  const L = "lesson:limit-theorems";
  return (
    <>
      <h2>Law of large numbers</h2>
      <p>For i.i.d. <M>{t`X_i`}</M> with finite mean μ, <M>{t`\bar X_n \to \mu`}</M> almost surely (strong law). With finite variance, Chebyshev gives the weak law directly: <M>{t`P(|\bar X_n - \mu| \ge \varepsilon) \le \sigma^2/(n\varepsilon^2)`}</M>.</p>
      <h2>Central limit theorem</h2>
      <MD>{t`\frac{\sqrt n(\bar X_n - \mu)}{\sigma} \xrightarrow{d} \mathcal N(0,1).`}</MD>
      <p>Proof sketch: the characteristic function of the standardised sum is <M>{t`\big(1 - \tfrac{u^2}{2n} + o(1/n)\big)^n \to e^{-u^2/2}`}</M>.</p>
      <h2>Concentration</h2>
      <p>For bounded independent variables <M>{t`X_i\in[a,b]`}</M>, Hoeffding gives exponential tails:</p>
      <MD>{t`P\big(|\bar X_n - \mu| \ge \varepsilon\big) \le 2\exp\!\Big(-\frac{2n\varepsilon^2}{(b-a)^2}\Big).`}</MD>
      <Callout title="Finance caveat">Returns are heavy-tailed, autocorrelated in volatility and non-stationary. The CLT can be slow, and i.i.d. assumptions often fail; Sharpe ratio standard errors computed as if returns were i.i.d. are usually too small.</Callout>
      <Check lesson={L} id="c1" prompt="Chebyshev bound on $P(|\bar X_n-\mu|\ge 0.1)$ for $\sigma^2=1$, $n=1000$?" answer="0.1" explanation="$1/(1000 \cdot 0.01) = 0.1$." />
    </>
  );
}

export function HypothesisTesting() {
  const L = "lesson:hypothesis-testing";
  return (
    <>
      <p>A test fixes a null <M>{t`H_0`}</M>, a statistic <M>T</M>, and rejects when <M>T</M> is extreme. The size α bounds <M>{t`P(\text{reject}\mid H_0)`}</M>; the p-value is the smallest α at which the observed data would reject. A p-value is <em>not</em> the probability that the null is true.</p>
      <h2>Multiple testing</h2>
      <p>Test <M>m</M> independent true nulls at level α: <M>{t`P(\text{at least one false positive}) = 1 - (1-\alpha)^m`}</M>. With 100 strategies at α = 0.05, that is ≈ 99.4%.</p>
      <ul>
        <li><strong>Bonferroni</strong> controls the family-wise error rate by testing each at <M>{t`\alpha/m`}</M>.</li>
        <li><strong>Benjamini–Hochberg</strong> controls the false discovery rate: sort p-values, find the largest <M>k</M> with <M>{t`p_{(k)} \le k\alpha/m`}</M>, reject the first <M>k</M>.</li>
      </ul>
      <h2>Sharpe ratios and selection</h2>
      <p>The best of <M>N</M> zero-skill strategies has an expected maximum Sharpe ratio that grows like <M>{t`\sqrt{2\ln N}`}</M> standard errors. Reporting the winner without adjusting for the number of trials is backtest selection bias.</p>
      <Check lesson={L} id="c1" prompt="Bonferroni threshold for 20 tests at family level 0.05?" answer="0.0025" explanation="$0.05/20$." />
    </>
  );
}

export function MarkovChains() {
  const L = "lesson:markov-chains";
  return (
    <>
      <p>A discrete-time Markov chain satisfies <M>{t`P(X_{n+1}=j\mid X_n=i, X_{n-1},\dots) = P_{ij}`}</M>. The rows of the transition matrix <M>P</M> sum to 1, and <M>n</M>-step probabilities are matrix powers: <M>{t`P^{(n)} = P^n`}</M> (Chapman–Kolmogorov).</p>
      <h2>Stationary distributions</h2>
      <p>A row vector π with <M>{t`\pi P = \pi`}</M>, <M>{t`\sum_i \pi_i = 1`}</M>. A finite irreducible chain has a unique π; if it is also aperiodic, <M>{t`P^n_{ij}\to\pi_j`}</M>.</p>
      <MD>{t`P = \begin{pmatrix} 0.9 & 0.1 \\ 0.5 & 0.5\end{pmatrix} \;\Rightarrow\; 0.1\,\pi_1 = 0.5\,\pi_2 \;\Rightarrow\; \pi = \big(\tfrac56, \tfrac16\big).`}</MD>
      <h2>Absorption</h2>
      <p>For absorbing chains, first-step analysis gives linear equations. For a fair ±1 walk absorbed at 0 and <M>N</M>, <M>{t`h(x) = \tfrac12 h(x-1) + \tfrac12 h(x+1)`}</M> with <M>{t`h(0)=0, h(N)=1`}</M> yields <M>{t`h(x) = x/N`}</M>, and the expected duration is <M>{t`x(N-x)`}</M>.</p>
      <Check lesson={L} id="c1" prompt="For the matrix above, $P(X_2 = 1 \mid X_0 = 1)$?" answer="0.86" explanation="$0.9^2 + 0.1 \cdot 0.5 = 0.86$." />
      <Check lesson={L} id="c2" prompt="Fair walk from 3, absorbed at 0 and 10. Expected steps?" answer="21" explanation="$3 \times 7 = 21$." />
    </>
  );
}

export function Martingales() {
  const L = "lesson:martingales";
  return (
    <>
      <p>Given a filtration <M>{t`(\mathcal F_n)`}</M> (the information available at time <M>n</M>), an adapted integrable process is a <strong>martingale</strong> if <M>{t`\mathbb E[M_{n+1}\mid\mathcal F_n] = M_n`}</M>. A stopping time τ is a random time with <M>{t`\{\tau\le n\}\in\mathcal F_n`}</M> — you can decide to stop using only the past.</p>
      <h2>Optional stopping theorem</h2>
      <p>If τ is bounded, or <M>{t`\mathbb E\tau<\infty`}</M> with bounded increments, then <M>{t`\mathbb E[M_\tau] = \mathbb E[M_0]`}</M>. No stopping rule turns a fair game into a favourable one.</p>
      <h2>Applications</h2>
      <p>For the fair walk from <M>x</M> stopped at 0 or <M>N</M>: <M>{t`S_n`}</M> is a martingale so <M>{t`N\,P(\text{hit }N) = x`}</M>. And <M>{t`S_n^2 - n`}</M> is a martingale, so <M>{t`\mathbb E\tau = \mathbb E S_\tau^2 - x^2 = N x - x^2 = x(N-x)`}</M>.</p>
      <p>For a biased walk with <M>{t`p\ne\tfrac12`}</M>, <M>{t`(q/p)^{S_n}`}</M> is a martingale, giving the gambler&apos;s ruin formula <M>{t`P(\text{hit }N) = \frac{1-(q/p)^x}{1-(q/p)^N}`}</M>.</p>
      <Callout title="Why the doubling strategy fails">“Double after each loss” is a stopping rule with unbounded stake; OST&apos;s conditions fail, and with any finite bankroll the expected gain is zero while the ruin probability is positive.</Callout>
      <Check lesson={L} id="c1" prompt="Biased walk $p=2/3$ from 1, absorbed at 0 and 2. $P(\text{hit } 2)$?" answer="2/3" explanation="$q/p = 1/2$: $(1 - 1/2)/(1 - 1/4) = 2/3$ — or directly, one step." />
    </>
  );
}

export function BrownianMotion() {
  const L = "lesson:brownian-motion";
  return (
    <>
      <p>Standard Brownian motion <M>{t`(W_t)_{t\ge0}`}</M> has <M>{t`W_0 = 0`}</M>, independent increments, <M>{t`W_t - W_s \sim \mathcal N(0, t-s)`}</M>, and continuous paths. It is the scaling limit of random walks (Donsker).</p>
      <h2>Quadratic variation</h2>
      <p>For a partition of <M>{t`[0,t]`}</M> with mesh → 0:</p>
      <MD>{t`\sum_k (W_{t_{k+1}} - W_{t_k})^2 \xrightarrow{L^2} t,\qquad\text{informally } (dW_t)^2 = dt.`}</MD>
      <p>Each squared increment has mean <M>{t`\Delta t`}</M> and variance <M>{t`2\Delta t^2`}</M>, so the sum has mean <M>t</M> and variance <M>{t`2\sum\Delta t^2 \le 2t\max\Delta t \to 0`}</M>. Paths therefore have infinite total variation and are nowhere differentiable — ordinary calculus fails.</p>
      <h2>Martingales of BM</h2>
      <p><M>{t`W_t`}</M>, <M>{t`W_t^2 - t`}</M> and <M>{t`\exp(\theta W_t - \theta^2 t/2)`}</M> are martingales. The last one underlies change of measure (Girsanov).</p>
      <Check lesson={L} id="c1" prompt="$\operatorname{Var}(W_3 - W_1)$?" answer="2" explanation="Increments over length 2 are $\mathcal N(0,2)$." />
      <Check lesson={L} id="c2" prompt="$\mathbb E[W_2 W_5]$?" answer="2" explanation="$\operatorname{Cov}(W_s, W_t) = \min(s,t)$." />
    </>
  );
}

export function ItoLemma() {
  const L = "lesson:ito-lemma";
  return (
    <>
      <p>The Itô integral <M>{t`\int_0^t H_s\,dW_s`}</M> is defined for adapted <M>H</M> as the <M>{t`L^2`}</M>-limit of left-endpoint sums. It is a martingale with the <strong>Itô isometry</strong> <M>{t`\mathbb E\big[(\int_0^t H\,dW)^2\big] = \mathbb E\int_0^t H^2\,ds`}</M>.</p>
      <h2>Itô&apos;s lemma</h2>
      <p>For <M>{t`dX_t = \mu_t\,dt + \sigma_t\,dW_t`}</M> and <M>{t`f\in C^{1,2}`}</M>, Taylor-expand to second order and use <M>{t`(dW)^2 = dt`}</M>, <M>{t`dt\,dW = (dt)^2 = 0`}</M>:</p>
      <MD>{t`df(t,X_t) = \Big(\partial_t f + \mu_t\,\partial_x f + \tfrac12\sigma_t^2\,\partial_{xx} f\Big)dt + \sigma_t\,\partial_x f\,dW_t.`}</MD>
      <h2>Geometric Brownian motion</h2>
      <p>Take <M>{t`dS_t = \mu S_t\,dt + \sigma S_t\,dW_t`}</M> and <M>{t`f = \ln S`}</M>: <M>{t`f_x = 1/S`}</M>, <M>{t`f_{xx} = -1/S^2`}</M>, so</p>
      <MD>{t`d\ln S_t = \big(\mu - \tfrac12\sigma^2\big)dt + \sigma\,dW_t \;\Rightarrow\; S_t = S_0\exp\!\Big(\big(\mu-\tfrac12\sigma^2\big)t + \sigma W_t\Big).`}</MD>
      <p>The <M>{t`-\tfrac12\sigma^2`}</M> term is the convexity correction: <M>{t`\mathbb E S_t = S_0 e^{\mu t}`}</M>, but the median is <M>{t`S_0 e^{(\mu-\sigma^2/2)t}`}</M>.</p>
      <h2>Feynman–Kac (connection)</h2>
      <p>If <M>{t`u(t,x) = \mathbb E[g(X_T)\mid X_t = x]`}</M> for the diffusion above, then <M>{t`\partial_t u + \mu\partial_x u + \tfrac12\sigma^2\partial_{xx}u = 0`}</M> with <M>{t`u(T,x)=g(x)`}</M>. Under the risk-neutral measure (Girsanov replaces μ by <M>r</M>), discounting gives the Black–Scholes PDE.</p>
      <Check lesson={L} id="c1" prompt="Apply Itô to $f(W_t) = W_t^2$: the $dt$ coefficient is?" answer="1" explanation="$d(W^2) = 2W\,dW + \tfrac12 \cdot 2\,dt = 2W\,dW + dt$." />
      <Check lesson={L} id="c2" prompt="GBM with $\mu = 0.1$, $\sigma = 0.4$: drift of $\ln S$?" answer="0.02" explanation="$0.1 - 0.16/2 = 0.02$." />
    </>
  );
}

export function Regression() {
  const L = "lesson:regression";
  return (
    <>
      <p>Ordinary least squares minimises <M>{t`\|y - X\beta\|^2`}</M>, giving <M>{t`\hat\beta = (X^\top X)^{-1}X^\top y`}</M> when <M>{t`X^\top X`}</M> is invertible. In one dimension, <M>{t`\hat\beta_1 = \operatorname{Cov}(x,y)/\operatorname{Var}(x)`}</M>.</p>
      <h2>Regularisation</h2>
      <MD>{t`\hat\beta_{\text{ridge}} = \arg\min_\beta \|y-X\beta\|^2 + \lambda\|\beta\|_2^2 = (X^\top X + \lambda I)^{-1}X^\top y,`}</MD>
      <MD>{t`\hat\beta_{\text{lasso}} = \arg\min_\beta \tfrac12\|y-X\beta\|^2 + \lambda\|\beta\|_1.`}</MD>
      <p>Ridge shrinks coefficients smoothly and stabilises collinear features; lasso sets some exactly to zero (soft-thresholding in the orthonormal case: <M>{t`\hat\beta_j = \operatorname{sign}(z_j)(|z_j|-\lambda)_+`}</M>).</p>
      <h2>Bias–variance</h2>
      <p>Expected squared prediction error = irreducible noise + bias² + variance. Regularisation trades a little bias for a large reduction in variance — essential when signal-to-noise is as low as it is in returns, where out-of-sample <M>{t`R^2`}</M> of 1% can be economically meaningful.</p>
      <p>Logistic regression, trees, random forests and gradient boosting extend this to non-linear and classification problems; the research lab uses OLS so that every number it reports can be checked by hand.</p>
      <Check lesson={L} id="c1" prompt="$\operatorname{Cov}(x,y) = 0.6$, $\operatorname{Var}(x) = 2$. OLS slope?" answer="0.3" explanation="$0.6 / 2$." />
      <Check lesson={L} id="c2" prompt="Lasso, orthonormal design: $z_j = 0.8$, $\lambda = 0.5$. $\hat\beta_j$?" answer="0.3" explanation="Soft-threshold: $0.8 - 0.5$." />
    </>
  );
}

export function BacktestPitfalls() {
  const L = "lesson:backtest-pitfalls";
  return (
    <>
      <p>Most promising backtests are false. The failure modes are predictable:</p>
      <ul>
        <li><strong>Look-ahead bias</strong>: using information unavailable at decision time — close prices for decisions made at the open, revised economic data, fundamentals before their release date.</li>
        <li><strong>Data leakage</strong>: features computed with future data (e.g. normalising by full-sample mean/std, centred moving averages, target-derived features).</li>
        <li><strong>Survivorship bias</strong>: testing only on today&apos;s index members silently removes the bankruptcies.</li>
        <li><strong>Multiple testing / selection bias</strong>: try enough variants and one will look good by chance.</li>
        <li><strong>Non-stationarity and regime change</strong>: relationships drift; a 2010s factor may vanish.</li>
        <li><strong>Costs</strong>: spread, fees, slippage and market impact scale with turnover; impact roughly scales with <M>{t`\sigma\sqrt{Q/V}`}</M> (square-root law), capping capacity.</li>
      </ul>
      <h2>A worked leakage example</h2>
      <p>If a feature is <M>{t`z_t = (x_t - \bar x)/s_x`}</M> with <M>{t`\bar x, s_x`}</M> from the whole sample, every training row contains information about the test period. Use rolling or expanding statistics computed strictly from <M>{t`x_{1..t}`}</M>.</p>
      <h2>Turnover arithmetic</h2>
      <p>Net return ≈ gross return − turnover × cost per unit traded. A strategy with 10 bp daily gross edge, 100% daily turnover and 6 bp round-trip cost keeps 4 bp; at 12 bp cost it loses money.</p>
      <Callout title="Practice">The Research Laboratory lets you introduce leakage and costs deliberately and watch the out-of-sample result change.</Callout>
      <Check lesson={L} id="c1" prompt="Gross 8 bp/day, turnover 50%/day, cost 10 bp per unit traded. Net bp/day?" answer="3" explanation="$8 - 0.5 \times 10$." />
      <Check lesson={L} id="c2" prompt="Standardising a feature with the full-sample mean before a train/test split is an example of…" choices={["Leakage", "Survivorship bias", "Overfitting by regularisation"]} answer="Leakage" explanation="Test-period information flows into training features." />
    </>
  );
}

export function Validation() {
  const L = "lesson:validation";
  return (
    <>
      <p>Random K-fold cross-validation assumes exchangeable rows. Time series violate this: neighbouring observations are correlated and labels often span several periods.</p>
      <h2>Chronological splits and walk-forward</h2>
      <p>Train on <M>{t`[0, T_1)`}</M>, test on <M>{t`[T_1, T_2)`}</M>, roll forward, refit, repeat. Every prediction is made with data that would have existed at the time.</p>
      <h2>Purging and embargo</h2>
      <p>If label <M>{t`y_t`}</M> depends on returns over <M>{t`(t, t+h]`}</M>, training rows whose label windows overlap the test window leak test information. <strong>Purge</strong> those rows. Then <strong>embargo</strong> a further gap after the test window before training resumes, to absorb serial correlation.</p>
      <MD>{t`\text{train} = \{t : (t, t+h] \cap [T_1, T_2 + e) = \varnothing\}.`}</MD>
      <h2>Nested validation</h2>
      <p>Hyperparameters chosen on the test fold contaminate it. Use an inner loop (within training data) for model selection and an outer loop for the performance estimate.</p>
      <h2>Calibration</h2>
      <p>A predicted probability of 70% should be right about 70% of the time. Reliability diagrams and the Brier score <M>{t`\frac1n\sum(p_i - y_i)^2`}</M> (a proper scoring rule) check this.</p>
      <Check lesson={L} id="c1" prompt="Labels use 5-day forward returns; test window starts day 100. Last training day without overlap (purging only)?" answer="94" explanation="Day 94's label covers days 95–99; day 95's covers 96–100, which overlaps." />
      <Check lesson={L} id="c2" prompt="Brier score for predictions (0.8, 0.3) with outcomes (1, 0)?" answer="0.065" explanation="$(0.04 + 0.09)/2$." />
    </>
  );
}
