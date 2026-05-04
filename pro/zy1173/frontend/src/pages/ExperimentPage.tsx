import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { experimentApi, Experiment } from '@/api'
import { Plus, Trash2, Download, Eye, FileText, RefreshCw, AlertCircle, Save } from 'lucide-react'

const experimentTypeLabels: Record<string, string> = {
  tokenization: 'Tokenization',
  inference: '推理',
  sampling_comparison: '采样策略对比',
  kv_cache_test: 'KV Cache 测试',
  fine_tune: '微调',
}

const experimentTypeColors: Record<string, string> = {
  tokenization: 'bg-blue-100 text-blue-800',
  inference: 'bg-green-100 text-green-800',
  sampling_comparison: 'bg-purple-100 text-purple-800',
  kv_cache_test: 'bg-orange-100 text-orange-800',
  fine_tune: 'bg-pink-100 text-pink-800',
}

export default function ExperimentPage() {
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: experimentsData, isLoading, refetch } = useQuery({
    queryKey: ['experiments', filterType],
    queryFn: () =>
      experimentApi.list({
        type: filterType === 'all' ? undefined : filterType,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => experimentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] })
      if (selectedExperiment?.id) {
        setSelectedExperiment(null)
      }
    },
  })

  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除这个实验吗？此操作不可撤销。')) {
      deleteMutation.mutate(id)
    }
  }

  const handleExportMarkdown = async (id: string) => {
    try {
      const response = await experimentApi.exportMarkdown(id)
      const blob = new Blob([response.data], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `experiment-${id}.md`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const handleExportJson = async (id: string) => {
    try {
      const response = await experimentApi.exportJson(id)
      const blob = new Blob([JSON.stringify(response.data.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `experiment-${id}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">实验管理</h1>
          <p className="text-gray-600 mt-1">
            管理和导出你的实验记录，支持 Markdown 和 JSON 格式
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw size={16} />
            刷新
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} />
            新建实验
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">筛选类型:</span>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="all">全部</option>
          <option value="tokenization">Tokenization</option>
          <option value="inference">推理</option>
          <option value="sampling_comparison">采样策略对比</option>
          <option value="kv_cache_test">KV Cache 测试</option>
          <option value="fine_tune">微调</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                实验列表 ({experimentsData?.data.total || 0})
              </h3>
            </div>
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">
                <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                加载中...
              </div>
            ) : experimentsData?.data.experiments.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FileText className="mx-auto mb-2 opacity-50" size={32} />
                <p>暂无实验记录</p>
                <p className="text-sm mt-1">在其他页面完成实验后，可以保存到这里</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {experimentsData.data.experiments.map((experiment) => (
                  <div
                    key={experiment.id}
                    className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                      selectedExperiment?.id === experiment.id ? 'bg-primary-50' : ''
                    }`}
                    onClick={() => setSelectedExperiment(experiment)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {experiment.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              experimentTypeColors[experiment.type] || 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {experimentTypeLabels[experiment.type] || experiment.type}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(experiment.created_at).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedExperiment ? (
            <ExperimentDetail
              experiment={selectedExperiment}
              onDelete={() => handleDelete(selectedExperiment.id)}
              onExportMarkdown={() => handleExportMarkdown(selectedExperiment.id)}
              onExportJson={() => handleExportJson(selectedExperiment.id)}
            />
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Eye className="mx-auto mb-4 opacity-30" size={48} />
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                选择一个实验查看详情
              </h3>
              <p className="text-gray-500">
                从左侧列表点击一个实验，查看详细信息、风险说明和导出选项
              </p>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateExperimentModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            queryClient.invalidateQueries({ queryKey: ['experiments'] })
          }}
        />
      )}
    </div>
  )
}

function ExperimentDetail({
  experiment,
  onDelete,
  onExportMarkdown,
  onExportJson,
}: {
  experiment: Experiment
  onDelete: () => void
  onExportMarkdown: () => void
  onExportJson: () => void
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{experiment.name}</h2>
            <div className="flex items-center gap-3 mt-2">
              <span
                className={`px-2 py-1 rounded text-sm font-medium ${
                  experimentTypeColors[experiment.type] || 'bg-gray-100 text-gray-800'
                }`}
              >
                {experimentTypeLabels[experiment.type] || experiment.type}
              </span>
              <span className="text-sm text-gray-500">
                创建于: {new Date(experiment.created_at).toLocaleString('zh-CN')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onExportMarkdown}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <FileText size={14} />
              导出 Markdown
            </button>
            <button
              onClick={onExportJson}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
            >
              <Download size={14} />
              导出 JSON
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              <Trash2 size={14} />
              删除
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
        {experiment.risks.length > 0 && (
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h3 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
              <AlertCircle size={16} />
              ⚠️ 风险说明
            </h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              {experiment.risks.map((risk, index) => (
                <li key={index}>• {risk}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="font-semibold text-gray-900 mb-3">输入数据</h3>
          <div className="p-4 bg-gray-50 rounded-lg">
            <pre className="text-sm text-gray-700 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(experiment.input_data, null, 2)}
            </pre>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 mb-3">实验参数</h3>
          <div className="p-4 bg-gray-50 rounded-lg">
            <pre className="text-sm text-gray-700 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(experiment.parameters, null, 2)}
            </pre>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 mb-3">实验结果</h3>
          <div className="p-4 bg-primary-50 rounded-lg border border-primary-100">
            <pre className="text-sm text-gray-700 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(experiment.results, null, 2)}
            </pre>
          </div>
        </div>

        {experiment.notes && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">备注</h3>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{experiment.notes}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CreateExperimentModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState('inference')
  const [parameters, setParameters] = useState('{}')
  const [results, setResults] = useState('{}')
  const [inputData, setInputData] = useState('{}')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: () => {
      let parsedParams = {}
      let parsedResults = {}
      let parsedInput = {}

      try {
        parsedParams = JSON.parse(parameters)
      } catch {
        throw new Error('参数 JSON 格式错误')
      }
      try {
        parsedResults = JSON.parse(results)
      } catch {
        throw new Error('结果 JSON 格式错误')
      }
      try {
        parsedInput = JSON.parse(inputData)
      } catch {
        throw new Error('输入数据 JSON 格式错误')
      }

      return experimentApi.create({
        name,
        type,
        parameters: parsedParams,
        results: parsedResults,
        input_data: parsedInput,
        notes,
      })
    },
    onSuccess: () => {
      onSuccess()
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : '创建失败')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('请输入实验名称')
      return
    }
    setError('')
    createMutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">新建实验</h2>
          <p className="text-gray-600 text-sm mt-1">
            手动创建一个实验记录（通常在其他页面完成实验后自动保存）
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              实验名称 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：Tokenizer 测试 - 中文文本"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              实验类型
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="tokenization">Tokenization</option>
              <option value="inference">推理</option>
              <option value="sampling_comparison">采样策略对比</option>
              <option value="kv_cache_test">KV Cache 测试</option>
              <option value="fine_tune">微调</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              输入数据 (JSON)
            </label>
            <textarea
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
              rows={3}
              placeholder='{"text": "Hello world"}'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              实验参数 (JSON)
            </label>
            <textarea
              value={parameters}
              onChange={(e) => setParameters(e.target.value)}
              rows={3}
              placeholder='{"temperature": 0.7, "top_p": 0.9}'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              实验结果 (JSON)
            </label>
            <textarea
              value={results}
              onChange={(e) => setResults(e.target.value)}
              rows={3}
              placeholder='{"generated_tokens": [123, 456], "latency_ms": 100}'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              备注 (可选)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="添加一些备注信息..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </form>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? (
              <RefreshCw className="animate-spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            {createMutation.isPending ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
