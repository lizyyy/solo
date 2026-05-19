import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { evaluations, metrics, failureSamples, notes } from '../services/api'
import { Evaluation, Metric, FailureSample, Note } from '../types'

export default function EvaluationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [metricList, setMetricList] = useState<Metric[]>([])
  const [samples, setSamples] = useState<FailureSample[]>([])
  const [noteList, setNoteList] = useState<Note[]>([])
  const [newNote, setNewNote] = useState({ author: '', content: '' })
  const [loading, setLoading] = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)

  useEffect(() => {
    if (id) {
      fetchDetailData(parseInt(id))
    }
  }, [id])

  const fetchDetailData = async (evalId: number) => {
    setLoading(true)
    try {
      const [evalData, metricData, sampleData, noteData] = await Promise.all([
        evaluations.getById(evalId),
        metrics.getAll({ evaluation_id: evalId }),
        failureSamples.getAll({ evaluation_id: evalId }),
        notes.getAll({ evaluation_id: evalId }),
      ])
      setEvaluation(evalData)
      setMetricList(metricData)
      setSamples(sampleData)
      setNoteList(noteData)
    } catch (error) {
      console.error('Failed to fetch evaluation detail:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return
    setStatusLoading(true)
    try {
      await evaluations.updateStatus(parseInt(id), newStatus)
      await fetchDetailData(parseInt(id))
    } catch (error) {
      console.error('Failed to update status:', error)
    } finally {
      setStatusLoading(false)
    }
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !newNote.author || !newNote.content) return
    try {
      await notes.create({ ...newNote, evaluation_id: parseInt(id) })
      setNewNote({ author: '', content: '' })
      await fetchDetailData(parseInt(id))
    } catch (error) {
      console.error('Failed to add note:', error)
    }
  }

  const handleResolveSample = async (sampleId: number, resolved: boolean) => {
    try {
      await failureSamples.update(sampleId, { is_resolved: resolved })
      await fetchDetailData(parseInt(id!))
    } catch (error) {
      console.error('Failed to update sample:', error)
    }
  }

  const handleExport = async (format: 'json' | 'csv') => {
    if (!id) return
    try {
      const data = await evaluations.export(parseInt(id), format)
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `evaluation_${id}.json`
        a.click()
      } else {
        const blob = new Blob([data.data], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `evaluation_${id}.csv`
        a.click()
      }
    } catch (error) {
      console.error('Failed to export:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'running': return 'bg-blue-100 text-blue-800'
      case 'error': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成'
      case 'failed': return '失败'
      case 'running': return '运行中'
      case 'error': return '异常'
      default: return status
    }
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  if (!evaluation) {
    return <div className="text-center py-12">评测不存在</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate(-1)}
          className="text-blue-600 hover:text-blue-700 flex items-center"
        >
          ← 返回列表
        </button>
        <div className="space-x-2">
          <button
            onClick={() => handleExport('json')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            导出 JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            导出 CSV
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">评测详情</h3>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
            <div>
              <dt className="text-sm font-medium text-gray-500">ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{evaluation.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">数据集</dt>
              <dd className="mt-1 text-sm text-gray-900">{evaluation.dataset_name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">状态</dt>
              <dd className="mt-1">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(evaluation.status)}`}>
                  {getStatusText(evaluation.status)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">样本统计</dt>
              <dd className="mt-1 text-sm text-gray-900">
                通过: {evaluation.passed_samples || 0} | 失败: {evaluation.failed_samples || 0} | 总计: {evaluation.total_samples || 0}
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-500 mb-2">状态推进</h4>
            <div className="flex flex-wrap gap-2">
              {['running', 'completed', 'failed', 'error'].map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={statusLoading || evaluation.status === status}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    evaluation.status === status
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } ${statusLoading ? 'opacity-50' : ''}`}
                >
                  {getStatusText(status)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">指标列表</h3>
        </div>
        <div className="border-t border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">指标名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">值</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">阈值</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">告警</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metricList.map((metric) => (
                <tr key={metric.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{metric.metric_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {metric.metric_value}{metric.metric_unit ? ` ${metric.metric_unit}` : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{metric.threshold || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {metric.is_alert ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">是</span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">否</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">失败样本 ({samples.length})</h3>
        </div>
        <div className="border-t border-gray-200">
          <ul className="divide-y divide-gray-200">
            {samples.map((sample) => (
              <li key={sample.id} className="px-4 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900">样本 ID: {sample.sample_id}</p>
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        sample.is_resolved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {sample.is_resolved ? '已解决' : '未解决'}
                      </span>
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        {sample.error_type}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-gray-500">输入</p>
                        <p className="mt-1 text-gray-900 truncate">{sample.input_data}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500">期望输出</p>
                        <p className="mt-1 text-gray-900 truncate">{sample.expected_output}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500">实际输出</p>
                        <p className="mt-1 text-gray-900 truncate">{sample.actual_output}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleResolveSample(sample.id, !sample.is_resolved)}
                    className={`ml-4 px-3 py-1 rounded-md text-sm font-medium ${
                      sample.is_resolved
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {sample.is_resolved ? '标记未解决' : '标记已解决'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">备注</h3>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          <form onSubmit={handleAddNote} className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">作者</label>
                <input
                  type="text"
                  value={newNote.author}
                  onChange={(e) => setNewNote({ ...newNote, author: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入作者名"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newNote.content}
                    onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="输入备注内容"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    添加备注
                  </button>
                </div>
              </div>
            </div>
          </form>

          <ul className="space-y-4">
            {noteList.map((note) => (
              <li key={note.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium text-gray-900">{note.author}</p>
                  <p className="text-xs text-gray-500">{new Date(note.created_at).toLocaleString()}</p>
                </div>
                <p className="mt-2 text-sm text-gray-700">{note.content}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
