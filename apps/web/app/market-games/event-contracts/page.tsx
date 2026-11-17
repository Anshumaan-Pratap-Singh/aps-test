import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { EventsUI } from "@/features/games/EventsUI";

export const metadata = { title: "Event Contracts" };

export default function Page() {
  return (
    <>
      <PageHeader title="Event Contracts" kicker="Market Games"><Link href="/market-games" className="text-blue hover:text-cyan">← All games</Link></PageHeader>
      <EventsUI />
    </>
  );
}
