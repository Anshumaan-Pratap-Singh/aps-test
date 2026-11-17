import { ModuleGrid, type ModuleDef } from "@/components/ModuleGrid";
import { PageHeader, SectionTitle } from "@/components/ui";

export const metadata = { title: "Market Games" };

const games: ModuleDef[] = [
  { href: "/market-games/market-making", title: "Market-Making Dice & Cards", description: "Quote two-sided markets on hidden dice/card sums with informed flow, inventory limits and a reference maker benchmark.", difficulty: 5, game: "market_making" },
  { href: "/market-games/etf-arbitrage", title: "ETF Arbitrage", description: "Trade ETF vs basket with NAV, FX, costs, depth, legging risk and three competing AI arbitrageurs.", difficulty: 6, game: "etf_arbitrage" },
  { href: "/market-games/event-contracts", title: "Event Contracts", description: "Quote binary contracts while Bayesian-updating on news of varying reliability.", difficulty: 6, game: "event_contracts" },
  { href: "/market-games/fermi", title: "Fermi Estimation", description: "Point + interval estimates scored with a proper interval scoring rule on log scale.", difficulty: 4, game: "fermi" },
  { href: "/market-games/betting-board", title: "Betting Board", description: "Find +EV prices and size with fractional Kelly. Scored on EV, not luck. Virtual currency only.", difficulty: 4, game: "betting_board" },
];

const learn: ModuleDef[] = [
  { href: "/learn/market-making", title: "Quoting, inventory and skew", description: "The model behind the reference maker.", difficulty: 5, lesson: "lesson:market-making" },
  { href: "/learn/adverse-selection", title: "Adverse selection", description: "Glosten–Milgrom spreads and markouts.", difficulty: 6, lesson: "lesson:adverse-selection" },
  { href: "/learn/etf-mechanics", title: "ETF mechanics", description: "NAV, creation/redemption and executable edge.", difficulty: 4, lesson: "lesson:etf-mechanics" },
  { href: "/learn/order-books", title: "Order books", description: "Spreads, depth, microprice and priority.", difficulty: 3, lesson: "lesson:order-books" },
];

export default function MarketGamesPage() {
  return (
    <>
      <PageHeader title="Market Games" kicker="Simulate">
        Seeded, reproducible simulations built on one framework: deterministic reducers, integer-cent accounting, explicit rules,
        an event log and end-of-game analysis. All market data is synthetic.
      </PageHeader>
      <SectionTitle>Games</SectionTitle>
      <ModuleGrid modules={games} />
      <SectionTitle>Prepare</SectionTitle>
      <ModuleGrid modules={learn} />
    </>
  );
}
