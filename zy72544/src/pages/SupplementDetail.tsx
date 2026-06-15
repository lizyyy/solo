import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { ArrowLeft, Plus, ExternalLink, Pencil, Check, X, Trash2, AlertCircle } from 'lucide-react'

export default function SupplementDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const records = useStore((s) => s.records)
  const knowledgeLinks = useStore((s) => s.knowledgeLinks)
  const feedbackTickets = useStore((s) => s.feedbackTickets)
  const phoneExposures = useStore((s) => s.phoneExposures)
  const addKnowledgeLink = useStore((s) => s.addKnowledgeLink)
  const editLinkNote = useStore((s) => s.editLinkNote)
  const removeKnowledgeLink = useStore((s) => s.removeKnowledgeLink)

  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState('')

  const record = records.find((r) => r.id === id)
  if (!record) {
    return (
      <div className="p-8 text-center text-slate-500">记录不存在</div>
    )
  }

  const links = knowledgeLinks.filter((l) => l.recordId === id)
  const tickets = feedbackTickets.filter((t) => t.recordId === id)
  const exposures = phoneExposures.filter((e) => e.recordId === id)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000)
  }

  const handleSubmit = () => {
    if (!url.trim() || !title.trim()) return
    const result = addKnowledgeLink(id!, url.trim(), title.trim(), note.trim())
    if (result.success) {
      showToast(result.message, 'success')
      setUrl('')
      setTitle('')
      setNote('')
    } else {
      showToast(result.message, 'error')
    }
  }

  const handleSaveNote = (linkId: string) => {
    editLinkNote(linkId, editNote)
    setEditingId(null)
    setEditNote('')
    showToast('备注已更新', 'success')
  }

  const handleRemoveLink = (linkId: string) => {
    removeKnowledgeLink(linkId)
    showToast('链接已移除', 'success')
  }

  return (
    <div className="p-8">
      {toast.show && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}
        >
          {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        返回记录列表
      </button>

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-100">{record.title}</h2>
        <p className="text-sm text-slate-500 mt-1">补录知识库引用链接 · 查看线上反馈工单</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="bg-[#16162a] border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-amber-400 mb-4 flex items-center gap-2">
              <Plus size={16} />
              补录知识库链接
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">链接地址</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://wiki.internal/docs/..."
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">链接标题</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="文档标题"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">备注</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="说明此链接与该记录的关联"
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors resize-none"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={!url.trim() || !title.trim()}
                className="w-full px-4 py-2.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                补录链接
              </button>
            </div>
          </div>

          {tickets.length > 0 && (
            <div className="bg-[#16162a] border border-slate-800 rounded-xl p-5 mt-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">线上反馈工单</h3>
              <div className="space-y-2">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between px-3 py-2 bg-slate-900/30 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-amber-400">{ticket.ticketNo}</span>
                      <span className="text-xs text-slate-400">{ticket.title}</span>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        ticket.status === 'open'
                          ? 'bg-red-500/10 text-red-400'
                          : ticket.status === 'in_progress'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-emerald-500/10 text-emerald-400'
                      }`}
                    >
                      {ticket.status === 'open' ? '待处理' : ticket.status === 'in_progress' ? '处理中' : '已关闭'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="bg-[#16162a] border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">
              已关联知识库链接 <span className="text-amber-400">({links.length})</span>
            </h3>
            {links.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-600">
                暂无知识库链接，请在左侧补录
              </div>
            ) : (
              <div className="space-y-3">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className="bg-slate-900/30 border border-slate-800 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <ExternalLink size={13} className="text-amber-400 shrink-0" />
                          <span className="text-sm text-slate-200 truncate">{link.title}</span>
                        </div>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-amber-400/70 hover:text-amber-400 truncate block"
                        >
                          {link.url}
                        </a>
                        {editingId === link.id ? (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="text"
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              className="flex-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
                            />
                            <button
                              onClick={() => handleSaveNote(link.id)}
                              className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 text-slate-400 hover:bg-slate-700 rounded"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs text-slate-500">
                              {link.note || '无备注'}
                            </span>
                            <button
                              onClick={() => {
                                setEditingId(link.id)
                                setEditNote(link.note)
                              }}
                              className="p-0.5 text-slate-600 hover:text-amber-400 transition-colors"
                            >
                              <Pencil size={11} />
                            </button>
                          </div>
                        )}
                        <div className="mt-1 text-[10px] text-slate-600">
                          {link.addedBy} · {new Date(link.addedAt).toLocaleString('zh-CN')}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveLink(link.id)}
                        className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors ml-2"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {exposures.length > 0 && (
            <div className="bg-[#16162a] border border-slate-800 rounded-xl p-5 mt-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">
                漏遮手机号 <span className="text-red-400">({exposures.filter((e) => e.isLeaked).length})</span>
              </h3>
              <div className="space-y-2">
                {exposures
                  .filter((e) => e.isLeaked)
                  .map((exp) => (
                    <div
                      key={exp.id}
                      className="flex items-center justify-between px-3 py-2 bg-red-500/5 border border-red-500/10 rounded-lg"
                    >
                      <div>
                        <span className="font-mono text-sm text-red-400">{exp.maskedPhone}</span>
                        <p className="text-xs text-slate-500 mt-0.5">{exp.retainReason}</p>
                      </div>
                      <span className="text-[10px] text-slate-600">{exp.paramVersion}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
