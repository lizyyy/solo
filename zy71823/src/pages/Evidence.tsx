import { useRef, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import {
  Camera,
  FileText,
  PenLine,
  Download,
  Upload,
  Plus,
  Trash2,
} from 'lucide-react'
import type { EvidenceType, ChangeType } from '@/types'
import { TYPE_LABELS, CHANGE_LABELS } from '@/types'

type TabType = 'screenshot' | 'review' | 'draft'

const TAB_CONFIG: { key: TabType; icon: typeof Camera; label: string }[] = [
  { key: 'screenshot', icon: Camera, label: '排行榜截图' },
  { key: 'review', icon: FileText, label: '活动复盘' },
  { key: 'draft', icon: PenLine, label: '关卡草表' },
]

export default function Evidence() {
  const evidences = useAppStore((s) => s.evidences)
  const addEvidence = useAppStore((s) => s.addEvidence)
  const removeEvidence = useAppStore((s) => s.removeEvidence)
  const exportChain = useAppStore((s) => s.exportChain)
  const importChain = useAppStore((s) => s.importChain)

  const [activeTab, setActiveTab] = useState<TabType>('screenshot')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    activityName: '',
    timestamp: new Date().toISOString().slice(0, 16),
    content: '',
    attachmentUrl: '',
    changeType: 'new' as ChangeType,
    changeNote: '',
  })

  const resetForm = () => {
    setForm({
      activityName: '',
      timestamp: new Date().toISOString().slice(0, 16),
      content: '',
      attachmentUrl: '',
      changeType: 'new',
      changeNote: '',
    })
  }

  const handleSubmit = () => {
    if (!form.activityName.trim() || !form.content.trim()) return
    addEvidence({
      activityName: form.activityName.trim(),
      type: activeTab as EvidenceType,
      timestamp: new Date(form.timestamp).toISOString(),
      content: form.content.trim(),
      ...(activeTab === 'screenshot' && form.attachmentUrl
        ? { attachmentUrl: form.attachmentUrl }
        : {}),
      ...(activeTab === 'draft'
        ? { changeType: form.changeType, changeNote: form.changeNote }
        : {}),
    })
    resetForm()
  }

  const handleExport = () => {
    const json = exportChain()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `evidence-chain-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      importChain(text)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const inputCls =
    'w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500'
  const labelCls = 'text-[11px] text-zinc-500 mb-1 block'

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-50">证据管理</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            录入证据 · 导出/导入证据链
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
          >
            <Download size={12} />
            导出
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
          >
            <Upload size={12} />
            导入
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>
      </div>

      <div className="flex gap-1 mb-5 border-b border-zinc-800">
        {TAB_CONFIG.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 transition-colors ${
              activeTab === key
                ? 'border-zinc-300 text-zinc-200'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className={labelCls}>活动名称 *</label>
            <input
              value={form.activityName}
              onChange={(e) =>
                setForm((f) => ({ ...f, activityName: e.target.value }))
              }
              placeholder="如：古城巡逻解谜"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>时间</label>
            <input
              type="datetime-local"
              value={form.timestamp}
              onChange={(e) =>
                setForm((f) => ({ ...f, timestamp: e.target.value }))
              }
              className={inputCls}
            />
          </div>
        </div>

        {activeTab === 'screenshot' && (
          <div className="mb-3">
            <label className={labelCls}>截图链接（可选）</label>
            <input
              value={form.attachmentUrl}
              onChange={(e) =>
                setForm((f) => ({ ...f, attachmentUrl: e.target.value }))
              }
              placeholder="粘贴图片 URL"
              className={inputCls}
            />
          </div>
        )}

        <div className="mb-3">
          <label className={labelCls}>
            {activeTab === 'screenshot'
              ? '排行榜描述 *'
              : activeTab === 'review'
              ? '复盘内容 *'
              : '草表内容 *'}
          </label>
          <textarea
            value={form.content}
            onChange={(e) =>
              setForm((f) => ({ ...f, content: e.target.value }))
            }
            placeholder={
              activeTab === 'screenshot'
                ? '描述排行榜内容，如排名、分数等'
                : activeTab === 'review'
                ? '填写复盘内容，如涉及结论变更请明确说明'
                : '填写关卡草表内容'
            }
            className={`${inputCls} resize-none h-20`}
          />
        </div>

        {activeTab === 'draft' && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelCls}>变更类型</label>
              <select
                value={form.changeType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    changeType: e.target.value as ChangeType,
                  }))
                }
                className={inputCls}
              >
                {(Object.entries(CHANGE_LABELS) as [ChangeType, string][]).map(
                  ([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label className={labelCls}>变更说明</label>
              <input
                value={form.changeNote}
                onChange={(e) =>
                  setForm((f) => ({ ...f, changeNote: e.target.value }))
                }
                placeholder="如：积分系数从1.0调整为1.3"
                className={inputCls}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!form.activityName.trim() || !form.content.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-700 text-zinc-200 rounded hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={12} />
          添加{TYPE_LABELS[activeTab as EvidenceType]}
        </button>
      </div>

      <div>
        <div className="text-xs text-zinc-500 mb-2">
          已录入证据（{evidences.length}）
        </div>
        {evidences.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-xs">
            暂无证据
          </div>
        ) : (
          <div className="space-y-1.5">
            {[...evidences]
              .sort(
                (a, b) =>
                  new Date(b.timestamp).getTime() -
                  new Date(a.timestamp).getTime()
              )
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded px-3 py-2"
                >
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      item.type === 'screenshot'
                        ? 'bg-sky-900/50 text-sky-300'
                        : item.type === 'review'
                        ? 'bg-violet-900/50 text-violet-300'
                        : 'bg-orange-900/50 text-orange-300'
                    }`}
                  >
                    {TYPE_LABELS[item.type]}
                  </span>
                  <span className="text-xs text-zinc-300 flex-1 truncate">
                    {item.activityName}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    {new Date(item.timestamp).toLocaleDateString('zh-CN')}
                  </span>
                  <button
                    onClick={() => removeEvidence(item.id)}
                    className="text-zinc-600 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />
    </div>
  )
}
