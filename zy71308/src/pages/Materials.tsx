import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/store/useStore'
import { Plus, Save, X, Trash2, FileDown, FileText } from 'lucide-react'

interface EditingRow {
  id: number
  name: string
  min_energy_density: string
  max_energy_density: string
  recommended_power: string
  recommended_speed: string
  focal_range_min: string
  focal_range_max: string
}

const emptyRow = (): EditingRow => ({
  id: 0,
  name: '',
  min_energy_density: '',
  max_energy_density: '',
  recommended_power: '',
  recommended_speed: '',
  focal_range_min: '',
  focal_range_max: '',
})

const numericFields = [
  'min_energy_density',
  'max_energy_density',
  'recommended_power',
  'recommended_speed',
  'focal_range_min',
  'focal_range_max',
] as const

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function Materials() {
  const {
    materials,
    fetchMaterials,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    generateReport,
  } = useStore()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [editData, setEditData] = useState<EditingRow>(emptyRow())
  const [startDate, setStartDate] = useState(formatDate(new Date(Date.now() - 30 * 86400000)))
  const [endDate, setEndDate] = useState(formatDate(new Date()))
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([])
  const [reportHtml, setReportHtml] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetchMaterials()
  }, [fetchMaterials])

  const startEdit = useCallback((mat: typeof materials[number]) => {
    setEditingId(mat.id)
    setIsNew(false)
    setEditData({
      id: mat.id,
      name: mat.name,
      min_energy_density: String(mat.min_energy_density),
      max_energy_density: String(mat.max_energy_density),
      recommended_power: String(mat.recommended_power),
      recommended_speed: String(mat.recommended_speed),
      focal_range_min: String(mat.focal_range_min),
      focal_range_max: String(mat.focal_range_max),
    })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setIsNew(false)
    setEditData(emptyRow())
  }, [])

  const handleAdd = useCallback(() => {
    setEditingId(0)
    setIsNew(true)
    setEditData(emptyRow())
  }, [])

  const handleSave = useCallback(async () => {
    const payload = {
      name: editData.name,
      min_energy_density: Number(editData.min_energy_density),
      max_energy_density: Number(editData.max_energy_density),
      recommended_power: Number(editData.recommended_power),
      recommended_speed: Number(editData.recommended_speed),
      focal_range_min: Number(editData.focal_range_min),
      focal_range_max: Number(editData.focal_range_max),
    }
    if (isNew) {
      await addMaterial(payload)
    } else {
      await updateMaterial(editData.id, payload)
    }
    cancelEdit()
  }, [editData, isNew, addMaterial, updateMaterial, cancelEdit])

  const handleDelete = useCallback(async (id: number) => {
    if (window.confirm('确认删除该材料？')) {
      await deleteMaterial(id)
    }
  }, [deleteMaterial])

  const handleFieldChange = useCallback((field: keyof EditingRow, value: string) => {
    setEditData((prev) => ({ ...prev, [field]: value }))
  }, [])

  const toggleMaterial = useCallback((id: number) => {
    setSelectedMaterialIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }, [])

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    const html = await generateReport({
      start_date: startDate,
      end_date: endDate,
      material_ids: selectedMaterialIds,
    })
    setReportHtml(html)
    setGenerating(false)
  }, [startDate, endDate, selectedMaterialIds, generateReport])

  const handleExport = useCallback(() => {
    if (!reportHtml) return
    const blob = new Blob([reportHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report_${startDate}_${endDate}.html`
    a.click()
    URL.revokeObjectURL(url)
  }, [reportHtml, startDate, endDate])

  const isEditing = (id: number) => editingId === id

  const columns = [
    '材料名称',
    '最低能量密度\n(J/mm²)',
    '最高能量密度\n(J/mm²)',
    '推荐功率\n(W)',
    '推荐速度\n(mm/s)',
    '焦距最小\n(mm)',
    '焦距最大\n(mm)',
    '操作',
  ]

  return (
    <div className="h-full overflow-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-txt-primary">材料库与报告</h1>

      <section>
        <h2 className="text-lg font-semibold text-txt-primary mb-4">材料阈值管理</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-secondary">
                {columns.map((col, i) => (
                  <th
                    key={i}
                    className="px-3 py-2.5 text-left text-txt-muted font-medium whitespace-pre-line"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {materials.map((mat) =>
                isEditing(mat.id) ? (
                  <tr key={mat.id} className="bg-bg-card border-t border-border">
                    <td className="px-3 py-2">
                      <input
                        className="w-full bg-bg-input border border-border rounded px-2 py-1 text-txt-primary outline-none focus:border-amber"
                        value={editData.name}
                        onChange={(e) => handleFieldChange('name', e.target.value)}
                      />
                    </td>
                    {numericFields.map((field) => (
                      <td key={field} className="px-3 py-2">
                        <input
                          type="number"
                          className="w-full bg-bg-input border border-border rounded px-2 py-1 text-txt-primary font-mono outline-none focus:border-amber"
                          value={editData[field]}
                          onChange={(e) => handleFieldChange(field, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber text-bg-primary text-xs font-medium hover:brightness-110"
                        >
                          <Save className="w-3.5 h-3.5" />保存
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-bg-input border border-border text-txt-secondary text-xs hover:text-txt-primary"
                        >
                          <X className="w-3.5 h-3.5" />取消
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={mat.id}
                    className="border-t border-border hover:bg-bg-card cursor-pointer transition-colors"
                    onClick={() => startEdit(mat)}
                  >
                    <td className="px-3 py-2.5 text-txt-primary">{mat.name}</td>
                    <td className="px-3 py-2.5 text-txt-primary font-mono">{mat.min_energy_density}</td>
                    <td className="px-3 py-2.5 text-txt-primary font-mono">{mat.max_energy_density}</td>
                    <td className="px-3 py-2.5 text-txt-primary font-mono">{mat.recommended_power}</td>
                    <td className="px-3 py-2.5 text-txt-primary font-mono">{mat.recommended_speed}</td>
                    <td className="px-3 py-2.5 text-txt-primary font-mono">{mat.focal_range_min}</td>
                    <td className="px-3 py-2.5 text-txt-primary font-mono">{mat.focal_range_max}</td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDelete(mat.id)}
                        className="text-laser-red hover:text-red-400 text-xs"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              )}
              {isNew && isEditing(0) && (
                <tr className="bg-bg-card border-t border-border">
                  <td className="px-3 py-2">
                    <input
                      className="w-full bg-bg-input border border-border rounded px-2 py-1 text-txt-primary outline-none focus:border-amber"
                      value={editData.name}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      placeholder="材料名称"
                      autoFocus
                    />
                  </td>
                  {numericFields.map((field) => (
                    <td key={field} className="px-3 py-2">
                      <input
                        type="number"
                        className="w-full bg-bg-input border border-border rounded px-2 py-1 text-txt-primary font-mono outline-none focus:border-amber"
                        value={editData[field]}
                        onChange={(e) => handleFieldChange(field, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber text-bg-primary text-xs font-medium hover:brightness-110"
                      >
                        <Save className="w-3.5 h-3.5" />保存
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-bg-input border border-border text-txt-secondary text-xs hover:text-txt-primary"
                      >
                        <X className="w-3.5 h-3.5" />取消
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <button
          onClick={handleAdd}
          disabled={isNew}
          className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-bg-input border border-border text-txt-secondary text-sm hover:text-txt-primary hover:border-amber disabled:opacity-40 transition-colors"
        >
          <Plus className="w-4 h-4" />添加材料
        </button>
      </section>

      <div className="border-t border-border" />

      <section>
        <h2 className="text-lg font-semibold text-txt-primary mb-4">报告导出</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="block text-sm text-txt-secondary">开始日期</label>
            <input
              type="date"
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-txt-primary outline-none focus:border-amber"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-txt-secondary">结束日期</label>
            <input
              type="date"
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-txt-primary outline-none focus:border-amber"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-txt-secondary">选择材料</label>
            <div className="bg-bg-input border border-border rounded-lg px-3 py-2 max-h-36 overflow-y-auto space-y-1.5">
              {materials.length === 0 && (
                <span className="text-txt-muted text-sm">暂无材料</span>
              )}
              {materials.map((mat) => (
                <label key={mat.id} className="flex items-center gap-2 text-sm text-txt-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedMaterialIds.includes(mat.id)}
                    onChange={() => toggleMaterial(mat.id)}
                    className="accent-amber"
                  />
                  {mat.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber text-bg-primary font-medium text-sm hover:brightness-110 disabled:opacity-50 transition"
          >
            <FileText className="w-4 h-4" />
            {generating ? '生成中...' : '生成报告'}
          </button>
          {reportHtml && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-bg-input border border-border text-txt-secondary text-sm hover:text-txt-primary transition"
            >
              <FileDown className="w-4 h-4" />导出 HTML
            </button>
          )}
        </div>

        {reportHtml && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-txt-secondary mb-2">报告预览</h3>
            <div className="rounded-lg border border-border overflow-hidden bg-white">
              <iframe
                srcDoc={reportHtml}
                className="w-full h-[500px] border-0"
                title="报告预览"
              />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
