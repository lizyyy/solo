import { useState, useEffect, useCallback } from "react"
import { useStore } from "@/store/index"
import { FIELD_OPTIONS, FIELD_LABELS, type ExportSpec, type ExportFormat } from "@/lib/types"
import { exportToCSV, exportToExcel, downloadFile } from "@/lib/fileUtils"
import * as db from "@/lib/db"
import {
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Check,
  AlertTriangle,
  X,
  Edit2,
  Trash2,
} from "lucide-react"

const FORMAT_ICONS: Record<ExportFormat, typeof FileText> = {
  csv: FileText,
  xlsx: FileSpreadsheet,
}

const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: "CSV",
  xlsx: "Excel",
}

function formatDate(ts: number) {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export default function Export() {
  const projects = useStore((s) => s.projects)
  const currentProject = useStore((s) => s.currentProject)
  const photoRecords = useStore((s) => s.photoRecords)
  const exportSpecs = useStore((s) => s.exportSpecs)
  const loadProjects = useStore((s) => s.loadProjects)
  const loadPhotoRecords = useStore((s) => s.loadPhotoRecords)
  const loadExportSpecs = useStore((s) => s.loadExportSpecs)
  const saveExportSpec = useStore((s) => s.saveExportSpec)
  const setCurrentProject = useStore((s) => s.setCurrentProject)

  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null)
  const [editingSpecId, setEditingSpecId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [formName, setFormName] = useState("")
  const [formFormat, setFormFormat] = useState<ExportFormat>("xlsx")
  const [formColumns, setFormColumns] = useState<string[]>([...FIELD_OPTIONS])

  const projectRecords = currentProject
    ? photoRecords.filter((r) => r.projectId === currentProject.id)
    : []
  const mismatchedRecords = currentProject
    ? projectRecords.filter((r) => r.specVersion !== currentProject.specVersion)
    : []
  const isConsistent = currentProject ? mismatchedRecords.length === 0 : true
  const selectedSpec = exportSpecs.find((s) => s.id === selectedSpecId) ?? null

  const resetForm = useCallback(() => {
    setFormName("")
    setFormFormat("xlsx")
    setFormColumns([...FIELD_OPTIONS])
    setEditingSpecId(null)
    setShowNewForm(false)
  }, [])

  const startEdit = useCallback((spec: ExportSpec) => {
    setEditingSpecId(spec.id)
    setShowNewForm(false)
    setFormName(spec.name)
    setFormFormat(spec.format)
    setFormColumns([...spec.columns])
  }, [])

  const startNew = useCallback(() => {
    resetForm()
    setShowNewForm(true)
  }, [resetForm])

  const handleSaveSpec = useCallback(async () => {
    if (!formName.trim()) return
    const spec: ExportSpec = {
      id: editingSpecId ?? crypto.randomUUID(),
      name: formName.trim(),
      format: formFormat,
      columns: formColumns,
      lastUsedAt: Date.now(),
    }
    await saveExportSpec(spec)
    setSelectedSpecId(spec.id)
    resetForm()
  }, [formName, formFormat, formColumns, editingSpecId, saveExportSpec, resetForm])

  const handleDeleteSpec = useCallback(
    async (id: string) => {
      await db.db.exportSpecs.delete(id)
      useStore.setState((s) => ({
        exportSpecs: s.exportSpecs.filter((sp) => sp.id !== id),
      }))
      if (selectedSpecId === id) setSelectedSpecId(null)
    },
    [selectedSpecId]
  )

  const handleExport = useCallback(async () => {
    if (!selectedSpec || !currentProject) return

    const data = projectRecords.map((r) => {
      const row: Record<string, string> = {}
      for (const col of selectedSpec.columns) {
        row[col] = String((r as unknown as Record<string, unknown>)[col] ?? "")
      }
      return row
    })

    const dateStr = formatDate(Date.now())
    const ext = selectedSpec.format === "xlsx" ? "xlsx" : "csv"
    const filename = `摄影选片标记_${dateStr}_${currentProject.specVersion}.${ext}`

    if (selectedSpec.format === "xlsx") {
      const buffer = exportToExcel(data, selectedSpec.columns)
      downloadFile(buffer, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    } else {
      const csv = exportToCSV(data, selectedSpec.columns)
      downloadFile(csv, filename, "text/csv")
    }

    await saveExportSpec({ ...selectedSpec, lastUsedAt: Date.now() })
  }, [selectedSpec, currentProject, projectRecords, saveExportSpec])

  useEffect(() => {
    loadProjects()
    loadExportSpecs()
  }, [loadProjects, loadExportSpecs])

  useEffect(() => {
    if (currentProject) {
      loadPhotoRecords(currentProject.id)
    }
  }, [currentProject, loadPhotoRecords])

  const isFormOpen = showNewForm || editingSpecId !== null

  const previewRows = selectedSpec
    ? projectRecords.slice(0, 10).map((r) => {
        const row: Record<string, string> = {}
        for (const col of selectedSpec.columns) {
          row[col] = String((r as unknown as Record<string, unknown>)[col] ?? "")
        }
        return row
      })
    : []

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-bold text-zinc-100">导出</h1>

      <div className="rounded-lg bg-[#1e1e38] p-5">
        <label className="mb-2 block text-sm text-zinc-400">选择项目</label>
        <select
          className="w-full rounded-md border border-gray-700 bg-[#12122a] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500"
          value={currentProject?.id ?? ""}
          onChange={(e) => {
            const proj = projects.find((p) => p.id === e.target.value) ?? null
            setCurrentProject(proj)
            setSelectedSpecId(null)
          }}
        >
          <option value="" disabled>
            请选择项目
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg bg-[#1e1e38] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">导出规格</h2>
          <button
            onClick={startNew}
            className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-indigo-500"
          >
            <Plus size={14} />
            新建规格
          </button>
        </div>

        {exportSpecs.length === 0 && !isFormOpen && (
          <p className="py-6 text-center text-sm text-zinc-500">暂无导出规格，请点击「新建规格」创建</p>
        )}

        <div className="space-y-2">
          {exportSpecs.map((spec) => {
            const FormatIcon = FORMAT_ICONS[spec.format]
            const isSelected = selectedSpecId === spec.id
            const isEditing = editingSpecId === spec.id

            return (
              <div key={spec.id}>
                <div
                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-transparent hover:bg-white/5"
                  }`}
                  onClick={() => {
                    if (!isEditing) setSelectedSpecId(isSelected ? null : spec.id)
                  }}
                >
                  <FormatIcon size={16} className="shrink-0 text-zinc-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-100">{spec.name}</span>
                      <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-300">
                        {FORMAT_LABELS[spec.format]}
                      </span>
                      <span className="text-xs text-zinc-500">{spec.columns.length} 列</span>
                    </div>
                    <span className="text-xs text-zinc-500">上次使用: {formatDate(spec.lastUsedAt)}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        startEdit(spec)
                      }}
                      className="rounded p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteSpec(spec.id)
                      }}
                      className="rounded p-1 text-zinc-400 transition-colors hover:bg-red-500/20 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <SpecForm
                    formName={formName}
                    formFormat={formFormat}
                    formColumns={formColumns}
                    setFormName={setFormName}
                    setFormFormat={setFormFormat}
                    setFormColumns={setFormColumns}
                    onSave={handleSaveSpec}
                    onCancel={resetForm}
                  />
                )}
              </div>
            )
          })}
        </div>

        {showNewForm && (
          <div className="mt-3 rounded-md border border-dashed border-indigo-500/50 p-4">
            <SpecForm
              formName={formName}
              formFormat={formFormat}
              formColumns={formColumns}
              setFormName={setFormName}
              setFormFormat={setFormFormat}
              setFormColumns={setFormColumns}
              onSave={handleSaveSpec}
              onCancel={resetForm}
            />
          </div>
        )}
      </div>

      {currentProject && (
        <div className="rounded-lg bg-[#1e1e38] p-5">
          <h2 className="mb-3 text-lg font-semibold text-zinc-100">一致性校验</h2>
          {isConsistent ? (
            <div className="flex items-center gap-2 text-emerald-400">
              <Check size={18} />
              <span className="text-sm">交付说明与明细数据一致</span>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle size={18} />
                <span className="text-sm">发现 {mismatchedRecords.length} 条记录规格版本不一致</span>
              </div>
              <div className="mt-3 max-h-40 space-y-1 overflow-y-auto">
                {mismatchedRecords.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded bg-red-500/10 px-3 py-1.5 text-xs">
                    <span className="text-zinc-300">{r.fileName}</span>
                    <span className="text-zinc-500">→</span>
                    <span className="text-red-400">版本 {r.specVersion}</span>
                    <span className="text-zinc-600">（项目版本: {currentProject.specVersion}）</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedSpec && currentProject && (
        <div className="rounded-lg bg-[#1e1e38] p-5">
          <h2 className="mb-3 text-lg font-semibold text-zinc-100">导出预览</h2>
          {previewRows.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-500">暂无数据</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {selectedSpec.columns.map((col) => (
                      <th key={col} className="px-3 py-2 text-left text-xs font-medium text-zinc-400">
                        {FIELD_LABELS[col] ?? col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-800">
                      {selectedSpec.columns.map((col) => (
                        <td key={col} className="px-3 py-2 text-xs text-zinc-300">
                          {row[col]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {projectRecords.length > 10 && (
                <p className="mt-2 text-xs text-zinc-500">仅显示前 10 行，共 {projectRecords.length} 条记录</p>
              )}
            </div>
          )}
        </div>
      )}

      {selectedSpec && currentProject && (
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          <Download size={16} />
          导出文件
        </button>
      )}
    </div>
  )
}

function SpecForm({
  formName,
  formFormat,
  formColumns,
  setFormName,
  setFormFormat,
  setFormColumns,
  onSave,
  onCancel,
}: {
  formName: string
  formFormat: ExportFormat
  formColumns: string[]
  setFormName: (v: string) => void
  setFormFormat: (v: ExportFormat) => void
  setFormColumns: (v: string[]) => void
  onSave: () => void
  onCancel: () => void
}) {
  const toggleColumn = (col: string) => {
    setFormColumns(
      formColumns.includes(col) ? formColumns.filter((c) => c !== col) : [...formColumns, col]
    )
  }

  return (
    <div className="mt-3 space-y-4">
      <div>
        <label className="mb-1 block text-xs text-zinc-400">规格名称</label>
        <input
          className="w-full rounded-md border border-gray-700 bg-[#12122a] px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="输入规格名称"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">导出格式</label>
        <div className="flex gap-4">
          {(["xlsx", "csv"] as ExportFormat[]).map((fmt) => (
            <label key={fmt} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
              <input
                type="radio"
                name="format"
                value={fmt}
                checked={formFormat === fmt}
                onChange={() => setFormFormat(fmt)}
                className="accent-indigo-500"
              />
              {FORMAT_LABELS[fmt]}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">导出列</label>
        <div className="flex flex-wrap gap-3">
          {FIELD_OPTIONS.map((col) => (
            <label key={col} className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={formColumns.includes(col)}
                onChange={() => toggleColumn(col)}
                className="accent-indigo-500"
              />
              {FIELD_LABELS[col]}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={!formName.trim() || formColumns.length === 0}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
        >
          保存
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 rounded-md bg-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-600"
        >
          <X size={14} />
          取消
        </button>
      </div>
    </div>
  )
}
