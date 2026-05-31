import { useState, useCallback, useEffect } from "react"
import { useStore } from "@/store/index"
import type { PhotoRecord, SourceType, AuthStatus } from "@/lib/types"
import {
  AUTH_STATUS_OPTIONS,
  SOURCE_TYPE_OPTIONS,
  FIELD_LABELS,
} from "@/lib/types"
import { judgeRecord } from "@/lib/judge"
import { cn } from "@/lib/utils"
import {
  CheckSquare,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Save,
  User,
  MessageSquare,
  Check,
  Square,
} from "lucide-react"

interface EditFormState {
  fileName: string
  shootDate: string
  sourceType: SourceType
  authorizationStatus: AuthStatus
  authorizationExpiry: string
  authorizationContact: string
  reviewOpinion: string
  specVersion: string
  changeReason: string
  changedBy: string
}

function toEditForm(record: PhotoRecord): EditFormState {
  return {
    fileName: record.fileName,
    shootDate: record.shootDate,
    sourceType: record.sourceType,
    authorizationStatus: record.authorizationStatus,
    authorizationExpiry: record.authorizationExpiry ?? "",
    authorizationContact: record.authorizationContact ?? "",
    reviewOpinion: record.reviewOpinion,
    specVersion: record.specVersion,
    changeReason: "",
    changedBy: "",
  }
}

export default function Review() {
  const photoRecords = useStore((s) => s.photoRecords)
  const updatePhotoRecord = useStore((s) => s.updatePhotoRecord)
  const confirmRecords = useStore((s) => s.confirmRecords)
  const currentProject = useStore((s) => s.currentProject)
  const loadPhotoRecords = useStore((s) => s.loadPhotoRecords)
  const loadProjects = useStore((s) => s.loadProjects)
  const projects = useStore((s) => s.projects)
  const setCurrentProject = useStore((s) => s.setCurrentProject)

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    if (currentProject) {
      loadPhotoRecords(currentProject.id)
    }
  }, [currentProject, loadPhotoRecords])

  const reviewRecords = photoRecords.filter(
    (r) => r.markStatus === "待复核" || r.markStatus === "授权过期"
  )

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editForms, setEditForms] = useState<Record<string, EditFormState>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmReason, setConfirmReason] = useState("")
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [batchConfirming, setBatchConfirming] = useState(false)

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => {
      if (prev === id) return null
      return id
    })
  }, [])

  const getForm = useCallback(
    (record: PhotoRecord): EditFormState => {
      if (editForms[record.id]) return editForms[record.id]
      return toEditForm(record)
    },
    [editForms]
  )

  const updateForm = useCallback(
    (id: string, field: keyof EditFormState, value: string) => {
      setEditForms((prev) => ({
        ...prev,
        [id]: { ...(prev[id] ?? toEditForm(photoRecords.find((r) => r.id === id)!)), [field]: value },
      }))
    },
    [photoRecords]
  )

  const handleSave = useCallback(
    async (record: PhotoRecord) => {
      const form = getForm(record)
      if (!form.changeReason.trim()) return
      if (!form.changedBy.trim()) return

      const changes: Partial<PhotoRecord> = {}
      const fields: (keyof EditFormState)[] = [
        "fileName",
        "shootDate",
        "sourceType",
        "authorizationStatus",
        "authorizationExpiry",
        "authorizationContact",
        "reviewOpinion",
        "specVersion",
      ]
      for (const f of fields) {
        const oldVal = String((record as unknown as Record<string, unknown>)[f] ?? "")
        const newVal = f === "authorizationExpiry" || f === "authorizationContact"
          ? (form[f] || null)
          : form[f]
        if (oldVal !== String(newVal)) {
          ;(changes as Record<string, unknown>)[f] = newVal
        }
      }

      if (Object.keys(changes).length > 0) {
        await updatePhotoRecord(record.id, changes, form.changedBy, form.changeReason)
      }

      if (currentProject) {
        const updatedRecord = { ...record, ...changes }
        const result = judgeRecord(updatedRecord as PhotoRecord, currentProject.specVersion)
        await updatePhotoRecord(record.id, {
          markStatus: result.markStatus,
          markReason: result.markReason,
          nextStep: result.nextStep,
        }, form.changedBy, "自动重新判断")
      }

      setExpandedId(null)
      setEditForms((prev) => {
        const next = { ...prev }
        delete next[record.id]
        return next
      })
    },
    [getForm, updatePhotoRecord, currentProject]
  )

  const handleCancel = useCallback((record: PhotoRecord) => {
    setExpandedId(null)
    setEditForms((prev) => {
      const next = { ...prev }
      delete next[record.id]
      return next
    })
  }, [])

  const handleConfirm = useCallback(
    async (id: string) => {
      if (!confirmReason.trim()) return
      await updatePhotoRecord(id, { markStatus: "已确认" }, "系统", confirmReason)
      setConfirmingId(null)
      setConfirmReason("")
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    },
    [confirmReason, updatePhotoRecord]
  )

  const handleRejudge = useCallback(
    (record: PhotoRecord) => {
      if (!currentProject) return
      const result = judgeRecord(record, currentProject.specVersion)
      setEditForms((prev) => ({
        ...prev,
        [record.id]: {
          ...(prev[record.id] ?? toEditForm(record)),
          authorizationStatus: record.authorizationStatus,
          specVersion: record.specVersion,
          reviewOpinion: record.reviewOpinion,
          changeReason: `重新判断：${result.markReason}`,
          changedBy: "系统",
        },
      }))
      updatePhotoRecord(record.id, {
        markStatus: result.markStatus,
        markReason: result.markReason,
        nextStep: result.nextStep,
      }, "系统", "重新触发自动判断")
    },
    [currentProject, updatePhotoRecord]
  )

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (selectedIds.size === reviewRecords.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(reviewRecords.map((r) => r.id)))
    }
  }, [selectedIds.size, reviewRecords])

  const handleBatchConfirm = useCallback(async () => {
    if (selectedIds.size === 0) return
    setBatchConfirming(true)
    await confirmRecords(Array.from(selectedIds))
    setSelectedIds(new Set())
    setBatchConfirming(false)
  }, [selectedIds, confirmRecords])

  const allSelected = reviewRecords.length > 0 && selectedIds.size === reviewRecords.length

  return (
    <div className="min-h-screen bg-[#0f0f23] p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-100">复核修正</h1>
            <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-[#e94560] px-2 text-sm font-semibold text-white">
              {reviewRecords.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={currentProject?.id ?? ""}
              onChange={(e) => {
                const p = projects.find((proj) => proj.id === e.target.value)
                setCurrentProject(p ?? null)
              }}
              className="rounded-lg border border-zinc-700 bg-[#1e1e38] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#e94560]"
            >
              <option value="">选择项目</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={selectAll}
              className="flex items-center gap-1.5 rounded-lg bg-[#1e1e38] px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-[#2a2a4a]"
            >
              {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              全选
            </button>
            <button
              onClick={handleBatchConfirm}
              disabled={selectedIds.size === 0 || batchConfirming}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                selectedIds.size > 0
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-[#1e1e38] text-zinc-500 cursor-not-allowed"
              )}
            >
              <Check className="h-4 w-4" />
              批量确认{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </button>
          </div>
        </div>

        {reviewRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <CheckSquare className="mb-3 h-12 w-12" />
            <p className="text-lg">暂无待复核记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviewRecords.map((record) => {
              const isExpanded = expandedId === record.id
              const form = getForm(record)
              const isSelected = selectedIds.has(record.id)
              const isConfirmingRecord = confirmingId === record.id

              return (
                <div
                  key={record.id}
                  className={cn(
                    "rounded-xl border-l-4 bg-[#1e1e38] transition-shadow",
                    record.markStatus === "授权过期"
                      ? "border-l-amber-500"
                      : "border-l-sky-500",
                    isExpanded && "shadow-lg shadow-black/30"
                  )}
                >
                  <div
                    className="flex cursor-pointer items-center gap-3 p-4"
                    onClick={() => toggleExpand(record.id)}
                  >
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelect(record.id)
                      }}
                      className="shrink-0 cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <Square className="h-5 w-5 text-zinc-500" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-zinc-100">
                          {record.fileName}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                            record.markStatus === "授权过期"
                              ? "bg-amber-900/60 text-amber-400 border border-amber-700/50"
                              : "bg-sky-900/60 text-sky-400 border border-sky-700/50"
                          )}
                        >
                          {record.markStatus}
                        </span>
                        <span className="shrink-0 rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                          {record.sourceType}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-400">
                        {record.markReason}
                      </p>
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-zinc-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-zinc-400" />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-700/50 px-4 pb-4 pt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">
                            {FIELD_LABELS.fileName}
                          </label>
                          <input
                            value={form.fileName}
                            onChange={(e) => updateForm(record.id, "fileName", e.target.value)}
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-zinc-100 focus:border-[#e94560] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">
                            {FIELD_LABELS.shootDate}
                          </label>
                          <input
                            type="date"
                            value={form.shootDate}
                            onChange={(e) => updateForm(record.id, "shootDate", e.target.value)}
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-zinc-100 focus:border-[#e94560] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">
                            {FIELD_LABELS.sourceType}
                          </label>
                          <select
                            value={form.sourceType}
                            onChange={(e) => updateForm(record.id, "sourceType", e.target.value)}
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-zinc-100 focus:border-[#e94560] focus:outline-none"
                          >
                            {SOURCE_TYPE_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">
                            {FIELD_LABELS.authorizationStatus}
                          </label>
                          <select
                            value={form.authorizationStatus}
                            onChange={(e) => updateForm(record.id, "authorizationStatus", e.target.value)}
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-zinc-100 focus:border-[#e94560] focus:outline-none"
                          >
                            {AUTH_STATUS_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">
                            {FIELD_LABELS.authorizationExpiry}
                          </label>
                          <input
                            type="date"
                            value={form.authorizationExpiry}
                            onChange={(e) => updateForm(record.id, "authorizationExpiry", e.target.value)}
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-zinc-100 focus:border-[#e94560] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">
                            {FIELD_LABELS.authorizationContact}
                          </label>
                          <input
                            value={form.authorizationContact}
                            onChange={(e) => updateForm(record.id, "authorizationContact", e.target.value)}
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-zinc-100 focus:border-[#e94560] focus:outline-none"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="mb-1 block text-xs text-zinc-400">
                            {FIELD_LABELS.reviewOpinion}
                          </label>
                          <textarea
                            value={form.reviewOpinion}
                            onChange={(e) => updateForm(record.id, "reviewOpinion", e.target.value)}
                            rows={2}
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-zinc-100 focus:border-[#e94560] focus:outline-none resize-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-400">
                            {FIELD_LABELS.specVersion}
                          </label>
                          <input
                            value={form.specVersion}
                            onChange={(e) => updateForm(record.id, "specVersion", e.target.value)}
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-zinc-100 focus:border-[#e94560] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-700/50 pt-3">
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-xs text-[#e94560]">
                            <MessageSquare className="h-3 w-3" />
                            修改原因
                          </label>
                          <input
                            value={form.changeReason}
                            onChange={(e) => updateForm(record.id, "changeReason", e.target.value)}
                            placeholder="必填"
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-[#e94560] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 flex items-center gap-1 text-xs text-zinc-400">
                            <User className="h-3 w-3" />
                            操作人
                          </label>
                          <input
                            value={form.changedBy}
                            onChange={(e) => updateForm(record.id, "changedBy", e.target.value)}
                            placeholder="必填"
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-[#e94560] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-gray-700/50 pt-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setConfirmingId(record.id)
                              setConfirmReason("")
                            }}
                            className="flex items-center gap-1 rounded-lg bg-emerald-600/20 px-3 py-1.5 text-sm text-emerald-400 transition-colors hover:bg-emerald-600/30"
                          >
                            <Check className="h-4 w-4" />
                            确认
                          </button>
                          <button
                            onClick={() => handleRejudge(record)}
                            className="flex items-center gap-1 rounded-lg bg-sky-600/20 px-3 py-1.5 text-sm text-sky-400 transition-colors hover:bg-sky-600/30"
                          >
                            <RefreshCw className="h-4 w-4" />
                            重新判断
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCancel(record)}
                            className="flex items-center gap-1 rounded-lg bg-zinc-700/50 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-700"
                          >
                            <XCircle className="h-4 w-4" />
                            取消
                          </button>
                          <button
                            onClick={() => handleSave(record)}
                            disabled={!form.changeReason.trim() || !form.changedBy.trim()}
                            className={cn(
                              "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                              form.changeReason.trim() && form.changedBy.trim()
                                ? "bg-[#e94560] text-white hover:bg-[#d63850]"
                                : "bg-zinc-700/50 text-zinc-500 cursor-not-allowed"
                            )}
                          >
                            <Save className="h-4 w-4" />
                            保存
                          </button>
                        </div>
                      </div>

                      {isConfirmingRecord && (
                        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-700/30 bg-emerald-900/20 p-3">
                          <MessageSquare className="h-4 w-4 shrink-0 text-emerald-400" />
                          <input
                            value={confirmReason}
                            onChange={(e) => setConfirmReason(e.target.value)}
                            placeholder="请输入确认原因（必填）"
                            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
                          />
                          <button
                            onClick={() => handleConfirm(record.id)}
                            disabled={!confirmReason.trim()}
                            className={cn(
                              "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                              confirmReason.trim()
                                ? "bg-emerald-600 text-white hover:bg-emerald-500"
                                : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                            )}
                          >
                            确定确认
                          </button>
                          <button
                            onClick={() => {
                              setConfirmingId(null)
                              setConfirmReason("")
                            }}
                            className="rounded-lg bg-zinc-700/50 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-700"
                          >
                            取消
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
