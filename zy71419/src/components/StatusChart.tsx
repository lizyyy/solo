import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { useStore } from "@/store/useStore";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import type { EventStatus } from "@/types";

export default function StatusChart() {
  const events = useStore((s) => s.events);
  const setStatusFilter = useStore((s) => s.setStatusFilter);

  const data = useMemo(() => {
    const dist: Record<string, number> = {};
    events.forEach((e) => {
      dist[e.status] = (dist[e.status] || 0) + 1;
    });
    return Object.entries(dist).map(([status, count]) => ({
      status: status as EventStatus,
      count,
      fill: STATUS_COLORS[status as EventStatus],
    }));
  }, [events]);

  const handleClick = (entry: { status: EventStatus } | undefined) => {
    if (entry) {
      setStatusFilter(entry.status);
    }
  };

  return (
    <div className="rounded-lg bg-[#1a1f36] p-5">
      <h3 className="text-sm font-medium text-[#6b7894] mb-4">状态分布</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="status"
            cx="50%"
            cy="50%"
            outerRadius={90}
            cursor="pointer"
            onClick={(_, index) => handleClick(data[index])}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.status} fill={entry.fill} />
            ))}
          </Pie>
          <Legend
            formatter={(value: string) => STATUS_LABELS[value as EventStatus] ?? value}
            wrapperStyle={{ color: "#6b7894", fontSize: 12 }}
            iconSize={8}
            iconType="circle"
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
