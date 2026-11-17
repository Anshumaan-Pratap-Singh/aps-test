import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { BettingUI } from "@/features/games/BettingUI";

export const metadata = { title: "Betting Board" };

export default function Page() {
  return (
    <>
      <PageHeader title="Betting Board" kicker="Market Games"><Link href="/market-games" className="text-blue hover:text-cyan">← All games</Link></PageHeader>
      <BettingUI />
    </>
  );
}
