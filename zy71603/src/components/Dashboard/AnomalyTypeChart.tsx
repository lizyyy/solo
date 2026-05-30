import { BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer } from "recharts"
import type { DetailCategory } from "@/engine/types"

interface AnomalyTypeChartProps {
  anomalyByType: Record<string, number>
  onSliceClick: (cat: DetailCategory) => void
}

export default function AnomalyTypeChart({
  anomalyByType,
  onSliceClick,
}: AnomalyTypeChartProps) {
  const data = Object.entries(anomalyByType).map(([name, value], index) => ({
    name,
    value,
    opacity: 1 - index * 0.15,
  }))

  return (
    <div className="bg-[#242938] rounded-xl p-5">
      <h3 className="text-[#f0ece4] text-sm font-medium mb-4">异常类型分布</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" barCategoryGap="20%">
          <XAxis
            type="number"
            tick={{ fill: "#a0a0b0", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#a0a0b0", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e2230",
              border: "none",
              borderRadius: 8,
              color: "#f0ece4",
              fontSize: 13,
            }}
            itemStyle={{ color: "#f0ece4" }}
            labelStyle={{ color: "#a0a0b0" }}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            onClick={() => {
              onSliceClick("anomaly")
            }}
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={`rgba(239, 68, 68, ${Math.max(entry.opacity, 0.3)})`}
                cursor="pointer"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
