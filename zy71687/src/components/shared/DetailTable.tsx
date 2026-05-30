interface Column<T> {
  key: string
  title: string
  render?: (value: unknown, row: T) => React.ReactNode
}

interface RowItem {
  label: string
  value: React.ReactNode
}

interface ColumnDetailTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rows?: undefined
}

interface RowDetailTableProps {
  rows: RowItem[]
  columns?: undefined
  data?: undefined
}

type DetailTableProps<T extends Record<string, unknown>> = ColumnDetailTableProps<T> | RowDetailTableProps

export default function DetailTable<T extends Record<string, unknown>>(props: DetailTableProps<T>) {
  if (props.rows) {
    return (
      <div className="divide-y divide-white/5">
        {props.rows.map((row, i) => (
          <div key={i} className="flex items-start py-2.5 px-1">
            <span className="text-white/40 text-xs w-28 shrink-0">{row.label}</span>
            <span className="text-white/90 text-xs flex-1">{row.value}</span>
          </div>
        ))}
      </div>
    )
  }

  const { columns, data } = props

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2a3040]">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left py-2 px-3 text-gray-400 font-medium whitespace-nowrap"
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-[#2a3040]/50 hover:bg-[#2a3040]/30 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className="py-2 px-3 text-gray-200 whitespace-nowrap">
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-gray-500">
                暂无数据
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
