import { useState } from 'react'
import { useScheduleStore } from '@/stores/scheduleStore'
import { X, Plus } from 'lucide-react'

export default function AddRecordModal() {
  const { showAddModal, setShowAddModal, addSchedule, operatorName } = useScheduleStore()
  const [form, setForm] = useState({
    part_no: '',
    track_name: '',
    file_name: '',
    source: '',
    version: 1,
    status: 'pending',
    remark: '',
    original_source: '',
  })

  if (!showAddModal) return null

  const handleSubmit = async () => {
    if (!form.part_no || !form.source || !form.original_source) return
    await addSchedule({
      ...form,
      original_source: form.original_source || form.source,
    })
    setShowAddModal(false)
    setForm({ part_no: '', track_name: '', file_name: '', source: '', version: 1, status: 'pending', remark: '', original_source: '' })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={() => setShowAddModal(false)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus size={18} className="text-amber-600" />
              <h3 className="font-display text-lg text-slate-800">新增排程记录</h3>
            </div>
            <button
              onClick={() => setShowAddModal(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">备件编号 *</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                  value={form.part_no}
                  onChange={(e) => setForm({ ...form, part_no: e.target.value })}
                  placeholder="如 BR-001"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">版本</label>
                <input
                  type="number"
                  min={1}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: Number(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">曲目名称</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                value={form.track_name}
                onChange={(e) => setForm({ ...form, track_name: e.target.value })}
                placeholder="维修项目名称"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">文件名</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                value={form.file_name}
                onChange={(e) => setForm({ ...form, file_name: e.target.value })}
                placeholder="音频文件名"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">来源 *</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="曲目表A"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">原始来源 *</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                  value={form.original_source}
                  onChange={(e) => setForm({ ...form, original_source: e.target.value })}
                  placeholder="与来源相同或填写实际来源"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">状态</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="pending">待排程</option>
                <option value="scheduled">已排程</option>
                <option value="missing_auth">缺授权</option>
                <option value="version_conflict">版本冲突</option>
                <option value="duplicate">重复项</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">备注</label>
              <textarea
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all resize-none"
                rows={3}
                value={form.remark}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
                placeholder="补充说明（改名原因、异常情况等）"
              />
            </div>
          </div>

          <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={!form.part_no || !form.source || !form.original_source}
              className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              确认新增
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
