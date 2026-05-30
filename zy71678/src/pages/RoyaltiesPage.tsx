import { useState } from 'react'
import { Percent, Plus, Search, Edit2, Trash2, AlertTriangle, Calculator, X, PieChart } from 'lucide-react'
import { useLedgerStore } from '@/store'
import type { Royalty } from '@/types'
import { genId } from '@/utils/helpers'

const SETTLEMENT_CYCLES = ['月度结算', '季度结算', '半年度结算', '年度结算']

interface FormData {
  sampleId: string
  rightHolder: string
  percentage: number
  settlementCycle: string
  notes: string
}

const emptyForm: FormData = {
  sampleId: '',
  rightHolder: '',
  percentage: 0,
  settlementCycle: '季度结算',
  notes: '',
}

export default function RoyaltiesPage() {
  const { samples, royalties, addRoyalty, updateRoyalty, deleteRoyalty } = useLedgerStore()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Royalty | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<Royalty | null>(null)
  const [showCalc, setShowCalc] = useState(false)
  const [calcSampleId, setCalcSampleId] = useState('')
  const [calcRevenue, setCalcRevenue] = useState<number>(0)

  const filtered = search
    ? royalties.filter(r =>
        r.rightHolder.includes(search) ||
        samples.find(s => s.id === r.sampleId)?.title.includes(search)
      )
    : royalties

  const grouped: Record<string, Royalty[]> = {}
  for (const r of filtered) {
    if (!grouped[r.sampleId]) grouped[r.sampleId] = []
    grouped[r.sampleId].push(r)
  }

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (r: Royalty) => {
    setEditing(r)
    setForm({
      sampleId: r.sampleId,
      rightHolder: r.rightHolder,
      percentage: r.percentage,
      settlementCycle: r.settlementCycle,
      notes: r.notes,
    })
    setShowForm(true)
  }

  const handleSubmit = () => {
    if (!form.sampleId || !form.rightHolder || form.percentage <= 0) return
    if (editing) {
      updateRoyalty(editing.id, { ...form })
    } else {
      addRoyalty({ id: genId('r'), ...form })
    }
    setShowForm(false)
    setEditing(null)
    setForm(emptyForm)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteRoyalty(deleteTarget.id)
    setDeleteTarget(null)
  }

  const samplesWithoutRoyalties = samples.filter(
    s => !royalties.some(r => r.sampleId === s.id)
  )

  const calcSample = samples.find(s => s.id === calcSampleId)
  const calcRoyalties = calcSampleId
    ? royalties.filter(r => r.sampleId === calcSampleId)
    : []
  const calcTotal = calcRoyalties.reduce((s, r) => s + r.percentage, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-forest-700 font-serif-title flex items-center gap-2">
          <Percent className="w-6 h-6" />
          分成规则
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
            <input
              type="text"
              placeholder="搜索权利方或采样…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9 w-56"
            />
          </div>
          <button className="btn-secondary flex items-center gap-1.5" onClick={() => setShowCalc(true)}>
            <Calculator className="w-4 h-4" />
            分成试算
          </button>
          <button className="btn-primary flex items-center gap-1.5" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            新增分成
          </button>
        </div>
      </div>

      {Object.entries(grouped).map(([sampleId, list]) => {
        const sample = samples.find(s => s.id === sampleId)
        const total = list.reduce((s, r) => s + r.percentage, 0)

        return (
          <div key={sampleId} className="card overflow-hidden">
            <div className="px-5 py-3 bg-forest-50 border-b border-warm-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-forest-500" />
                <span className="font-medium text-forest-700">{sample?.title ?? sampleId}</span>
                <span className="text-xs text-warm-500">({list.length} 条规则)</span>
              </div>
              <TotalBadge total={total} />
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-200 text-warm-600">
                  <th className="text-left px-5 py-2.5 font-medium">关联采样</th>
                  <th className="text-left px-5 py-2.5 font-medium">权利方</th>
                  <th className="text-left px-5 py-2.5 font-medium">分成比例</th>
                  <th className="text-left px-5 py-2.5 font-medium">结算周期</th>
                  <th className="text-left px-5 py-2.5 font-medium">备注</th>
                  <th className="text-right px-5 py-2.5 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map(r => (
                  <tr key={r.id} className="border-b border-warm-100 hover:bg-warm-50 transition-colors">
                    <td className="px-5 py-3 text-warm-700">{sample?.title ?? r.sampleId}</td>
                    <td className="px-5 py-3 font-medium text-forest-700">{r.rightHolder}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1">
                        <Percent className="w-3.5 h-3.5 text-amber-500" />
                        {r.percentage}%
                      </span>
                    </td>
                    <td className="px-5 py-3 text-warm-600">{r.settlementCycle}</td>
                    <td className="px-5 py-3 text-warm-500">{r.notes || '-'}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="p-1.5 rounded hover:bg-warm-100 text-warm-500 hover:text-amber-600 transition-colors"
                          onClick={() => openEdit(r)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 rounded hover:bg-warm-100 text-warm-500 hover:text-red-600 transition-colors"
                          onClick={() => setDeleteTarget(r)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      {samplesWithoutRoyalties.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 bg-amber-50 border-b border-warm-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="font-medium text-amber-700">未配置分成规则的采样</span>
          </div>
          <div className="divide-y divide-warm-100">
            {samplesWithoutRoyalties.map(s => (
              <div
                key={s.id}
                className="px-5 py-4 flex items-center gap-3 border-2 border-dashed border-amber-300 m-3 rounded-md bg-amber-50/50"
              >
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-warm-700">{s.title}</span>
                <span className="text-warm-400 text-sm">— 未配置分成规则</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && samplesWithoutRoyalties.length === 0 && (
        <div className="card p-12 text-center text-warm-400">
          暂无分成规则数据
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
              <h2 className="text-lg font-semibold text-forest-700 font-serif-title">
                {editing ? '编辑分成规则' : '新增分成规则'}
              </h2>
              <button className="p-1 rounded hover:bg-warm-100 text-warm-400" onClick={() => setShowForm(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="label-field">关联采样</label>
                <select
                  className="select-field"
                  value={form.sampleId}
                  onChange={e => setForm(f => ({ ...f, sampleId: e.target.value }))}
                >
                  <option value="">请选择采样</option>
                  {samples.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">权利方</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.rightHolder}
                  onChange={e => setForm(f => ({ ...f, rightHolder: e.target.value }))}
                  placeholder="输入权利方名称"
                />
              </div>
              <div>
                <label className="label-field">分成比例 (%)</label>
                <input
                  type="number"
                  className="input-field"
                  min={0}
                  max={100}
                  value={form.percentage}
                  onChange={e => setForm(f => ({ ...f, percentage: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="label-field">结算周期</label>
                <select
                  className="select-field"
                  value={form.settlementCycle}
                  onChange={e => setForm(f => ({ ...f, settlementCycle: e.target.value }))}
                >
                  {SETTLEMENT_CYCLES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">备注</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="备注信息"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-warm-200">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>取消</button>
              <button className="btn-primary" onClick={handleSubmit}>
                {editing ? '保存修改' : '确认添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4">
            <div className="px-5 py-6 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <p className="text-warm-700">
                确定删除「{deleteTarget.rightHolder}」的分成规则吗？
              </p>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-warm-200">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>取消</button>
              <button className="btn-danger" onClick={handleDelete}>确认删除</button>
            </div>
          </div>
        </div>
      )}

      {showCalc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
              <h2 className="text-lg font-semibold text-forest-700 font-serif-title flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                分成试算
              </h2>
              <button className="p-1 rounded hover:bg-warm-100 text-warm-400" onClick={() => setShowCalc(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="label-field">选择采样</label>
                <select
                  className="select-field"
                  value={calcSampleId}
                  onChange={e => setCalcSampleId(e.target.value)}
                >
                  <option value="">请选择采样</option>
                  {samples.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">预估收入 (元)</label>
                <input
                  type="number"
                  className="input-field"
                  min={0}
                  value={calcRevenue}
                  onChange={e => setCalcRevenue(Number(e.target.value))}
                  placeholder="输入预估收入"
                />
              </div>

              {calcSampleId && calcRoyalties.length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-warm-700">试算结果</div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-warm-200 text-warm-600">
                        <th className="text-left py-2 font-medium">权利方</th>
                        <th className="text-center py-2 font-medium">比例</th>
                        <th className="text-right py-2 font-medium">分配金额</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calcRoyalties.map(r => (
                        <tr key={r.id} className="border-b border-warm-100">
                          <td className="py-2 text-forest-700">{r.rightHolder}</td>
                          <td className="py-2 text-center">{r.percentage}%</td>
                          <td className="py-2 text-right font-medium text-amber-700">
                            ¥{(calcRevenue * r.percentage / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-warm-300">
                        <td className="py-2 font-medium text-warm-700">合计</td>
                        <td className="py-2 text-center font-medium">{calcTotal}%</td>
                        <td className="py-2 text-right font-medium text-amber-700">
                          ¥{(calcRevenue * calcTotal / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {calcTotal < 100 && (
                        <tr>
                          <td className="py-1 text-warm-500 text-xs" colSpan={3}>
                            剩余 {100 - calcTotal}% 未分配，对应 ¥{(calcRevenue * (100 - calcTotal) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>
              )}

              {calcSampleId && calcRoyalties.length === 0 && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 text-amber-700 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  该采样暂未配置分成规则
                </div>
              )}
            </div>
            <div className="flex justify-end px-5 py-4 border-t border-warm-200">
              <button className="btn-secondary" onClick={() => setShowCalc(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TotalBadge({ total }: { total: number }) {
  if (total === 100) {
    return <span className="badge-active">完整 100%</span>
  }
  if (total > 100) {
    return <span className="badge-danger">合计 {total}%，超出 {total - 100}%</span>
  }
  return <span className="badge-warning">合计 {total}%，剩余 {100 - total}% 未分配</span>
}
