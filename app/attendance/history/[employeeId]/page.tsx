import { redirect } from "next/navigation";
import { withSearch, type SearchParams } from "@/lib/navigation";

export default function AttendanceHistoryLegacyRedirect({
  params,
  searchParams,
}: {
  params: { employeeId: string };
  searchParams?: SearchParams;
}) {
  redirect(
    withSearch(`/dashboard/attendance/history/${params.employeeId}`, searchParams),
  );
}
