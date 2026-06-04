import { useState } from 'react'
import { Upload, AlertTriangle, FileUp, Pencil, Check, X, ShieldAlert } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { STATUS_LABELS, STATUS_COLORS } from '@/types'
import type { CalibrationRecord } from '@/types'

const INIT_FORM = {
  batchNo: '',
  temperatureCalibration: '',
  sensorNo: '',
  sensorNote: '',
  mainMaterial: '',
  coefficient: '1.0',
  originalCoefficient: '',
}

export default function ImportPage() {
  const records = useStore((s) => s.records)
  const conflicts = useStore((s) => s.conflicts)
  const currentRole = useStore((s) => s.currentRole)
  const importRecord = useStore((s) => s.importRecord)
  const confirmConflict = useStore((s) => s.confirmConflict)
  const rejectConflict = useStore((s) => s.rejectConflict)
  const updateSensorNote = useStore((s) => s.updateSensorNote)

  const [form, setForm] = useState(INIT_FORM)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [editingRecord, setEditingRecord] = useState<CalibrationRecord | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleImport = () => {
    if (!form.batchNo || !form.sensorNo) return
    const result = importRecord({
      batchNo: form.batchNo,
      temperatureCalibration: form.temperatureCalibration,
      sensorNo: form.sensorNo,
      sensorNote: form.sensorNote,
      mainMaterial: form.mainMaterial,
      coefficient: parseFloat(form.coefficient) || 1.0,
      originalCoefficient: form.originalCoefficient ? parseFloat(form.originalCoefficient) : null,
      coefficientChangeReason: null,
    })
    setDuplicateWarning(
      result.duplicate
        ? `批次号 ${form.batchNo} + 传感器 ${form.sensorNo} 存在重复导入`
        : null,
    )
    setForm(INIT_FORM)
  }

  const openNoteEditor = (r: CalibrationRecord) => {
    setEditingRecord(r)
    setNoteDraft(r.sensorNote)
  }

  const saveNote = () => {
    if (editingRecord) {
      updateSensorNote(editingRecord.id, noteDraft)
      setEditingRecord(null)
    }
  }

  const isMismatched = (r: CalibrationRecord) =>
    r.temperatureCalibration !== r.sensorNote

  return (
    <div className="space-y-6 font-sans">
      <section className="rounded-lg border border-steel-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-steel-900">
          <Upload className="h-4 w-4 text-amber" />
          温度校准记录导入
        </h2>

        {duplicateWarning && (
          <div className="mb-4 flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {duplicateWarning}
          </div>
        )}

        <div className="mb-4 grid grid-cols-4 gap-3">
          {[
            ['batchNo', '批次号'], ['temperatureCalibration', '温度校准'],
            ['sensorNo', '传感器编号'], ['sensorNote', '传感器备注'],
            ['mainMaterial', '主体材质'], ['coefficient', '系数'],
          ].map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1 text-xs text-steel-600">
              {label}
              <input
                className="rounded border border-steel-200 px-2 py-1.5 font-mono text-sm focus:border-amber focus:outline-none"
                value={(form as any)[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </label>
          ))}
          <label className="flex flex-col gap-1 text-xs text-steel-600">
            原始系数（选填）
            <input
              className="rounded border border-steel-200 px-2 py-1.5 font-mono text-sm focus:border-amber focus:outline-none"
              value={form.originalCoefficient}
              onChange={(e) => set('originalCoefficient', e.target.value)}
              placeholder="可选"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={handleImport}
              className="flex items-center gap-1.5 rounded bg-steel-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-steel-800"
            >
              <FileUp className="h-3.5 w-3.5" />
              导入
            </button>
          </div>
        </div>

        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-steel-300 bg-steel-50/50 py-6 transition-colors hover:border-amber hover:bg-amber-50/30"
          onClick={handleImport}
        >
          <Upload className="h-7 w-7 text-steel-400" />
          <p className="mt-1.5 text-sm text-steel-500">点击或拖拽模拟导入校准记录</p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-steel-200 text-left text-xs text-steel-500">
                <th className="pb-2 pr-4 font-medium">批次号</th>
                <th className="pb-2 pr-4 font-medium">传感器</th>
                <th className="pb-2 pr-4 font-medium">温度校准</th>
                <th className="pb-2 pr-4 font-medium">系数</th>
                <th className="pb-2 pr-4 font-medium">状态</th>
                <th className="pb-2 font-medium">导入时间</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {records.map((r) => (
                <tr key={r.id} className="border-b border-steel-100 hover:bg-steel-50/50">
                  <td className="py-2 pr-4 text-steel-800">{r.batchNo}</td>
                  <td className="py-2 pr-4 text-steel-800">{r.sensorNo}</td>
                  <td className="py-2 pr-4 text-steel-800">{r.temperatureCalibration}</td>
                  <td className="py-2 pr-4 text-steel-800">{r.coefficient}</td>
                  <td className="py-2 pr-4">
                    <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-sans ${STATUS_COLORS[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="py-2 text-steel-500">{r.importedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-steel-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-steel-900">
          <Pencil className="h-4 w-4 text-amber" />
          传感器编号补看
        </h2>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-steel-200 text-left text-xs text-steel-500">
              <th className="pb-2 pr-4 font-medium font-sans">传感器编号</th>
              <th className="pb-2 pr-4 font-medium font-sans">传感器备注</th>
              <th className="pb-2 pr-4 font-medium font-sans">温度校准值</th>
              <th className="pb-2 font-medium font-sans">操作</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {records.map((r) => (
              <tr
                key={r.id}
                className={`border-b border-steel-100 cursor-pointer hover:bg-steel-50/50 ${
                  isMismatched(r) ? 'bg-amber-50/40' : ''
                }`}
                onClick={() => openNoteEditor(r)}
              >
                <td className="py-2 pr-4 text-steel-800">{r.sensorNo}</td>
                <td className={`py-2 pr-4 ${isMismatched(r) ? 'text-amber-700 font-semibold' : 'text-steel-800'}`}>
                  {r.sensorNote}
                  {isMismatched(r) && <span className="ml-1.5 text-[10px] font-sans text-amber-600">⚠ 不一致</span>}
                </td>
                <td className="py-2 pr-4 text-steel-800">{r.temperatureCalibration}</td>
                <td className="py-2">
                  <button className="rounded px-2 py-0.5 text-[11px] font-sans text-steel-600 transition-colors hover:bg-steel-100">
                    编辑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-steel-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-steel-900">
          <ShieldAlert className="h-4 w-4 text-amber" />
          冲突检测面板
        </h2>

        {conflicts.length === 0 && (
          <p className="text-sm text-steel-400">暂无冲突记录</p>
        )}

        <div className="space-y-3">
          {conflicts.map((c) => {
            const isPending = c.resolution === 'pending'
            const severityClass = c.severity === 'high'
              ? 'border-red-300 bg-red-50/50'
              : 'border-amber-300 bg-amber-50/50'
            const badgeClass = c.severity === 'high'
              ? 'bg-red-100 text-red-700'
              : 'bg-amber-100 text-amber-700'

            return (
              <div key={c.id} className={`rounded-lg border p-4 ${severityClass}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-sm font-medium text-steel-800">{c.field}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-sans ${badgeClass}`}>
                      {c.severity === 'high' ? '高' : '中'}
                    </span>
                    {!isPending && (
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-sans ${
                        c.resolution === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-steel-100 text-steel-500 line-through'
                      }`}>
                        {c.resolution === 'confirmed' ? '已确认' : '已驳回'}
                      </span>
                    )}
                  </div>
                  {c.resolvedBy && (
                    <span className="text-[11px] font-sans text-steel-400">
                      {c.resolvedBy} · {c.resolvedAt}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-3 font-mono text-sm">
                  <div className="rounded border border-steel-200 bg-white px-3 py-1.5">
                    <span className="text-[10px] font-sans text-steel-400">校准值</span>
                    <p className="text-steel-800">{c.calibrationValue}</p>
                  </div>
                  <span className="text-steel-300">vs</span>
                  <div className="rounded border border-steel-200 bg-white px-3 py-1.5">
                    <span className="text-[10px] font-sans text-steel-400">传感器值</span>
                    <p className="text-steel-800">{c.sensorValue}</p>
                  </div>
                </div>

                {isPending && currentRole === 'inspector' && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => confirmConflict(c.id)}
                      className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-xs font-sans font-medium text-white transition-colors hover:bg-emerald-700"
                    >
                      <Check className="h-3 w-3" /> 确认
                    </button>
                    <button
                      onClick={() => rejectConflict(c.id)}
                      className="flex items-center gap-1 rounded border border-steel-300 bg-white px-3 py-1 text-xs font-sans font-medium text-steel-600 transition-colors hover:bg-steel-50"
                    >
                      <X className="h-3 w-3" /> 驳回
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingRecord(null)}>
          <div className="w-96 rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold text-steel-900 font-sans">
              编辑传感器备注 — {editingRecord.sensorNo}
            </h3>
            <textarea
              className="w-full rounded border border-steel-200 px-3 py-2 font-mono text-sm focus:border-amber focus:outline-none"
              rows={3}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setEditingRecord(null)}
                className="rounded border border-steel-200 px-3 py-1.5 text-xs font-sans text-steel-600 hover:bg-steel-50"
              >
                取消
              </button>
              <button
                onClick={saveNote}
                className="rounded bg-steel-900 px-3 py-1.5 text-xs font-sans font-medium text-white hover:bg-steel-800"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
