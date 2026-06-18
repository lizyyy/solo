import { useEffect, useState } from 'react'
import { useCoralStore } from '@/store/coralStore'
import { Plus, AlertCircle, MessageSquare, Send, X } from 'lucide-react'

export default function DataEntry() {
  const { records, mismatchRecords, loading, fetchRecords, fetchMismatchRecords, addRecord, addAnnotation } = useCoralStore()
  const [form, setForm] = useState({
    site_name: '',
    latitude: '',
    longitude: '',
    sample_time: '',
    experiment_result: '',
    bleaching_level: '1',
    source_type: 'original',
  })
  const [annotationTarget, setAnnotationTarget] = useState<string | null>(null)
  const [annotationForm, setAnnotationForm] = useState({ content: '', is_retroactive: false })

  useEffect(() => {
    fetchRecords()
    fetchMismatchRecords()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await addRecord({
      site_name: form.site_name,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      sample_time: form.sample_time,
      experiment_result: form.experiment_result,
      bleaching_level: parseInt(form.bleaching_level),
      source_type: form.source_type,
    })
    setForm({ site_name: '', latitude: '', longitude: '', sample_time: '', experiment_result: '', bleaching_level: '1', source_type: 'original' })
  }

  const handleAnnotationSubmit = async (recordId: string) => {
    if (!annotationForm.content.trim()) return
    await addAnnotation(recordId, {
      annotator: '生态调查员',
      content: annotationForm.content,
      is_retroactive: annotationForm.is_retroactive,
    })
    setAnnotationTarget(null)
    setAnnotationForm({ content: '', is_retroactive: false })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-card p-5">
        <h3 className="font-serif text-ocean-500 text-base mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-coral-500" />
          新增记录
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-ocean-500/60 mb-1">站点名称</label>
            <input
              type="text"
              value={form.site_name}
              onChange={(e) => setForm({ ...form, site_name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-ocean-100 text-sm text-ocean-500 focus:outline-none focus:border-seafoam-500 focus:ring-1 focus:ring-seafoam-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-ocean-500/60 mb-1">纬度</label>
            <input
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-ocean-100 text-sm text-ocean-500 focus:outline-none focus:border-seafoam-500 focus:ring-1 focus:ring-seafoam-500 font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-ocean-500/60 mb-1">经度</label>
            <input
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-ocean-100 text-sm text-ocean-500 focus:outline-none focus:border-seafoam-500 focus:ring-1 focus:ring-seafoam-500 font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-ocean-500/60 mb-1">采样时间</label>
            <input
              type="datetime-local"
              value={form.sample_time}
              onChange={(e) => setForm({ ...form, sample_time: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-ocean-100 text-sm text-ocean-500 focus:outline-none focus:border-seafoam-500 focus:ring-1 focus:ring-seafoam-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-ocean-500/60 mb-1">实验结果</label>
            <input
              type="text"
              value={form.experiment_result}
              onChange={(e) => setForm({ ...form, experiment_result: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-ocean-100 text-sm text-ocean-500 focus:outline-none focus:border-seafoam-500 focus:ring-1 focus:ring-seafoam-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-ocean-500/60 mb-1">白化等级</label>
            <select
              value={form.bleaching_level}
              onChange={(e) => setForm({ ...form, bleaching_level: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-ocean-100 text-sm text-ocean-500 focus:outline-none focus:border-seafoam-500 focus:ring-1 focus:ring-seafoam-500"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n} 级</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ocean-500/60 mb-1">数据来源</label>
            <select
              value={form.source_type}
              onChange={(e) => setForm({ ...form, source_type: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-ocean-100 text-sm text-ocean-500 focus:outline-none focus:border-seafoam-500 focus:ring-1 focus:ring-seafoam-500"
            >
              <option value="original">原始记录</option>
              <option value="retroactive_note">后补备注</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-coral-500 hover:bg-coral-600 text-white py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              提交记录
            </button>
          </div>
        </form>
      </div>

      {mismatchRecords.length > 0 && (
        <div className="bg-coral-50/90 backdrop-blur-sm border border-coral-200 rounded-xl p-4">
          <h3 className="font-serif text-coral-700 text-base mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            时空匹配校验结果
          </h3>
          <div className="space-y-2">
            {mismatchRecords.map((record: any) => (
              <div key={record.id} className="bg-white/80 rounded-lg p-3 text-sm">
                <span className="font-semibold text-ocean-500">{record.site_name}</span>
                <span className="text-ocean-400 mx-2">—</span>
                <span className="text-coral-600">
                  采样时间 {record.sample_time?.substring(0, 7)} 与实验结果引用时间不一致
                </span>
                <p className="text-xs text-ocean-400 mt-1">
                  纬度: <span className="font-mono">{record.latitude}</span> 经度: <span className="font-mono">{record.longitude}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card p-5">
        <h3 className="font-serif text-ocean-500 text-base mb-4">记录本数据</h3>
        {loading && records.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ocean-100">
                  <th className="text-left py-2 px-3 text-ocean-400 font-semibold">站点</th>
                  <th className="text-left py-2 px-3 text-ocean-400 font-semibold">纬度</th>
                  <th className="text-left py-2 px-3 text-ocean-400 font-semibold">经度</th>
                  <th className="text-left py-2 px-3 text-ocean-400 font-semibold">采样时间</th>
                  <th className="text-left py-2 px-3 text-ocean-400 font-semibold">实验结果</th>
                  <th className="text-left py-2 px-3 text-ocean-400 font-semibold">白化等级</th>
                  <th className="text-left py-2 px-3 text-ocean-400 font-semibold">来源</th>
                  <th className="text-left py-2 px-3 text-ocean-400 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record: any) => (
                  <tr
                    key={record.id}
                    className={`border-b border-ocean-50 hover:bg-ocean-50/50 transition-colors ${
                      record.source_type === 'retroactive_note'
                        ? 'border-l-[3px] border-l-coral-400 italic'
                        : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 text-ocean-500">{record.site_name}</td>
                    <td className="py-2.5 px-3 font-mono text-ocean-500">{record.latitude}</td>
                    <td className="py-2.5 px-3 font-mono text-ocean-500">{record.longitude}</td>
                    <td className="py-2.5 px-3 text-ocean-500">{new Date(record.sample_time).toLocaleString('zh-CN')}</td>
                    <td className="py-2.5 px-3 text-ocean-500">{record.experiment_result}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        record.bleaching_level >= 4 ? 'bg-coral-100 text-coral-700' :
                        record.bleaching_level >= 3 ? 'bg-coral-50 text-coral-600' :
                        'bg-seafoam-50 text-seafoam-700'
                      }`}>
                        {record.bleaching_level} 级
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        record.source_type === 'retroactive_note' ? 'bg-coral-50 text-coral-600' : 'bg-ocean-50 text-ocean-600'
                      }`}>
                        {record.source_type === 'retroactive_note' ? '后补' : '原始'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => setAnnotationTarget(annotationTarget === record.id ? null : record.id)}
                        className="flex items-center gap-1 text-xs text-seafoam-600 hover:text-seafoam-700 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        添加备注
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {annotationTarget && (
          <div className="mt-4 bg-ocean-50/80 rounded-xl p-4 border border-ocean-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-ocean-500">添加备注</h4>
              <button onClick={() => setAnnotationTarget(null)} className="text-ocean-400 hover:text-ocean-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={annotationForm.content}
              onChange={(e) => setAnnotationForm({ ...annotationForm, content: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-ocean-100 text-sm text-ocean-500 focus:outline-none focus:border-seafoam-500 resize-none"
              rows={3}
              placeholder="输入备注内容..."
            />
            <div className="flex items-center justify-between mt-3">
              <label className="flex items-center gap-2 text-sm text-ocean-500">
                <input
                  type="checkbox"
                  checked={annotationForm.is_retroactive}
                  onChange={(e) => setAnnotationForm({ ...annotationForm, is_retroactive: e.target.checked })}
                  className="rounded border-ocean-200 text-seafoam-500 focus:ring-seafoam-500"
                />
                是否后补
              </label>
              <button
                onClick={() => handleAnnotationSubmit(annotationTarget)}
                disabled={loading || !annotationForm.content.trim()}
                className="flex items-center gap-1.5 bg-seafoam-500 hover:bg-seafoam-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                提交
              </button>
            </div>
          </div>
        )}

        {records.some((r: any) => r.annotations?.length > 0) && (
          <div className="mt-4 space-y-2">
            <h4 className="text-xs text-ocean-400 font-semibold">已有备注</h4>
            {records.filter((r: any) => r.annotations?.length > 0).map((record: any) => (
              <div key={record.id} className="space-y-1">
                {record.annotations.map((ann: any) => (
                  <div key={ann.id} className="inline-flex items-center gap-2 bg-seafoam-50/80 text-seafoam-800 px-3 py-1.5 rounded-full text-xs mr-2 mb-1">
                    <span className="font-semibold">{ann.annotator}</span>
                    <span>{ann.content}</span>
                    <span className="text-seafoam-500">{new Date(ann.annotation_time).toLocaleString('zh-CN')}</span>
                    {ann.is_retroactive && (
                      <span className="bg-coral-100 text-coral-600 px-1.5 py-0.5 rounded text-xs">后补</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
