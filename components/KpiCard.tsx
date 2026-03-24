interface Props {
  title: string;
  value: number | string;
}

export default function KpiCard({ title, value }: Props) {
  return (
    <div className="bg-white p-6 rounded-xl shadow border">
      <p className="text-gray-500 text-sm">{title}</p>
      <h2 className="text-3xl font-bold mt-2">{value}</h2>
    </div>
  );
}