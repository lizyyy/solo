import { useState } from 'react'
import { X, Plus, Syringe, Scale, FileText } from 'lucide-react'
import type {
  SupplementType,
  VaccineSupplementContent,
  WeightSupplementContent,
  NoteSupplementContent,
} from '@shared/types'
import { cn } from '@/lib/utils'

type SupplementPayload =
  | { type: 'vaccine'; content: VaccineSupplementContent }
  | { type: 'weight'; content: WeightSupplementContent }
  | { type: 'note'; content: NoteSupplementContent }

interface SupplementModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (payload: SupplementPayload) => void
}

const TABS: Array<{
  key: SupplementType
  label: string
  Icon: typeof Syringe
  cls: string
}> = [
  { key: 'vaccine', label: '补录疫苗', Icon: Syringe, cls: 'text-rose-600' },
  { key: 'weight', label: '补录体重', Icon: Scale, cls: 'text-emerald-600' },
  { key: 'note', label: '补录备注', Icon: FileText, cls: 'text-indigo-600' },
]

export default function SupplementModal({ open, onClose, onConfirm }: SupplementModalProps) {
  const [tab, setTab] = useState<SupplementType>('vaccine')

  const [vaccineName, setVaccineName] = useState('')
  const [vaccineDate, setVaccineDate] = useState('')

  const [weightTime, setWeightTime] = useState('')
  const [weightValue, setWeightValue] = useState('')
  const [weightVersion, setWeightVersion] = useState<'new' | 'legacy'>('new')

  const [noteContent, setNoteContent] = useState('')
  const [noteSource, setNoteSource] = useState<'verbal' | 'written'>('verbal')

  if (!open) return null

  const reset = () => {
    setVaccineName('')
    setVaccineDate('')
    setWeightTime('')
    setWeightValue('')
    setWeightVersion('new')
    setNoteContent('')
    setNoteSource('verbal')
  }

  const canSubmit = (() => {
    if (tab === 'vaccine') return vaccineName.trim().length > 0 && vaccineDate.length > 0
    if (tab === 'weight') return weightTime.length > 0 && Number(weightValue) > 0
    return noteContent.trim().length > 0
  })()

  const submit = () => {
    if (!canSubmit) return
    let payload: SupplementPayload
    if (tab === 'vaccine') {
      payload = {
        type: 'vaccine',
        content: { name: vaccineName.trim(), date: vaccineDate || null },
      }
    } else if (tab === 'weight') {
      payload = {
        type: 'weight',
        content: {
          t: new Date(weightTime).getTime(),
          value: Number(weightValue),
          version: weightVersion,
        },
      }
    } else {
      payload = {
        type: 'note',
        content: { content: noteContent.trim(), source: noteSource },
      }
    }
    onConfirm(payload)
    reset()
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">补录材料</h2>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/60 px-3 pt-2">
          <div className="flex gap-1">
            {TABS.map((t) => {
              const active = tab === t.key
              const Icon = t.Icon
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-t-lg px-3.5 py-2 text-xs font-medium transition-colors',
                    active
                      ? cn(
                          'bg-white text-slate-900 shadow-[0_-1px_0_0_rgb(226,232,240)_inset]',
                          t.cls,
                        )
                      : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-4 p-5 min-h-[200px]">
          {tab === 'vaccine' && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  疫苗名称 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={vaccineName}
                  onChange={(e) => setVaccineName(e.target.value)}
                  placeholder="如：狂犬疫苗"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  接种日期 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={vaccineDate}
                  onChange={(e) => setVaccineDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </div>
            </>
          )}

          {tab === 'weight' && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">测量时间</label>
                <input
                  type="datetime-local"
                  value={weightTime}
                  onChange={(e) => setWeightTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  体重值 (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={weightValue}
                  onChange={(e) => setWeightValue(e.target.value)}
                  placeholder="例如 3.25"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">数据版本</label>
                <div className="flex gap-2">
                  {(['new', 'legacy'] as const).map((v) => (
                    <label
                      key={v}
                      className={cn(
                        'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium',
                        weightVersion === v
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-100'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <input
                        type="radio"
                        className="accent-emerald-600"
                        checked={weightVersion === v}
                        onChange={() => setWeightVersion(v)}
                      />
                      {v === 'new' ? '新版数据' : '旧版数据'}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'note' && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">备注内容</label>
                <textarea
                  rows={5}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="请输入备注说明..."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">来源</label>
                <div className="flex gap-2">
                  {(
                    [
                      { v: 'verbal', l: '口头' },
                      { v: 'written', l: '书面' },
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.v}
                      className={cn(
                        'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium',
                        noteSource === opt.v
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <input
                        type="radio"
                        className="accent-indigo-600"
                        checked={noteSource === opt.v}
                        onChange={() => setNoteSource(opt.v)}
                      />
                      {opt.l}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5">
          <button
            onClick={handleClose}
            className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-white hover:ring-1 hover:ring-slate-200"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className={cn(
              'inline-flex items-center gap-1 rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition-colors',
              canSubmit
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'cursor-not-allowed bg-slate-200 text-slate-400',
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            确认补录
          </button>
        </div>
      </div>
    </div>
  )
}
