import { useState } from 'react'
import Modal from './Modal'
import { useDeviationStore } from '@/store/useDeviationStore'
import { DEVIATION_TYPE_LABELS, RECORD_SOURCE_LABELS } from '@/types'
import type { DeviationType, RecordSource } from '@/types'

interface AddRecordModalProps {
  isOpen: boolean
  onClose: () => void
}

const WARNING_TYPES: DeviationType[] = ['threshold_crossing', 'fault_sequence_error', 'alarm_duplicate_confirm']

export default function AddRecordModal({ isOpen, onClose }: AddRecordModalProps) {
  const { addRecord, currentUser } = useDeviationStore()
  const [code, setCode] = useState('')
  const [deviationType, setDeviationType] = useState<DeviationType>(Object.keys(DEVIATION_TYPE_LABELS)[0] as DeviationType)
  const [source, setSource] = useState<RecordSource>('manual_entry')
  const [equipmentCode, setEquipmentCode] = useState('')
  const [description, setDescription] = useState('')
  const [discoveredAt, setDiscoveredAt] = useState('')
  const [createdBy, setCreatedBy] = useState(currentUser ?? '')

  const resetForm = () => {
    setCode('')
    setDeviationType(Object.keys(DEVIATION_TYPE_LABELS)[0] as DeviationType)
    setSource('manual_entry')
    setEquipmentCode('')
    setDescription('')
    setDiscoveredAt('')
    setCreatedBy(currentUser ?? '')
  }

  const handleSubmit = () => {
    addRecord({ code, deviationType, source, equipmentCode, description, discoveredAt, createdBy })
    resetForm()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="新增偏差记录">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-300 mb-1 block">记录编号</label>
          <input className="w-full bg-slate-bg border border-iron-lighter rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-signal" value={code} onChange={e => setCode(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-slate-300 mb-1 block">偏差类型</label>
          <select className="w-full bg-slate-bg border border-iron-lighter rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-signal" value={deviationType} onChange={e => setDeviationType(e.target.value as DeviationType)}>
            {Object.entries(DEVIATION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {WARNING_TYPES.includes(deviationType) && (
          <div className="col-span-2 bg-orange-500/10 border border-orange-500/30 rounded-md p-3 text-sm text-orange-300">
            ⚠ 此类型记录将自动标记为待确认，需经复核流程后才能确认
          </div>
        )}
        <div>
          <label className="text-sm text-slate-300 mb-1 block">来源</label>
          <select className="w-full bg-slate-bg border border-iron-lighter rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-signal" value={source} onChange={e => setSource(e.target.value as RecordSource)}>
            {Object.entries(RECORD_SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-300 mb-1 block">设备编号</label>
          <input className="w-full bg-slate-bg border border-iron-lighter rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-signal" value={equipmentCode} onChange={e => setEquipmentCode(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-slate-300 mb-1 block">发现时间</label>
          <input type="datetime-local" className="w-full bg-slate-bg border border-iron-lighter rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-signal" value={discoveredAt} onChange={e => setDiscoveredAt(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-slate-300 mb-1 block">创建人</label>
          <input className="w-full bg-slate-bg border border-iron-lighter rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-signal" value={createdBy} onChange={e => setCreatedBy(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-sm text-slate-300 mb-1 block">偏差描述</label>
          <textarea className="w-full bg-slate-bg border border-iron-lighter rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-signal" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <button className="w-full bg-signal hover:bg-signal-dim text-white font-medium py-2 rounded-md transition-colors" onClick={handleSubmit}>提交</button>
        <button className="w-full bg-iron-lighter hover:bg-iron-light text-slate-200 py-2 rounded-md transition-colors" onClick={onClose}>取消</button>
      </div>
    </Modal>
  )
}
