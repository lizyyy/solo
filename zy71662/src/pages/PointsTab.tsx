import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { Edit2, Trash2, Plus, X as XIcon } from 'lucide-react'
import { formatWeight } from '@/lib/helpers'
import type { CreatePointInput } from '../../shared/types'

const emptyPoint: CreatePointInput = {
  label: '', x: 0, y: 0, ratedLoad: 0, ratedLoadUnit: 'kg',
  angle: 0, angleDirection: 'left', notes: '',
}

export default function PointsTab() {
  const schemeDetail = useStore((s) => s.schemeDetail)
  const createPoint = useStore((s) => s.createPoint)
  const deletePoint = useStore((s) => s.deletePoint)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreatePointInput>(emptyPoint)

  if (!schemeDetail) return null
  const sid = schemeDetail.scheme.id
  const pts = schemeDetail.points

  const submit = async () => {
    await createPoint(sid, form)
    setForm(emptyPoint)
    setShowForm(false)
  }

  return (
    <div className="space-y-4">
      {!showForm && (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300">
          <Plus size={14} /> 新建吊点
        </button>
      )}
      {showForm && (
        <div className="grid grid-cols-8 gap-2 bg-zinc-800/60 rounded p-3 text-sm">
          <input placeholder="标签" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="bg-zinc-700 rounded px-2 py-1" />
          <input type="number" placeholder="X" value={form.x} onChange={(e) => setForm({ ...form, x: +e.target.value })} className="bg-zinc-700 rounded px-2 py-1" />
          <input type="number" placeholder="Y" value={form.y} onChange={(e) => setForm({ ...form, y: +e.target.value })} className="bg-zinc-700 rounded px-2 py-1" />
          <input type="number" placeholder="额定载荷" value={form.ratedLoad} onChange={(e) => setForm({ ...form, ratedLoad: +e.target.value })} className="bg-zinc-700 rounded px-2 py-1" />
          <select value={form.ratedLoadUnit} onChange={(e) => setForm({ ...form, ratedLoadUnit: e.target.value as 'kg' | 'lb' })} className="bg-zinc-700 rounded px-2 py-1">
            <option value="kg">kg</option><option value="lb">lb</option>
          </select>
          <input type="number" placeholder="角度" value={form.angle} onChange={(e) => setForm({ ...form, angle: +e.target.value })} className="bg-zinc-700 rounded px-2 py-1" />
          <select value={form.angleDirection} onChange={(e) => setForm({ ...form, angleDirection: e.target.value as 'left' | 'right' })} className="bg-zinc-700 rounded px-2 py-1">
            <option value="left">左</option><option value="right">右</option>
          </select>
          <div className="flex gap-1">
            <button onClick={submit} className="bg-brand-600 hover:bg-brand-500 rounded px-3 py-1 text-xs">确定</button>
            <button onClick={() => { setShowForm(false); setForm(emptyPoint) }} className="text-zinc-400 hover:text-zinc-200"><XIcon size={14} /></button>
          </div>
        </div>
      )}
      <table className="w-full text-sm">
        <thead><tr className="text-zinc-400 border-b border-zinc-700">
          <th className="text-left py-2 px-2">标签</th><th className="py-2 px-2">X</th><th className="py-2 px-2">Y</th>
          <th className="py-2 px-2">额定载荷</th><th className="py-2 px-2">单位</th><th className="py-2 px-2">角度</th>
          <th className="py-2 px-2">方向</th><th className="py-2 px-2">备注</th><th className="py-2 px-2">操作</th>
        </tr></thead>
        <tbody>
          {pts.map((p) => (
            <tr key={p.id} className="border-b border-zinc-800 hover:bg-zinc-800/40">
              <td className="py-2 px-2">{p.label}</td>
              <td className="py-2 px-2 text-center">{p.x}</td>
              <td className="py-2 px-2 text-center">{p.y}</td>
              <td className="py-2 px-2 text-center">{formatWeight(p.ratedLoad, p.ratedLoadUnit)}</td>
              <td className="py-2 px-2 text-center">{p.ratedLoadUnit}</td>
              <td className="py-2 px-2 text-center">{p.angle}°</td>
              <td className="py-2 px-2 text-center">{p.angleDirection === 'left' ? '左' : '右'}</td>
              <td className="py-2 px-2 text-center text-zinc-400">{p.notes || '—'}</td>
              <td className="py-2 px-2 text-center">
                <div className="flex justify-center gap-2">
                  <button className="text-zinc-400 hover:text-blue-400"><Edit2 size={14} /></button>
                  <button onClick={() => deletePoint(sid, p.id)} className="text-zinc-400 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
