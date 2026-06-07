import { useState, useCallback } from 'react'
import { useStore } from '@/store/useStore'
import { Save, X, Check } from 'lucide-react'
import type { FilterState } from '@/types'

function filtersMatch(a: FilterState, b: FilterState): boolean {
  return (
    JSON.stringify(a.severity.sort()) === JSON.stringify(b.severity.sort()) &&
    JSON.stringify(a.sources.sort()) === JSON.stringify(b.sources.sort()) &&
    JSON.stringify(a.dateRange) === JSON.stringify(b.dateRange) &&
    JSON.stringify(a.pipeIds.sort()) === JSON.stringify(b.pipeIds.sort()) &&
    JSON.stringify(a.status.sort()) === JSON.stringify(b.status.sort())
  )
}

export default function FilterPresetBar() {
  const presets = useStore((s) => s.filterPresets)
  const filters = useStore((s) => s.filters)
  const loadFilterPreset = useStore((s) => s.loadFilterPreset)
  const deleteFilterPreset = useStore((s) => s.deleteFilterPreset)
  const saveFilterPreset = useStore((s) => s.saveFilterPreset)

  const [showModal, setShowModal] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }, [])

  const handleSave = () => {
    if (presetName.trim()) {
      saveFilterPreset(presetName.trim())
      setPresetName('')
      setShowModal(false)
      showToast('方案已保存')
    }
  }

  const handleLoad = (id: string, name: string) => {
    loadFilterPreset(id)
    showToast(`已加载方案: ${name}`)
  }

  const handleDelete = (id: string) => {
    deleteFilterPreset(id)
    setDeleteConfirm(null)
    showToast('方案已删除')
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {presets.map((preset) => {
          const isActive = filtersMatch(filters, preset.filters)
          return (
            <div key={preset.id} className="relative flex-shrink-0 group">
              <button
                onClick={() => handleLoad(preset.id, preset.name)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                    : 'border-white/10 bg-white/5 text-gray-300 hover:border-cyan-500/50 hover:text-cyan-400'
                }`}
              >
                <span className="max-w-24 truncate">{preset.name}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteConfirm(preset.id)
                }}
                className={`absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gray-700 text-gray-400 opacity-0 transition-opacity hover:bg-red-500 hover:text-white group-hover:opacity-100 ${
                  deleteConfirm === preset.id ? 'opacity-100' : ''
                }`}
              >
                <X size={10} />
              </button>
            </div>
          )
        })}
        <button
          onClick={() => setShowModal(true)}
          className="flex flex-shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 transition-all hover:border-cyan-500/50 hover:text-cyan-400"
        >
          <Save size={12} />
          <span>保存当前</span>
        </button>
      </div>

      {toast && (
        <div className="absolute -top-10 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-black/90 px-4 py-2 text-xs text-cyan-400 shadow-lg backdrop-blur-sm">
          {toast}
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-72 rounded-xl border border-white/10 bg-gray-900 p-5 shadow-2xl">
            <h3 className="mb-3 text-sm font-semibold text-white">确认删除</h3>
            <p className="mb-5 text-xs text-gray-400">确定要删除该筛选方案吗？此操作不可撤销。</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-300"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/30"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-72 rounded-xl border border-white/10 bg-gray-900 p-5 shadow-2xl">
            <h3 className="mb-4 text-sm font-semibold text-white">保存筛选方案</h3>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="输入方案名称"
              autoFocus
              className="mb-5 w-full rounded-lg border border-gray-600 bg-black/40 px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-cyan-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowModal(false)
                  setPresetName('')
                }}
                className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-300"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!presetName.trim()}
                className="flex items-center gap-1 rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs text-cyan-400 transition-colors hover:bg-cyan-500/30 disabled:opacity-50"
              >
                <Check size={12} />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
