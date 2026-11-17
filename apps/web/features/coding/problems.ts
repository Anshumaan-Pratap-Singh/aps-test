/**
 * Coding problems with real executable tests. Tests are Python snippets run after
 * the solution in a fresh namespace; a test passes iff it raises nothing.
 * "Hidden" tests are not shown in the UI, but because execution is client-side they
 * are present in the bundle — they are not secret. Secret judging requires the
 * server sandbox (see docs/architecture.md).
 */
export interface TestCase { name: string; code: string; hidden?: boolean }
export interface Problem {
  id: string; title: string; difficulty: number; tags: string[]; statement: string; examples: string[]; starter: string; cppStarter: string;
  tests: TestCase[]; editorial: string; timeLimitMs: number;
}

export const PROBLEMS: Problem[] = [
  {
    id: "lru-cache", title: "LRU Cache", difficulty: 4, tags: ["hash map", "linked list", "design"], timeLimitMs: 4000,
    statement: "Implement `LRUCache(capacity)` with `get(key)` returning the value or -1, and `put(key, value)` inserting/updating. When full, evict the least-recently-used key. Both operations must be O(1) amortised.",
    examples: ["c = LRUCache(2); c.put(1, 1); c.put(2, 2); c.get(1) -> 1; c.put(3, 3)  # evicts 2; c.get(2) -> -1"],
    starter: `class LRUCache:
    def __init__(self, capacity: int):
        pass

    def get(self, key: int) -> int:
        return -1

    def put(self, key: int, value: int) -> None:
        pass
`,
    cppStarter: `class LRUCache {
 public:
  explicit LRUCache(int capacity);
  int get(int key);
  void put(int key, int value);
};`,
    tests: [
      { name: "basic eviction", code: "c=LRUCache(2); c.put(1,1); c.put(2,2); assert c.get(1)==1; c.put(3,3); assert c.get(2)==-1; assert c.get(3)==3" },
      { name: "update refreshes recency", code: "c=LRUCache(2); c.put(1,1); c.put(2,2); c.put(1,10); c.put(3,3); assert c.get(1)==10; assert c.get(2)==-1" },
      { name: "capacity one", code: "c=LRUCache(1); c.put(1,1); c.put(2,2); assert c.get(1)==-1 and c.get(2)==2" },
      { name: "get refreshes recency", code: "c=LRUCache(2); c.put(1,1); c.put(2,2); c.get(1); c.put(3,3); assert c.get(1)==1 and c.get(2)==-1", hidden: true },
      { name: "performance 200k ops", code: "import time\nc=LRUCache(1000)\nt=time.perf_counter()\nfor i in range(100000):\n    c.put(i%5000,i); c.get((i*7)%5000)\nassert time.perf_counter()-t < 3.0, 'too slow: not O(1)?'", hidden: true },
    ],
    editorial: "Keep a hash map from key to node and a doubly linked list ordered by recency (or Python's `collections.OrderedDict` with `move_to_end` / `popitem(last=False)`). `get` moves the node to the front; `put` inserts at the front and evicts from the back when over capacity. Each step is O(1).",
  },
  {
    id: "ring-buffer", title: "Ring Buffer", difficulty: 3, tags: ["array", "queue"], timeLimitMs: 3000,
    statement: "Implement a fixed-capacity FIFO `RingBuffer(capacity)` backed by a pre-allocated list. `push(x)` returns False when full (no overwrite); `pop()` returns the oldest element or None when empty; `len(buf)` returns the count. No list growth after construction.",
    examples: ["b = RingBuffer(2); b.push(1) -> True; b.push(2) -> True; b.push(3) -> False; b.pop() -> 1"],
    starter: `class RingBuffer:
    def __init__(self, capacity: int):
        self.buf = [None] * capacity

    def push(self, x) -> bool:
        return False

    def pop(self):
        return None

    def __len__(self) -> int:
        return 0
`,
    cppStarter: `template <class T, std::size_t N> class RingBuffer {
 public:
  bool push(const T& x);
  std::optional<T> pop();
  std::size_t size() const;
};`,
    tests: [
      { name: "fifo order", code: "b=RingBuffer(3); assert b.push(1) and b.push(2); assert b.pop()==1; assert b.push(3) and b.push(4); assert [b.pop(),b.pop(),b.pop()]==[2,3,4]; assert b.pop() is None" },
      { name: "full rejects", code: "b=RingBuffer(2); b.push(1); b.push(2); assert b.push(3) is False; assert len(b)==2" },
      { name: "wraparound many times", code: "b=RingBuffer(4)\nfor i in range(1000):\n    assert b.push(i)\n    assert b.pop()==i\nassert len(b)==0", hidden: true },
      { name: "no growth", code: "b=RingBuffer(5)\nfor i in range(50):\n    b.push(i); b.pop()\nassert len(b.buf)==5", hidden: true },
    ],
    editorial: "Track `head` (next read) and `count`; the write index is `(head + count) % capacity`. Push fails when `count == capacity`. This is the single-threaded core of an SPSC queue; the concurrent version replaces `count` with separate atomic head/tail indices.",
  },
  {
    id: "running-median", title: "Running Median", difficulty: 5, tags: ["heap", "streaming"], timeLimitMs: 4000,
    statement: "Write `running_median(stream)` returning, after each element, the median of all elements so far (as float). Target O(log n) per element.",
    examples: ["running_median([5, 15, 1, 3]) -> [5.0, 10.0, 5.0, 4.0]"],
    starter: `def running_median(stream: list[int]) -> list[float]:
    return []
`,
    cppStarter: `std::vector<double> running_median(const std::vector<int>& stream);`,
    tests: [
      { name: "example", code: "assert running_median([5,15,1,3])==[5.0,10.0,5.0,4.0]" },
      { name: "duplicates & negatives", code: "assert running_median([-1,-1,2,2])==[-1.0,-1.0,-1.0,0.5]" },
      { name: "random vs sort", code: "import random, statistics\nr=random.Random(1)\nxs=[r.randint(-1000,1000) for _ in range(300)]\nexp=[float(statistics.median(xs[:i+1])) for i in range(len(xs))]\nassert running_median(xs)==exp", hidden: true },
      { name: "performance 50k", code: "import time, random\nxs=[random.randint(0,10**6) for _ in range(50000)]\nt=time.perf_counter(); running_median(xs)\nassert time.perf_counter()-t<3.0, 'too slow'", hidden: true },
    ],
    editorial: "Maintain a max-heap of the lower half and a min-heap of the upper half (heapq with negated values for the max-heap), rebalancing so sizes differ by at most one. The median is the top of the larger heap or the mean of both tops.",
  },
  {
    id: "min-heap", title: "Binary Min-Heap", difficulty: 4, tags: ["heap", "array"], timeLimitMs: 3000,
    statement: "Implement `MinHeap` with `push(x)`, `pop()` (remove and return the minimum; raise IndexError when empty), `peek()` and `len()`, using an array and sift-up/sift-down. Do not import heapq.",
    examples: ["h = MinHeap(); h.push(3); h.push(1); h.push(2); h.pop() -> 1"],
    starter: `class MinHeap:
    def __init__(self):
        self.a = []

    def push(self, x) -> None:
        pass

    def pop(self):
        raise IndexError("empty")

    def peek(self):
        raise IndexError("empty")

    def __len__(self) -> int:
        return len(self.a)
`,
    cppStarter: `template <class T> class MinHeap { public: void push(T); T pop(); const T& top() const; std::size_t size() const; };`,
    tests: [
      { name: "heap sort", code: "h=MinHeap()\nfor x in [5,3,8,1,9,2]: h.push(x)\nassert [h.pop() for _ in range(6)]==[1,2,3,5,8,9]" },
      { name: "empty raises", code: "h=MinHeap()\ntry:\n    h.pop(); assert False, 'expected IndexError'\nexcept IndexError:\n    pass" },
      { name: "random property", code: "import random\nr=random.Random(3); xs=[r.randint(0,99) for _ in range(500)]\nh=MinHeap()\nfor x in xs: h.push(x)\nassert [h.pop() for _ in xs]==sorted(xs)", hidden: true },
    ],
    editorial: "Store the tree in an array: children of i are 2i+1 and 2i+2. Push appends and sifts up while smaller than the parent; pop swaps the root with the last element, removes it, and sifts the new root down toward the smaller child. Both are O(log n).",
  },
  {
    id: "matching-engine", title: "Price-Time Matching Engine", difficulty: 6, tags: ["order book", "trading systems"], timeLimitMs: 4000,
    statement: "Implement `match(orders)`. Each order is a dict `{id, side: 'B'|'S', price: int, qty: int}` in arrival order (limit orders). An incoming order trades against the best opposite price while prices cross, earliest order first at each price; trades execute at the RESTING order's price. Unfilled quantity rests. Return a list of trades `(buy_id, sell_id, price, qty)` in execution order.",
    examples: ["match([{'id':1,'side':'S','price':101,'qty':5},{'id':2,'side':'B','price':102,'qty':3}]) -> [(2, 1, 101, 3)]"],
    starter: `def match(orders: list[dict]) -> list[tuple]:
    trades = []
    return trades
`,
    cppStarter: `struct Order { int id; char side; int price; int qty; };
struct Trade { int buy_id, sell_id, price, qty; };
std::vector<Trade> match(const std::vector<Order>& orders);`,
    tests: [
      { name: "simple cross", code: "assert match([{'id':1,'side':'S','price':101,'qty':5},{'id':2,'side':'B','price':102,'qty':3}])==[(2,1,101,3)]" },
      { name: "time priority", code: "o=[{'id':1,'side':'B','price':100,'qty':2},{'id':2,'side':'B','price':100,'qty':2},{'id':3,'side':'S','price':100,'qty':3}]\nassert match(o)==[(1,3,100,2),(2,3,100,1)]" },
      { name: "price priority & walk the book", code: "o=[{'id':1,'side':'S','price':102,'qty':1},{'id':2,'side':'S','price':101,'qty':1},{'id':3,'side':'B','price':103,'qty':3}]\nassert match(o)==[(3,2,101,1),(3,1,102,1)]" },
      { name: "no cross rests", code: "o=[{'id':1,'side':'S','price':105,'qty':1},{'id':2,'side':'B','price':104,'qty':1},{'id':3,'side':'S','price':104,'qty':2}]\nassert match(o)==[(2,3,104,1)]", hidden: true },
      { name: "remainder rests then fills", code: "o=[{'id':1,'side':'B','price':100,'qty':5},{'id':2,'side':'S','price':99,'qty':2},{'id':3,'side':'S','price':100,'qty':4},{'id':4,'side':'B','price':101,'qty':1}]\nassert match(o)==[(1,2,100,2),(1,3,100,3),(4,3,100,1)]", hidden: true },
    ],
    editorial: "Keep bids and asks as price → FIFO deque (sorted containers or heaps of prices with lazy deletion). For an incoming buy, while qty > 0 and best ask ≤ limit, trade with the front of the best ask level at the ask price, decrementing both; pop empty orders and levels. Then rest the remainder on its own side. Production engines index price levels by tick in arrays and keep an id → node map for O(1) cancels.",
  },
  {
    id: "feed-handler", title: "Sequenced Feed Handler", difficulty: 5, tags: ["market data", "dedup"], timeLimitMs: 3000,
    statement: "Implement `process(msgs, start=1)`. `msgs` is a list of sequence numbers as received (may include duplicates and out-of-order arrivals). Deliver messages strictly in sequence order starting from `start`, buffering early arrivals and dropping duplicates/stale messages. Return `(delivered, missing)` where `delivered` is the in-order list actually delivered and `missing` is the sorted list of sequence numbers never received between `start` and the maximum seen.",
    examples: ["process([1, 2, 4, 3, 3, 6]) -> ([1, 2, 3, 4], [5])"],
    starter: `def process(msgs: list[int], start: int = 1) -> tuple[list[int], list[int]]:
    return [], []
`,
    cppStarter: `std::pair<std::vector<uint64_t>, std::vector<uint64_t>> process(const std::vector<uint64_t>& msgs, uint64_t start = 1);`,
    tests: [
      { name: "example", code: "assert process([1,2,4,3,3,6])==([1,2,3,4],[5])" },
      { name: "duplicates and stale", code: "assert process([1,1,2,1,3])==([1,2,3],[])" },
      { name: "gap at start", code: "assert process([2,3],start=1)==([],[1])" },
      { name: "large shuffled", code: "import random\nr=random.Random(5); xs=list(range(1,2001)); r.shuffle(xs); xs+=xs[:100]\nd,m=process(xs)\nassert d==list(range(1,2001)) and m==[]", hidden: true },
    ],
    editorial: "Keep `expected` (next sequence to deliver) and a set/heap of buffered sequence numbers. On arrival: if seq < expected or already buffered, drop it; if seq == expected, deliver it and drain the buffer while it contains `expected`; else buffer it. Missing = all numbers in [start, max_seen] that were never received.",
  },
];

export const PLANNED = [
  { title: "Lock-free SPSC queue (C++)", description: "Needs the sandboxed C++ toolchain to compile and run tests under ThreadSanitizer." },
  { title: "MPMC queue & ABA (C++)", description: "Requires native threads and the isolated execution service." },
];
