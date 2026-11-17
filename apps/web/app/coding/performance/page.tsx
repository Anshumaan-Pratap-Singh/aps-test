import { PageHeader } from "@/components/ui";
import { PerfSimulator } from "@/features/coding/PerfSimulator";

export const metadata = { title: "Performance Simulator" };

export default function Page() {
  return (
    <>
      <PageHeader title="Systems Performance Simulator" kicker="Coding Laboratory">Compare implementations and read the whole latency distribution, not just the mean.</PageHeader>
      <PerfSimulator />
    </>
  );
}
