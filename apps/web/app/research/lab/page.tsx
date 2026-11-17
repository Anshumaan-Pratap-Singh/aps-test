import { PageHeader } from "@/components/ui";
import { ResearchLab } from "@/features/research/ResearchLab";

export const metadata = { title: "Research Laboratory" };

export default function Page() {
  return (
    <>
      <PageHeader title="Research Laboratory" kicker="Quantitative Research">Work through the eight steps; change the inputs and watch every statistic recompute.</PageHeader>
      <ResearchLab />
    </>
  );
}
