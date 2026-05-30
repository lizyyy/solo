import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { Edit2, Trash2, Plus, X as XIcon } from 'lucide-react'
import { formatWeight } from '@/lib/helpers'
import type { CreateFixtureInput, CreateAssignmentInput } from '../../shared/types'

const emptyFixture: CreateFixtureInput = { name: '', weight: 0, weightUnit: 'kg', quantity: 1 }

export default function FixturesTab() {
  const schemeDetail = useStore((s) => s.schemeDetail)
  const fixtures = useStore((s) => s.fixtures)
  const createFixture = useStore((s) => s.createFixture)
  const deleteFixture = useStore((s) => s.deleteFixture)
  const createAssignment = useStore((s) => s.createAssignment)
  const deleteAssignment = useStore((s) => s.deleteAssignment)

  const [showFixtureForm, setShowFixtureForm] = useState(false)
  const [fForm, setFForm] = useState<CreateFixtureInput>(emptyFixture)
  const [assignForm, setAssignForm] = useState<CreateAssignmentInput>({ pointId: '', fixtureId: '', quantity: 1, notes: '' })

  if (!schemeDetail) return null
  const sid = schemeDetail.scheme.id
  const assignments = schemeDetail.assignments

  const onAddFixture = async () => {
    await createFixture(fForm)
    setFForm(emptyFixture)
    setShowFixtureForm(false)
  }
  const onAssign = async () => {
    await createAssignment(sid, assignForm)
    setAssignForm({ pointId: '', fixtureId: '', quantity: 1, notes: '' })
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-300">灯具库</h3>
          <button onClick={() => setShowFixtureForm(!showFixtureForm)} className="text-brand-400 hover:text-brand-300"><Plus size={16} /></button>
        </div>
        {showFixtureForm && (
          <div className="flex gap-2 bg-zinc-800/60 rounded p-2 text-sm">
            <input placeholder="名称" value={fForm.name} onChange={(e) => setFForm({ ...fForm, name: e.target.value })} className="bg-zinc-700 rounded px-2 py-1 flex-1" />
            <input type="number" placeholder="重量" value={fForm.weight} onChange={(e) => setFForm({ ...fForm, weight: +e.target.value })} className="bg-zinc-700 rounded px-2 py-1 w-20" />
            <select value={fForm.weightUnit} onChange={(e) => setFForm({ ...fForm, weightUnit: e.target.value as 'kg' | 'lb' })} className="bg-zinc-700 rounded px-2 py-1">
              <option value="kg">kg</option><option value="lb">lb</option>
            </select>
            <input type="number" placeholder="数量" value={fForm.quantity} onChange={(e) => setFForm({ ...fForm, quantity: +e.target.value })} className="bg-zinc-700 rounded px-2 py-1 w-16" />
            <button onClick={onAddFixture} className="bg-brand-600 hover:bg-brand-500 rounded px-2 py-1 text-xs">添加</button>
            <button onClick={() => setShowFixtureForm(false)} className="text-zinc-400"><XIcon size={14} /></button>
          </div>
        )}
        <table className="w-full text-sm">
          <thead><tr className="text-zinc-400 border-b border-zinc-700">
            <th className="text-left py-2 px-2">名称</th><th className="py-2 px-2">重量</th><th className="py-2 px-2">数量</th><th className="py-2 px-2">操作</th>
          </tr></thead>
          <tbody>
            {fixtures.map((f) => (
              <tr key={f.id} className="border-b border-zinc-800 hover:bg-zinc-800/40">
                <td className="py-2 px-2">{f.name}</td>
                <td className="py-2 px-2 text-center">{formatWeight(f.weight, f.weightUnit)}</td>
                <td className="py-2 px-2 text-center">{f.quantity}</td>
                <td className="py-2 px-2 text-center">
                  <div className="flex justify-center gap-2">
                    <button className="text-zinc-400 hover:text-blue-400"><Edit2 size={14} /></button>
                    <button onClick={() => deleteFixture(f.id)} className="text-zinc-400 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">灯具分配</h3>
        <div className="flex gap-2 text-sm">
          <select value={assignForm.pointId} onChange={(e) => setAssignForm({ ...assignForm, pointId: e.target.value })} className="bg-zinc-700 rounded px-2 py-1 flex-1">
            <option value="">选择吊点</option>
            {schemeDetail.points.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <select value={assignForm.fixtureId} onChange={(e) => setAssignForm({ ...assignForm, fixtureId: e.target.value })} className="bg-zinc-700 rounded px-2 py-1 flex-1">
            <option value="">选择灯具</option>
            {fixtures.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <input type="number" placeholder="数量" value={assignForm.quantity} onChange={(e) => setAssignForm({ ...assignForm, quantity: +e.target.value })} className="bg-zinc-700 rounded px-2 py-1 w-16" />
          <button onClick={onAssign} className="bg-brand-600 hover:bg-brand-500 rounded px-3 py-1 text-xs">分配</button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-zinc-400 border-b border-zinc-700">
            <th className="text-left py-2 px-2">吊点</th><th className="py-2 px-2">灯具</th><th className="py-2 px-2">数量</th><th className="py-2 px-2">操作</th>
          </tr></thead>
          <tbody>
            {assignments.map((a) => {
              const pt = schemeDetail.points.find((p) => p.id === a.pointId)
              const fx = fixtures.find((f) => f.id === a.fixtureId)
              return (
                <tr key={a.id} className="border-b border-zinc-800 hover:bg-zinc-800/40">
                  <td className="py-2 px-2">{pt?.label ?? a.pointId}</td>
                  <td className="py-2 px-2 text-center">{fx?.name ?? a.fixtureId}</td>
                  <td className="py-2 px-2 text-center">{a.quantity}</td>
                  <td className="py-2 px-2 text-center">
                    <button onClick={() => deleteAssignment(sid, a.id)} className="text-zinc-400 hover:text-red-400"><Trash2 size={14} /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
