import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { MarketMakingUI } from "@/features/games/MarketMakingUI";

export const metadata = { title: "Market-Making Dice & Cards" };

export default function Page() {
  return (
    <>
      <PageHeader title="Market-Making Dice & Cards" kicker="Market Games"><Link href="/market-games" className="text-blue hover:text-cyan">← All games</Link></PageHeader>
      <MarketMakingUI />
    </>
  );
}
