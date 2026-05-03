import { redirect } from "next/navigation";
import { withSearch, type SearchParams } from "@/lib/navigation";

export default function EmployeeCreateLegacyRedirect({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  redirect(withSearch("/dashboard/employees/create", searchParams));
}
