import { redirect } from "next/navigation";
import { withSearch, type SearchParams } from "@/lib/navigation";

export default function AttendanceHistoryIndexRedirect({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  redirect(withSearch("/dashboard/attendance/range", searchParams));
}
