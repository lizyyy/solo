import { BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer } from "recharts"
import type { DetailCategory } from "@/engine/types"

const COLORS: Record<string, string> = {
  已确认: "#22c55e",
  未确认: "#ef4444",
  部分确认: "#f59e0b",
}

const CATEGORY_MAP: Record<string, DetailCategory> = {
  已确认: "confirm_confirmed",
  未确认: "confirm_unconfirmed",
  部分确认: "confirm_partial",
}

interface ConfirmStatusChartProps {
  confirmed: number
  unconfirmed: number
  partial: number
  onSliceClick: (cat: DetailCategory) => void
}

export default function ConfirmStatusChart({
  confirmed,
  unconfirmed,
  partial,
  onSliceClick,
}: ConfirmStatusChartProps) {
  const data = [
    { name: "已确认", value: confirmed },
    { name: "未确认", value: unconfirmed },
    { name: "部分确认", value: partial },
  ]

  return (
    <div className="bg-[#242938] rounded-xl p-5">
      <h3 className="text-[#f0ece4] text-sm font-medium mb-4">确认状态</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barCategoryGap="20%">
          <XAxis
            dataKey="name"
            tick={{ fill: "#a0a0b0", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#a0a0b0", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
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
            radius={[4, 4, 0, 0]}
            onClick={(entry) => {
              if (entry?.name) {
                onSliceClick(CATEGORY_MAP[entry.name])
              }
            }}
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={COLORS[entry.name]}
                cursor="pointer"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
