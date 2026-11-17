import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { FermiUI } from "@/features/games/FermiUI";

export const metadata = { title: "Fermi Estimation" };

export default function Page() {
  return (
    <>
      <PageHeader title="Fermi Estimation" kicker="Market Games"><Link href="/market-games" className="text-blue hover:text-cyan">← All games</Link></PageHeader>
      <FermiUI />
    </>
  );
}
