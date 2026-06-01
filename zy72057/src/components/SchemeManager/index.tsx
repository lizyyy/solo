import { useState, useEffect } from "react"
import { useSchemeStore } from "@/store/useSchemeStore"
import { useUIStore } from "@/store/useUIStore"
import { Save, FolderOpen, Trash2, Edit3, Check, X, Plus } from "lucide-react"

export default function SchemeManager() {
  const { currentScheme, savedSchemes, saveScheme, loadScheme, deleteScheme, renameScheme, loadFromLocalStorage } = useSchemeStore()
  const { setSchemeModalOpen } = useUIStore()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [noteValue, setNoteValue] = useState(currentScheme.note)

  useEffect(() => {
    loadFromLocalStorage()
  }, [loadFromLocalStorage])

  const handleSave = () => {
    saveScheme()
  }

  const handleLoad = (id: string) => {
    loadScheme(id)
    setSchemeModalOpen(false)
  }

  const handleDelete = (id: string) => {
    deleteScheme(id)
  }

  const handleRename = (id: string) => {
    if (renameValue.trim()) {
      renameScheme(id, renameValue.trim())
    }
    setRenamingId(null)
  }

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNoteValue(e.target.value)
    useSchemeStore.getState().updateSchemeParams({ note: e.target.value })
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setSchemeModalOpen(false)}>
      <div className="bg-slate-800 rounded-xl shadow-2xl w-[520px] max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2 text-amber-400 font-semibold">
            <FolderOpen size={18} />
            <span>方案管理</span>
          </div>
          <button onClick={() => setSchemeModalOpen(false)} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          <div className="bg-slate-900 rounded-lg p-4 space-y-3">
            <p className="text-xs text-slate-400">当前方案</p>
            <p className="text-sm text-slate-200 font-medium">{currentScheme.name}</p>
            <p className="text-xs text-slate-500">
              更新于 {new Date(currentScheme.updatedAt).toLocaleString("zh-CN")}
            </p>
            <textarea
              value={noteValue}
              onChange={handleNoteChange}
              placeholder="追加备注..."
              className="w-full h-16 bg-slate-800 text-slate-300 text-xs rounded px-3 py-2 border border-slate-600 focus:outline-none focus:border-amber-500 resize-none"
            />
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-slate-900 text-sm font-semibold rounded hover:bg-amber-400 transition-colors"
            >
              <Save size={14} />
              保存当前方案
            </button>
          </div>

          {savedSchemes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">已保存方案 ({savedSchemes.length})</p>
              {savedSchemes.map((s) => (
                <div
                  key={s.id}
                  className={`bg-slate-900 rounded-lg p-3 flex items-center gap-3 ${
                    s.id === currentScheme.id ? "ring-1 ring-amber-500/50" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    {renamingId === s.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="bg-slate-800 text-sm text-slate-200 px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-amber-500 w-full"
                          autoFocus
                        />
                        <button onClick={() => handleRename(s.id)} className="text-green-400 hover:text-green-300">
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-slate-200 truncate">{s.name}</p>
                        <p className="text-xs text-slate-500">
                          {s.buildings.length}建筑 / {s.panels.length}板 / {s.inverters.length}逆变器
                          {" · "}
                          {new Date(s.updatedAt).toLocaleString("zh-CN")}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleLoad(s.id)}
                      className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-amber-400 transition-colors"
                      title="加载方案"
                    >
                      <FolderOpen size={14} />
                    </button>
                    <button
                      onClick={() => { setRenamingId(s.id); setRenameValue(s.name) }}
                      className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors"
                      title="重命名"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-colors"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {savedSchemes.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-4">还没有保存过方案，先保存一个吧</p>
          )}
        </div>
      </div>
    </div>
  )
}
