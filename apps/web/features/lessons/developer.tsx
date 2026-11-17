import { M } from "@/components/Math";
import { Callout, Check } from "./kit";

const t = String.raw;

function Code({ children }: { children: string }) {
  return <pre><code>{children.trim()}</code></pre>;
}

export function Complexity() {
  const L = "lesson:complexity";
  return (
    <>
      <p>Asymptotic complexity describes how cost grows with input size <M>n</M>. It ignores constants — which matter enormously in low-latency code — but it tells you which designs can work at all.</p>
      <h2>Core structures and costs</h2>
      <ul>
        <li><strong>Dynamic array</strong>: <M>{t`O(1)`}</M> index, amortised <M>{t`O(1)`}</M> push_back (geometric growth), contiguous and cache-friendly.</li>
        <li><strong>Hash map</strong>: expected <M>{t`O(1)`}</M> lookup; worst case <M>{t`O(n)`}</M>; open addressing beats chaining on cache behaviour.</li>
        <li><strong>Balanced BST / std::map</strong>: <M>{t`O(\log n)`}</M> ordered operations; pointer-chasing makes constants large.</li>
        <li><strong>Binary heap</strong>: <M>{t`O(\log n)`}</M> push/pop, <M>{t`O(1)`}</M> top; running median uses two heaps.</li>
        <li><strong>Ring buffer</strong>: fixed capacity, <M>{t`O(1)`}</M> push/pop, no allocation — the basis of SPSC queues.</li>
      </ul>
      <h2>Amortised analysis</h2>
      <p>Doubling a vector of capacity <M>c</M> copies <M>c</M> elements, but this happens after <M>c/2</M> cheap pushes. Total copies for <M>n</M> pushes are below <M>{t`2n`}</M>, so the amortised cost is <M>{t`O(1)`}</M>.</p>
      <Code>{`
// LRU cache: hash map from key to list node; list ordered by recency.
// get/put are O(1): splice the node to the front, evict from the back.
template <class K, class V> class LRU {
  std::list<std::pair<K, V>> items_;
  std::unordered_map<K, typename decltype(items_)::iterator> index_;
  size_t cap_;
 public:
  explicit LRU(size_t cap) : cap_(cap) {}
  std::optional<V> get(const K& k) {
    auto it = index_.find(k);
    if (it == index_.end()) return std::nullopt;
    items_.splice(items_.begin(), items_, it->second);
    return it->second->second;
  }
  void put(const K& k, V v) {
    if (auto it = index_.find(k); it != index_.end()) {
      it->second->second = std::move(v);
      items_.splice(items_.begin(), items_, it->second);
      return;
    }
    items_.emplace_front(k, std::move(v));
    index_[k] = items_.begin();
    if (items_.size() > cap_) { index_.erase(items_.back().first); items_.pop_back(); }
  }
};`}</Code>
      <Check lesson={L} id="c1" prompt="Number of comparisons (worst case) for binary search over 1,000,000 sorted items, to the nearest integer upper bound?" answer="20" explanation="$\lceil \log_2 10^6 \rceil = 20$." />
    </>
  );
}

export function CppRaiiMove() {
  const L = "lesson:cpp-raii-move";
  return (
    <>
      <p><strong>RAII</strong> ties a resource&apos;s lifetime to an object: acquire in the constructor, release in the destructor. Destructors run on scope exit, including during exception unwinding, so resources cannot leak.</p>
      <h2>Value categories and moves</h2>
      <p>An rvalue reference <code>T&amp;&amp;</code> binds to temporaries. A move constructor steals the source&apos;s resources and leaves it valid-but-unspecified. <code>std::move</code> is only a cast to rvalue; it moves nothing by itself.</p>
      <h2>Rule of Five / Zero</h2>
      <p>If you define any of destructor, copy constructor, copy assignment, move constructor or move assignment, you probably need all five. Better: compose members that already manage themselves (<code>std::vector</code>, <code>std::unique_ptr</code>) and define none (Rule of Zero).</p>
      <Code>{`
class Buffer {
  std::size_t n_ = 0;
  double* p_ = nullptr;
 public:
  explicit Buffer(std::size_t n) : n_(n), p_(new double[n]{}) {}
  ~Buffer() { delete[] p_; }
  Buffer(const Buffer& o) : n_(o.n_), p_(new double[o.n_]) { std::copy(o.p_, o.p_ + n_, p_); }
  Buffer& operator=(Buffer o) noexcept { swap(o); return *this; }      // copy-and-swap
  Buffer(Buffer&& o) noexcept : n_(std::exchange(o.n_, 0)), p_(std::exchange(o.p_, nullptr)) {}
  void swap(Buffer& o) noexcept { std::swap(n_, o.n_); std::swap(p_, o.p_); }
};`}</Code>
      <p>Mark moves <code>noexcept</code>: <code>std::vector</code> only moves elements during reallocation if the move cannot throw; otherwise it copies to preserve the strong exception guarantee.</p>
      <h2>Smart pointers</h2>
      <p><code>unique_ptr</code> is zero-overhead exclusive ownership. <code>shared_ptr</code> adds an atomically reference-counted control block — atomic increments on every copy are measurable in hot paths. Prefer passing raw references when no ownership is transferred.</p>
      <Check lesson={L} id="c1" prompt="Does std::move(x) by itself move any data?" choices={["Yes", "No"]} answer="No" explanation="It is a cast to an rvalue reference; the move happens in the constructor/assignment that receives it." />
    </>
  );
}

export function CacheLocality() {
  const L = "lesson:cache-locality";
  return (
    <>
      <p>Approximate latencies on a modern server core: L1 ≈ 1 ns, L2 ≈ 4 ns, L3 ≈ 10–20 ns, DRAM ≈ 80–100 ns. A cache miss to DRAM costs as much as hundreds of arithmetic instructions. These are orders of magnitude; measure on your hardware.</p>
      <h2>Spatial and temporal locality</h2>
      <p>Caches move 64-byte lines. Traversing a contiguous array uses every byte fetched and lets the hardware prefetcher run ahead; a linked list chases pointers to random addresses. Iterating a row-major matrix by columns touches one element per line.</p>
      <h2>Struct-of-arrays</h2>
      <p>If a hot loop reads only <code>price</code>, an array of 64-byte order structs wastes most of each line; a separate <code>prices[]</code> array packs 8 doubles per line.</p>
      <h2>False sharing</h2>
      <p>Two threads writing different variables on the same cache line force the line to bounce between cores (MESI invalidations). Pad or align per-thread data to the line size:</p>
      <pre><code>{`struct alignas(64) Counter { std::atomic<uint64_t> v; };`}</code></pre>
      <h2>Branch prediction and the TLB</h2>
      <p>Mispredicted branches flush the pipeline (~15–20 cycles). Data-dependent branches on random data mispredict ~50% of the time; branchless code or sorted data helps. Large working sets also miss in the TLB; huge pages reduce page-walk overhead.</p>
      <Check lesson={L} id="c1" prompt="How many 8-byte doubles fit in one 64-byte cache line?" answer="8" explanation="$64 / 8$." />
    </>
  );
}

export function MemoryOrdering() {
  const L = "lesson:memory-ordering";
  return (
    <>
      <p>Compilers and CPUs reorder memory operations. The C++ memory model defines what other threads may observe. A <strong>data race</strong> (concurrent non-atomic access with at least one write) is undefined behaviour.</p>
      <h2>Orders</h2>
      <ul>
        <li><code>relaxed</code>: atomicity only, no ordering. Fine for counters.</li>
        <li><code>release</code> store / <code>acquire</code> load: if the acquire reads the value written by the release, everything before the release <em>happens-before</em> everything after the acquire.</li>
        <li><code>seq_cst</code>: a single total order over all seq_cst operations; simplest, sometimes costlier (a full fence on x86 stores).</li>
      </ul>
      <h2>A single-producer single-consumer ring buffer</h2>
      <Code>{`
template <class T, size_t N>  // N must be a power of two
class Spsc {
  static_assert((N & (N - 1)) == 0);
  alignas(64) std::atomic<size_t> head_{0};  // written by consumer
  alignas(64) std::atomic<size_t> tail_{0};  // written by producer
  T buf_[N];
 public:
  bool push(const T& v) {
    size_t t = tail_.load(std::memory_order_relaxed);
    if (t - head_.load(std::memory_order_acquire) == N) return false;  // full
    buf_[t & (N - 1)] = v;
    tail_.store(t + 1, std::memory_order_release);   // publish the element
    return true;
  }
  bool pop(T& out) {
    size_t h = head_.load(std::memory_order_relaxed);
    if (h == tail_.load(std::memory_order_acquire)) return false;      // empty
    out = buf_[h & (N - 1)];
    head_.store(h + 1, std::memory_order_release);   // free the slot
    return true;
  }
};`}</Code>
      <p>The release on <code>tail_</code> pairs with the consumer&apos;s acquire, so the element write is visible before the index. Head and tail live on separate lines to avoid false sharing. Production versions also cache the opposite index locally to avoid reading the shared line on every call.</p>
      <h2>CAS and ABA</h2>
      <p>Lock-free MPMC structures use compare-and-swap loops. ABA: a pointer changes A→B→A between your read and CAS, so the CAS succeeds incorrectly. Mitigations: tagged pointers / version counters, hazard pointers, epoch-based reclamation.</p>
      <Callout title="Rule">Use a mutex until a profiler proves contention matters. Lock-free code is hard to verify; test with ThreadSanitizer and stress tests.</Callout>
      <Check lesson={L} id="c1" prompt="In the SPSC queue, which memory order must the producer's tail store use so the consumer sees the element?" choices={["relaxed", "release", "consume"]} answer="release" explanation="Release publishes prior writes to a thread that acquire-loads the same atomic." />
    </>
  );
}

export function LimitOrderBook() {
  const L = "lesson:limit-order-book";
  return (
    <>
      <p>A matching engine maintains, per side, price levels in priority order, and within each level a FIFO queue of orders. Incoming orders match against the opposite side while prices cross, then any remainder rests.</p>
      <h2>Data structure choices</h2>
      <ul>
        <li>Price levels: a sorted map (<M>{t`O(\log L)`}</M>) or, for bounded tick ranges, an array indexed by tick with a cached best price (<M>{t`O(1)`}</M>).</li>
        <li>Orders within a level: intrusive doubly linked list for <M>{t`O(1)`}</M> cancel given an order handle.</li>
        <li>Order id → node: hash map for cancel/modify.</li>
      </ul>
      <Code>{`
# Price-time priority matching (simplified, Python for clarity)
def match(book, side, price, qty):
    opp = book.asks if side == "buy" else book.bids          # best-first levels
    fills = []
    while qty and opp and crosses(side, price, opp.best_price()):
        level = opp.best_level()
        while qty and level:
            resting = level[0]                                # earliest order first
            q = min(qty, resting.qty)
            fills.append((resting.id, level.price, q))
            resting.qty -= q; qty -= q
            if resting.qty == 0: level.popleft()
        if not level: opp.remove_best()
    if qty: book.rest(side, price, qty)                      # remainder rests
    return fills`}</Code>
      <h2>Feed handling</h2>
      <p>Market-data feeds carry sequence numbers. A handler must detect gaps (request retransmission or snapshot), drop duplicates (common with A/B line arbitration), and apply updates in order. Replaying a recorded feed through the same code path is the standard way to test determinism.</p>
      <Check lesson={L} id="c1" prompt="Asks: 100.01×200 (t1), 100.01×300 (t2), 100.02×500. A buy for 400 @ 100.02 fills how many shares at 100.01?" answer="400" explanation="Both 100.01 orders (200 + 200 of the 300) fill before 100.02 is touched." />
    </>
  );
}

export function Latency() {
  const L = "lesson:latency";
  return (
    <>
      <p>Latency is a <strong>distribution</strong>, not a number. Report p50, p95, p99 and max, plus the sample size and environment. The mean is dominated by outliers and hides bimodality.</p>
      <h2>Why tails matter</h2>
      <p>If a request fans out to 100 services each with a 1% chance of a slow response, the probability that at least one is slow is <M>{t`1 - 0.99^{100} \approx 63\%`}</M>. System latency is set by component tails.</p>
      <h2>Benchmarking pitfalls</h2>
      <ul>
        <li><strong>Warm-up</strong>: first iterations pay for page faults, cold caches, JIT/branch-predictor training. Discard or report separately.</li>
        <li><strong>Dead-code elimination</strong>: the optimiser may delete work whose result is unused. Use a sink (e.g. <code>benchmark::DoNotOptimize</code>).</li>
        <li><strong>Coordinated omission</strong>: a closed-loop load generator that waits for each response under-samples slow periods.</li>
        <li><strong>Timer resolution and overhead</strong>: time batches when operations are shorter than the clock&apos;s granularity.</li>
        <li><strong>Frequency scaling, SMT neighbours, interrupts</strong>: pin cores, fix frequency, isolate CPUs for stable numbers.</li>
      </ul>
      <h2>CPU-bound vs I/O-bound</h2>
      <p>System calls cost hundreds of ns to µs; network round trips cost µs (same rack, kernel bypass) to ms. Allocation in the hot path costs both directly (allocator) and indirectly (cache pollution, page faults); pre-allocate and pool.</p>
      <Callout title="APS measures itself">The Progress page reports this app&apos;s own answer-processing and input-to-paint percentiles, measured in your browser.</Callout>
      <Check lesson={L} id="c1" prompt="Samples (µs): 3, 4, 4, 5, 100. Median?" answer="4" explanation="Middle of the sorted list; the mean (23.2) is misleading." />
    </>
  );
}
