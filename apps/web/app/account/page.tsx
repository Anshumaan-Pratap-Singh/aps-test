import { PageHeader } from "@/components/ui";
import { Account } from "@/features/account/Account";

export const metadata = { title: "Account" };

export default function Page() {
  return (
    <>
      <PageHeader title="Account & Data" kicker="Settings" />
      <Account />
    </>
  );
}
