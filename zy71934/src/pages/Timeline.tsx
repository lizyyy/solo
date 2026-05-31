import React, { useMemo } from "react"
import { useStore } from "@/store/useStore"
import StatusBadge from "@/components/StatusBadge"
import { FILE_TYPE_LABELS, type RecordStatus, type LinkedFile } from "@/types"
import { Link } from "react-router-dom"
import { ShieldCheck, Package, Layout, Filter, Search, ChevronDown } from "lucide-react"

const FILE_ICONS: Record<string, React.ElementType> = {
  authorization: ShieldCheck,
  asset_pack: Package,
  layout_draft: Layout,
}

const FILE_TYPES = ["authorization", "asset_pack", "layout_draft"] as const

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "confirmed", label: "已确认" },
  { value: "pending", label: "待补" },
  { value: "manual_corrected", label: "人工改过" },
]

function FileNode({ type, recordId, linkedFiles }: { type: string; recordId: string; linkedFiles: LinkedFile[] }) {
  const setSelectedFile = useStore((s) => s.setSelectedFile)
  const file = linkedFiles.find((f) => f.type === type && !f.isDuplicate)
  const Icon = FILE_ICONS[type]
  const filled = !!file
  return (
    <button
      onClick={filled ? () => setSelectedFile(file.id, recordId) : undefined}
      className={`flex items-center gap-1.5 text-xs ${filled ? "text-[#4A6FA5] cursor-pointer" : "text-gray-400 cursor-default"}`}
    >
      <span
        className={`flex items-center justify-center w-5 h-5 rounded-full border ${filled ? "border-[#4A6FA5] bg-[#4A6FA5]/10" : "border-gray-300 bg-gray-100"}`}
      >
        {filled ? <Icon size={10} /> : <Icon size={10} className="opacity-40" />}
      </span>
      <span className="whitespace-nowrap">{FILE_TYPE_LABELS[type as keyof typeof FILE_TYPE_LABELS]}</span>
      {!filled && <span className="text-gray-300 text-[10px] leading-none">×</span>}
    </button>
  )
}

export default function Timeline() {
  const allRecords = useStore((s) => s.records)
  const statusFilter = useStore((s) => s.statusFilter)
  const searchQuery = useStore((s) => s.searchQuery)
  const setStatusFilter = useStore((s) => s.setStatusFilter)
  const setSearchQuery = useStore((s) => s.setSearchQuery)
  const [dropdownOpen, setDropdownOpen] = React.useState(false)

  const records = useMemo(() => {
    return allRecords.filter((r) => {
      const matchStatus = statusFilter === "all" || r.status === statusFilter
      const matchSearch = !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase())
      return matchStatus && matchSearch
    })
  }, [allRecords, statusFilter, searchQuery])

  const currentLabel = STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? "全部"

  return (
    <div className="min-h-screen bg-[#F5F3EF]">
      <div className="max-w-7xl mx-auto px-6 pt-8 pb-4">
        <h1 className="font-serif text-2xl font-semibold text-gray-800">统一时间线</h1>
        <p className="mt-1 text-sm text-gray-500">授权文件 · 素材包 · 版式稿 同线浏览</p>

        <div className="mt-4 flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm"
            >
              <Filter size={14} />
              {currentLabel}
              <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {dropdownOpen && (
              <ul className="absolute left-0 top-full z-10 mt-1 w-32 rounded-lg border border-gray-200 bg-white shadow-lg">
                {STATUS_OPTIONS.map((opt) => (
                  <li key={opt.value}>
                    <button
                      onClick={() => { setStatusFilter(opt.value); setDropdownOpen(false) }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${statusFilter === opt.value ? "font-medium text-[#4A6FA5]" : "text-gray-700"}`}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索委托记录…"
              className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm shadow-sm outline-none focus:border-[#4A6FA5]"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto px-6 pb-10">
        {records.length === 0 ? (
          <p className="mt-16 text-center text-sm text-gray-400">暂无匹配记录</p>
        ) : (
          <div className="relative mt-6 flex items-start gap-0" style={{ minWidth: records.length * 240 }}>
            <div className="absolute top-[22px] left-0 right-0 h-[2px] bg-[#4A6FA5]/20" />
            {records.map((record) => (
              <div key={record.id} className="relative flex flex-col items-center" style={{ width: 240, minWidth: 240 }}>
                <span className="absolute top-[15px] z-10 h-4 w-4 rounded-full border-2 border-[#4A6FA5] bg-[#F5F3EF]" />
                <span className="mb-3 mt-[34px] text-xs text-gray-400">{record.date}</span>

                <div className="w-[200px] rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5">
                  <Link to="/schedule" className="text-sm font-medium text-[#4A6FA5] hover:underline line-clamp-1">
                    {record.title}
                  </Link>
                  <div className="mt-1.5">
                    <StatusBadge status={record.status as RecordStatus} />
                  </div>

                  <div className="mt-3 flex flex-col gap-1.5">
                    {FILE_TYPES.map((ft) => (
                      <FileNode key={ft} type={ft} recordId={record.id} linkedFiles={record.linkedFiles} />
                    ))}
                  </div>

                  {(record.linkedFiles.some((f) => f.isLateArrival) || record.linkedFiles.some((f) => f.isDuplicate)) && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {record.linkedFiles.some((f) => f.isLateArrival) && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">晚到</span>
                      )}
                      {record.linkedFiles.some((f) => f.isDuplicate) && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">重复</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
