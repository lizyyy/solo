import { useState, useEffect } from 'react'
import { Plus, Eye, Download, FileJson, FileSpreadsheet } from 'lucide-react'
import { useStore } from '@/store'
import { Modal, useToast } from '@/components/Dialog'
import type { FiringReport } from '@/types'

export default function Reports() {
  const { show, element: toastEl } = useToast()
  const { reports, batches, loading, fetchAll, generateReport, exportReport } = useStore()

  const [detailReport, setDetailReport] = useState<FiringReport | null>(null)
  const [genModal, setGenModal] = useState(false)
  const [genBatchId, setGenBatchId] = useState('')
  const [exportMenu, setExportMenu] = useState<string | null>(null)

  useEffect(() => { if (reports.length === 0) fetchAll() }, [])

  const eligibleBatches = batches.filter(b => b.status === 'firing' || b.status === 'completed')

  const handleGenerate = async () => {
    if (!genBatchId) { show('请选择批次', 'warning'); return }
    const res = await generateReport(genBatchId)
    if (res) { show('报告已生成'); setGenModal(false); setGenBatchId('') }
    else show('生成失败', 'error')
  }

  const handleExport = (id: string, format: 'json' | 'csv') => {
    exportReport(id, format)
    setExportMenu(null)
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      {toastEl}

      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold text-slate2-700">烧制报告</h2>
        <button className="btn-primary btn-sm flex items-center gap-1" onClick={() => { setGenModal(true); setGenBatchId('') }}>
          <Plus className="w-4 h-4" /> 生成报告
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate2-400">加载中…</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-slate2-400">暂无报告</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map(r => (
            <div key={r.id} className="card p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-serif font-semibold text-slate2-700">{r.batch_name || r.batch_id}</h3>
                <span className="bg-clay-50 text-clay-600 px-2 py-0.5 rounded-full text-xs font-medium">{r.work_details.length} 件</span>
              </div>
              <p className="text-sm text-slate2-500 mb-3 line-clamp-2">{r.summary}</p>
              <p className="text-xs text-slate2-400 mb-3">{formatTime(r.generated_at)}</p>
              <div className="flex items-center gap-2 pt-2 border-t border-clay-50">
                <button className="btn-secondary btn-sm flex items-center gap-1 flex-1" onClick={() => setDetailReport(r)}>
                  <Eye className="w-3 h-3" /> 查看
                </button>
                <div className="relative">
                  <button className="btn-secondary btn-sm flex items-center gap-1"
                    onClick={() => setExportMenu(exportMenu === r.id ? null : r.id)}>
                    <Download className="w-3 h-3" /> 导出
                  </button>
                  {exportMenu === r.id && (
                    <div className="absolute right-0 bottom-full mb-1 bg-white rounded-lg shadow-lg border border-clay-100 py-1 z-10 min-w-[120px]">
                      <button className="w-full px-4 py-2 text-sm text-left hover:bg-clay-50 flex items-center gap-2"
                        onClick={() => handleExport(r.id, 'json')}>
                        <FileJson className="w-4 h-4 text-clay-400" /> JSON
                      </button>
                      <button className="w-full px-4 py-2 text-sm text-left hover:bg-clay-50 flex items-center gap-2"
                        onClick={() => handleExport(r.id, 'csv')}>
                        <FileSpreadsheet className="w-4 h-4 text-clay-400" /> CSV
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!detailReport} onClose={() => setDetailReport(null)} title="报告详情" wide>
        {detailReport && (
          <div className="space-y-5 print:text-black">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-slate2-700">{detailReport.batch_name || detailReport.batch_id}</h3>
              <span className="text-xs text-slate2-400">{formatTime(detailReport.generated_at)}</span>
            </div>
            <p className="text-sm text-slate2-500">{detailReport.summary}</p>

            <div>
              <h4 className="font-medium text-slate2-600 mb-2 text-sm">作品明细</h4>
              <div className="overflow-x-auto border border-clay-100 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-clay-50 text-left text-slate2-500">
                      <th className="px-4 py-2 font-medium">作品</th>
                      <th className="px-4 py-2 font-medium">学员</th>
                      <th className="px-4 py-2 font-medium">釉料</th>
                      <th className="px-4 py-2 font-medium">尺寸</th>
                      <th className="px-4 py-2 font-medium">位置</th>
                      <th className="px-4 py-2 font-medium">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-clay-50">
                    {detailReport.work_details.map(w => (
                      <tr key={w.work_id} className="hover:bg-clay-50/50">
                        <td className="px-4 py-2 text-slate2-700">{w.work_name}</td>
                        <td className="px-4 py-2 text-slate2-600">{w.student_name}</td>
                        <td className="px-4 py-2 text-slate2-500">{w.glaze_names.join('、')}</td>
                        <td className="px-4 py-2 text-slate2-500">{w.dimensions}</td>
                        <td className="px-4 py-2 text-slate2-500">{w.position}</td>
                        <td className="px-4 py-2 text-slate2-500">{w.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {detailReport.conflict_resolutions.length > 0 && (
              <div>
                <h4 className="font-medium text-slate2-600 mb-2 text-sm">冲突处理</h4>
                <div className="space-y-2">
                  {detailReport.conflict_resolutions.map((c, i) => (
                    <div key={i} className="bg-kiln-50 rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-kiln-100 text-kiln-600 px-2 py-0.5 rounded text-xs font-medium">{c.type}</span>
                        <span className="text-slate2-500">{c.description}</span>
                      </div>
                      <p className="text-kiln-500 text-xs">处理方式：{c.resolution}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={genModal} onClose={() => setGenModal(false)} title="生成报告">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate2-600 mb-1">选择批次</label>
            <select className="select-field" value={genBatchId} onChange={e => setGenBatchId(e.target.value)}>
              <option value="">选择已烧制/已完成的批次</option>
              {eligibleBatches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.status === 'firing' ? '烧制中' : '已完成'})</option>
              ))}
            </select>
            {eligibleBatches.length === 0 && (
              <p className="text-xs text-slate2-400 mt-1">暂无可生成报告的批次</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setGenModal(false)}>取消</button>
            <button className="btn-primary" onClick={handleGenerate} disabled={!genBatchId}>生成</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
