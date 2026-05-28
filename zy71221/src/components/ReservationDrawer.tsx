import { useState, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { X } from 'lucide-react'

interface FormData {
  client_account: string
  client_name: string
  client_priority: number
  security_code: string
  security_name: string
  quantity: number | string
  reserve_date: string
  due_date: string
}

const emptyForm: FormData = {
  client_account: '',
  client_name: '',
  client_priority: 5,
  security_code: '',
  security_name: '',
  quantity: '',
  reserve_date: '',
  due_date: '',
}

export default function ReservationDrawer() {
  const { drawerOpen, drawerMode, editingReservation, closeDrawer, createReservation, updateReservation } = useStore()
  const [form, setForm] = useState<FormData>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  useEffect(() => {
    if (drawerOpen && drawerMode === 'edit' && editingReservation) {
      setForm({
        client_account: editingReservation.client_account || '',
        client_name: editingReservation.client_name || '',
        client_priority: editingReservation.client_priority ?? 5,
        security_code: editingReservation.security_code || '',
        security_name: editingReservation.security_name || '',
        quantity: editingReservation.quantity ?? '',
        reserve_date: editingReservation.reserve_date || '',
        due_date: editingReservation.due_date || '',
      })
    } else if (drawerOpen && drawerMode === 'create') {
      setForm({ ...emptyForm })
    }
    setErrors({})
  }, [drawerOpen, drawerMode, editingReservation])

  if (!drawerOpen) return null

  const isEdit = drawerMode === 'edit'

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {}
    if (!form.client_account.trim()) e.client_account = '请输入客户账户'
    if (!form.client_name.trim()) e.client_name = '请输入客户名称'
    if (!form.quantity || Number(form.quantity) <= 0) e.quantity = '请输入有效数量'
    if (!form.reserve_date) e.reserve_date = '请选择预约日期'
    if (!form.due_date) e.due_date = '请选择到期日期'
    if (form.reserve_date && form.due_date && form.reserve_date > form.due_date) {
      e.due_date = '到期日期不能早于预约日期'
    }
    if (!isEdit) {
      if (!form.security_code.trim()) e.security_code = '请输入证券代码'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)

    const payload = {
      client_account: form.client_account.trim(),
      client_name: form.client_name.trim(),
      client_priority: Number(form.client_priority),
      security_code: form.security_code.trim(),
      security_name: form.security_name.trim(),
      quantity: Number(form.quantity),
      reserve_date: form.reserve_date,
      due_date: form.due_date,
    }

    let ok = false
    if (isEdit && editingReservation) {
      ok = await updateReservation(editingReservation.id, payload)
    } else {
      ok = await createReservation(payload)
    }

    setSubmitting(false)
    if (ok) {
      closeDrawer()
    }
  }

  const handleClose = () => {
    if (!submitting) closeDrawer()
  }

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <div className="absolute inset-0 bg-black/50 overlay-enter" onClick={handleClose} />
      <div className="relative w-96 bg-slate-800 border-l border-slate-600 h-full shadow-2xl drawer-enter flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100">
            {isEdit ? '修正预约' : '新建预约'}
          </h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-200 transition-colors" disabled={submitting}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-400">客户账户 <span className="text-red-400">*</span></label>
            <input
              type="text"
              className="input-field"
              value={form.client_account}
              onChange={(e) => updateField('client_account', e.target.value)}
            />
            {errors.client_account && <span className="text-xs text-red-400">{errors.client_account}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-400">客户名称 <span className="text-red-400">*</span></label>
            <input
              type="text"
              className="input-field"
              value={form.client_name}
              onChange={(e) => updateField('client_name', e.target.value)}
            />
            {errors.client_name && <span className="text-xs text-red-400">{errors.client_name}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-400">客户优先级</label>
            <input
              type="number"
              className="input-field"
              min={1}
              max={5}
              value={form.client_priority}
              onChange={(e) => updateField('client_priority', Number(e.target.value))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-400">
              证券代码 {!isEdit && <span className="text-red-400">*</span>}
            </label>
            <input
              type="text"
              className="input-field disabled:opacity-50 disabled:cursor-not-allowed"
              value={form.security_code}
              onChange={(e) => updateField('security_code', e.target.value)}
              disabled={isEdit}
            />
            {errors.security_code && <span className="text-xs text-red-400">{errors.security_code}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-400">证券名称</label>
            <input
              type="text"
              className="input-field disabled:opacity-50 disabled:cursor-not-allowed"
              value={form.security_name}
              onChange={(e) => updateField('security_name', e.target.value)}
              disabled={isEdit}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-400">预约数量 <span className="text-red-400">*</span></label>
            <input
              type="number"
              className="input-field"
              min={1}
              value={form.quantity}
              onChange={(e) => updateField('quantity', e.target.value)}
            />
            {errors.quantity && <span className="text-xs text-red-400">{errors.quantity}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-400">预约日期 <span className="text-red-400">*</span></label>
            <input
              type="date"
              className="input-field"
              value={form.reserve_date}
              onChange={(e) => updateField('reserve_date', e.target.value)}
            />
            {errors.reserve_date && <span className="text-xs text-red-400">{errors.reserve_date}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-400">到期日期 <span className="text-red-400">*</span></label>
            <input
              type="date"
              className="input-field"
              value={form.due_date}
              onChange={(e) => updateField('due_date', e.target.value)}
            />
            {errors.due_date && <span className="text-xs text-red-400">{errors.due_date}</span>}
          </div>
        </div>

        <div className="p-5 border-t border-slate-700 flex gap-3">
          <button className="btn-secondary flex-1" onClick={handleClose} disabled={submitting}>
            取消
          </button>
          <button className="btn-primary flex-1" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中...' : isEdit ? '确认修正' : '确认预约'}
          </button>
        </div>
      </div>
    </div>
  )
}
