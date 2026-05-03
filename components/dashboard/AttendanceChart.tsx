"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";

interface Props {
  data: Array<{
    month: string;
    present: number;
  }>;
}

export default function AttendanceChart({ data }: Props) {

  return (
    <div className="bg-white p-6 rounded-xl shadow border">

      <h3 className="text-lg font-semibold mb-4">
        Attendance Trend
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>

          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="month" />

          <YAxis />

          <Tooltip />

          <Line
            type="monotone"
            dataKey="present"
            stroke="#2563eb"
            strokeWidth={3}
          />

        </LineChart>
      </ResponsiveContainer>

    </div>
  );
}
