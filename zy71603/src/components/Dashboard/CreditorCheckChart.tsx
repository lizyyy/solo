import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import type { DetailCategory } from "@/engine/types"

const COLORS: Record<string, string> = {
  正常: "#22c55e",
  重复: "#ef4444",
  金额异常: "#f59e0b",
}

const CATEGORY_MAP: Record<string, DetailCategory> = {
  正常: "creditor_normal",
  重复: "creditor_duplicate",
  金额异常: "creditor_amount_mismatch",
}

interface CreditorCheckChartProps {
  normal: number
  duplicate: number
  amountMismatch: number
  onSliceClick: (cat: DetailCategory) => void
}

export default function CreditorCheckChart({
  normal,
  duplicate,
  amountMismatch,
  onSliceClick,
}: CreditorCheckChartProps) {
  const data = [
    { name: "正常", value: normal },
    { name: "重复", value: duplicate },
    { name: "金额异常", value: amountMismatch },
  ]

  return (
    <div className="bg-[#242938] rounded-xl p-5">
      <h3 className="text-[#f0ece4] text-sm font-medium mb-4">债权人核查</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={45}
            paddingAngle={2}
            onClick={(entry: { name?: string }) => {
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
          </Pie>
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
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-2">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs text-[#a0a0b0]">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: COLORS[entry.name] }}
            />
            {entry.name}
          </div>
        ))}
      </div>
    </div>
  )
}
