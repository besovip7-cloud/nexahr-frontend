import { redirect } from "next/navigation";
import { withSearch, type SearchParams } from "@/lib/navigation";

export default async function AttendanceMonthlyRedirectPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  redirect(withSearch("/dashboard/attendance/range", params));
}
