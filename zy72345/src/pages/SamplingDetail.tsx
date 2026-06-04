import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Clock, Database, FileSpreadsheet } from 'lucide-react'
import { useStore } from '@/store'

const statusLabels: Record<string, string> = {
  pending: '待处理',
  confirmed: '已确认',
  ignored: '已忽略',
}

const oldStatusLabels: Record<string, string> = {
  normal: '正常',
  missing: '缺失',
  anomaly: '异常',
}

export default function SamplingDetail() {
  const { id } = useParams<{ id: string }>()
  const { currentList, samplingRecords, relatedParams, loading, fetchSamplingDetail } = useStore()

  useEffect(() => {
    if (id) fetchSamplingDetail(id)
  }, [id])

  if (loading.samplingDetail) {
    return <div className="text-slate-400 text-center py-12">加载中...</div>
  }

  if (!currentList) {
    return <div className="text-slate-400 text-center py-12">名单不存在</div>
  }

  return (
    <div className="space-y-6">
      <Link to="/sampling" className="inline-flex items-center gap-1 text-amber-500 hover:text-amber-400 text-sm transition-colors">
        <ArrowLeft size={16} />
        返回抽样名单
      </Link>

      <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-5">
        <h2 className="text-xl font-bold text-slate-100 mb-3" style={{ fontFamily: 'var(--font-title)' }}>{currentList.name}</h2>
        <div className="flex gap-6 text-sm text-slate-400">
          <span className="flex items-center gap-1"><Clock size={14} /> {new Date(currentList.importTime).toLocaleString('zh-CN')}</span>
          <span className="flex items-center gap-1"><Database size={14} /> {currentList.recordCount} 条记录</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${currentList.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-600/30 text-slate-400'}`}>
            {currentList.status === 'active' ? '活跃' : '已归档'}
          </span>
        </div>
      </div>

      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">原始值</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">负数</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">旧表状态</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">边界状态</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">备注</th>
            </tr>
          </thead>
          <tbody>
            {samplingRecords.map(record => (
              <tr key={record.id} className={`border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors ${record.isBoundary ? 'border-l-2 border-l-amber-500' : ''}`}>
                <td className="px-4 py-3 text-slate-200 font-mono">{record.originalValue}</td>
                <td className="px-4 py-3">
                  {record.isNegative ? <span className="text-rose-500">是</span> : <span className="text-slate-500">否</span>}
                </td>
                <td className="px-4 py-3 text-slate-400">{oldStatusLabels[record.oldTableStatus] || record.oldTableStatus}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    record.boundaryStatus === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                    record.boundaryStatus === 'confirmed' ? 'bg-emerald-500/10 text-emerald-500' :
                    'bg-slate-600/30 text-slate-400'
                  }`}>
                    {statusLabels[record.boundaryStatus]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-sm max-w-xs truncate">{record.remark || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {relatedParams.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-lg font-semibold text-slate-200 mb-3" style={{ fontFamily: 'var(--font-title)' }}>关联参数</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {relatedParams.map(param => (
              <div key={param.id} className="flex items-center justify-between bg-slate-800/30 rounded-lg p-3">
                <span className="text-slate-300 text-sm">{param.key}</span>
                <span className="text-amber-500 font-mono text-sm">{param.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
