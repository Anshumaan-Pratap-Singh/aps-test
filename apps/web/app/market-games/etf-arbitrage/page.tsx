import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { EtfUI } from "@/features/games/EtfUI";

export const metadata = { title: "ETF Arbitrage" };

export default function Page() {
  return (
    <>
      <PageHeader title="ETF Arbitrage" kicker="Market Games"><Link href="/market-games" className="text-blue hover:text-cyan">← All games</Link></PageHeader>
      <EtfUI />
    </>
  );
}
