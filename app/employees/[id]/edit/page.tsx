import { redirect } from "next/navigation";
import { withSearch, type SearchParams } from "@/lib/navigation";

export default function EmployeeEditLegacyRedirect({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: SearchParams;
}) {
  redirect(withSearch(`/dashboard/employees/${params.id}/edit`, searchParams));
}
