import React from "react"
import { useStore } from "@/store/useStore"
import StatusBadge from "@/components/StatusBadge"
import { FILE_TYPE_LABELS, FileType, RecordStatus, STATUS_LABELS } from "@/types"
import { ShieldCheck, Package, Layout, ChevronRight, AlertCircle } from "lucide-react"

const GROUP_ORDER: RecordStatus[] = ["confirmed", "pending", "manual_corrected"]
const ACCENT_COLORS: Record<RecordStatus, string> = {
  confirmed: "#7BA37E",
  pending: "#D4A843",
  manual_corrected: "#C75C5C",
}
const ALL_FILE_TYPES: FileType[] = ["authorization", "asset_pack", "layout_draft"]
const FILE_ICONS: Record<FileType, React.ElementType> = {
  authorization: ShieldCheck,
  asset_pack: Package,
  layout_draft: Layout,
}

export default function Schedule() {
  const { records, setSelectedFile } = useStore()

  const groups = GROUP_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    color: ACCENT_COLORS[status],
    records: records.filter((r) => r.status === status),
  })).filter((g) => g.records.length > 0)

  return (
    <div className="min-h-screen bg-[#F5F3EF] p-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-semibold text-[var(--color-text)]">插画委托排期</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">按状态分组，可追溯至授权文件与素材包</p>
      </div>

      <div className="space-y-6">
        {groups.map(({ status, label, color, records: groupRecords }) => (
          <div
            key={status}
            className="rounded-lg bg-white shadow-sm border-l-4"
            style={{ borderLeftColor: color }}
          >
            <div className="flex items-center gap-2 px-6 py-4 border-b border-[var(--color-border)]">
              <ChevronRight size={16} style={{ color }} />
              <h2 className="text-sm font-semibold text-[var(--color-text)]">
                {label} ({groupRecords.length})
              </h2>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-muted)] border-b border-[var(--color-border)]">
                  <th className="px-6 py-3 font-medium">委托名称</th>
                  <th className="px-6 py-3 font-medium">日期</th>
                  <th className="px-6 py-3 font-medium">关联文件</th>
                  <th className="px-6 py-3 font-medium">状态</th>
                  <th className="px-6 py-3 font-medium">备注</th>
                </tr>
              </thead>
              <tbody>
                {groupRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[#F5F3EF]/50"
                  >
                    <td className="px-6 py-3 font-medium text-[var(--color-text)]">{record.title}</td>
                    <td className="px-6 py-3 text-[var(--color-muted)]">{record.date}</td>
                    <td className="px-6 py-3">
                      <div className="flex gap-1.5">
                        {ALL_FILE_TYPES.map((ft) => {
                          const file = record.linkedFiles.find((f) => f.type === ft && !f.isDuplicate)
                          const Icon = FILE_ICONS[ft]
                          if (file) {
                            return (
                              <button
                                key={ft}
                                onClick={() => setSelectedFile(file.id, record.id)}
                                className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[#4A6FA5] hover:bg-[#4A6FA5]/5 transition-colors"
                              >
                                <Icon size={13} />
                                {FILE_TYPE_LABELS[ft]}
                              </button>
                            )
                          }
                          return (
                            <span
                              key={ft}
                              className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-400"
                            >
                              <Icon size={13} />
                              未上传
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-6 py-3">
                      {record.correctionNote && (
                        <div className="flex items-start gap-1.5 text-xs text-[var(--color-corrected)]">
                          <AlertCircle size={13} className="mt-0.5 shrink-0" />
                          <span className="leading-relaxed">{record.correctionNote}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}
