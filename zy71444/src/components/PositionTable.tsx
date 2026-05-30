import type { OptionPosition } from "@/data/types"

interface PositionTableProps {
  positions: OptionPosition[]
}

const COLUMNS = [
  { key: "underlying" as const, label: "标的" },
  { key: "strike" as const, label: "行权价" },
  { key: "direction" as const, label: "方向" },
  { key: "quantity" as const, label: "数量" },
  { key: "expiryDate" as const, label: "到期日" },
  { key: "delta" as const, label: "Delta" },
  { key: "gamma" as const, label: "Gamma" },
  { key: "vega" as const, label: "Vega" },
] as const

function formatNum(v: number) {
  return v.toLocaleString("zh-CN", { maximumFractionDigits: 2 })
}

export default function PositionTable({ positions }: PositionTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-gray-300">
        <thead>
          <tr className="border-b border-gray-700">
            {COLUMNS.map((col) => (
              <th key={col.key} className="px-2 py-1.5 text-left font-medium text-gray-400 whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => {
            let rowClass = ""
            if (pos.bucketMismatch) rowClass = "bg-red-900/30"
            else if (pos.deltaSignReversal) rowClass = "bg-yellow-900/30"

            return (
              <tr key={pos.id} className={`border-b border-gray-800 ${rowClass}`}>
                <td className="px-2 py-1 whitespace-nowrap">{pos.underlying}</td>
                <td className="px-2 py-1">{formatNum(pos.strike)}</td>
                <td className="px-2 py-1">
                  <span className={pos.direction === "CALL" ? "text-green-400" : "text-red-400"}>
                    {pos.direction === "CALL" ? "买" : "卖"}
                  </span>
                </td>
                <td className="px-2 py-1 text-right">{formatNum(pos.quantity)}</td>
                <td className="px-2 py-1 whitespace-nowrap">{pos.expiryDate}</td>
                <td className="px-2 py-1 text-right">{formatNum(pos.delta)}</td>
                <td className="px-2 py-1 text-right">{formatNum(pos.gamma)}</td>
                <td className="px-2 py-1 text-right">{formatNum(pos.vega)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
