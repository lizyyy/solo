import { BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer } from "recharts"
import type { DetailCategory } from "@/engine/types"

const COLORS: Record<string, string> = {
  已匹配: "#22c55e",
  未匹配: "#f59e0b",
  错配: "#ef4444",
}

const CATEGORY_MAP: Record<string, DetailCategory> = {
  已匹配: "repayment_matched",
  未匹配: "repayment_unmatched",
  错配: "repayment_mismatched",
}

interface RepaymentMatchChartProps {
  matched: number
  unmatched: number
  mismatched: number
  onSliceClick: (cat: DetailCategory) => void
}

export default function RepaymentMatchChart({
  matched,
  unmatched,
  mismatched,
  onSliceClick,
}: RepaymentMatchChartProps) {
  const data = [
    { name: "已匹配", value: matched },
    { name: "未匹配", value: unmatched },
    { name: "错配", value: mismatched },
  ]

  return (
    <div className="bg-[#242938] rounded-xl p-5">
      <h3 className="text-[#f0ece4] text-sm font-medium mb-4">还款匹配</h3>
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
