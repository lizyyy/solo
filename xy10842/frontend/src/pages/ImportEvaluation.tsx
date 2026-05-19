import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { evaluations } from '../services/api'

interface MetricInput {
  metric_name: string
  metric_value: string
  metric_unit: string
  threshold: string
  is_alert: boolean
}

interface FailureSampleInput {
  sample_id: string
  input_data: string
  expected_output: string
  actual_output: string
  error_type: string
}

export default function ImportEvaluation() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    model_version_name: '',
    model_name: '',
    dataset_name: '',
    dataset_version: '',
  })

  const [metrics, setMetrics] = useState<MetricInput[]>([
    { metric_name: 'accuracy', metric_value: '0.9', metric_unit: '', threshold: '0.8', is_alert: false },
  ])

  const [failureSamples, setFailureSamples] = useState<FailureSampleInput[]>([
    { sample_id: 'S1', input_data: '输入示例', expected_output: '期望输出', actual_output: '实际输出', error_type: '格式错误' },
  ])

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleMetricChange = (index: number, field: string, value: any) => {
    const newMetrics = [...metrics]
    newMetrics[index] = { ...newMetrics[index], [field]: value }
    setMetrics(newMetrics)
  }

  const addMetric = () => {
    setMetrics([...metrics, { metric_name: '', metric_value: '', metric_unit: '', threshold: '', is_alert: false }])
  }

  const removeMetric = (index: number) => {
    setMetrics(metrics.filter((_, i) => i !== index))
  }

  const handleSampleChange = (index: number, field: string, value: string) => {
    const newSamples = [...failureSamples]
    newSamples[index] = { ...newSamples[index], [field]: value }
    setFailureSamples(newSamples)
  }

  const addSample = () => {
    setFailureSamples([...failureSamples, { sample_id: '', input_data: '', expected_output: '', actual_output: '', error_type: '' }])
  }

  const removeSample = (index: number) => {
    setFailureSamples(failureSamples.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = {
        ...formData,
        metrics: metrics.map(m => ({
          ...m,
          metric_value: parseFloat(m.metric_value),
          threshold: m.threshold ? parseFloat(m.threshold) : null,
        })),
        failure_samples: failureSamples,
      }

      await evaluations.import(data)
      setSuccess(true)
      setTimeout(() => navigate('/evaluations'), 1500)
    } catch (error) {
      console.error('导入失败:', error)
      alert('导入失败，请检查输入')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">导入评测结果</h1>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md text-green-700">
          评测导入成功！正在跳转到评测列表...
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">基本信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">模型版本号</label>
              <input
                type="text"
                value={formData.model_version_name}
                onChange={(e) => handleInputChange('model_version_name', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="如: v3.0.0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">模型名称</label>
              <input
                type="text"
                value={formData.model_name}
                onChange={(e) => handleInputChange('model_name', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="如: GPT-4"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">数据集名称</label>
              <input
                type="text"
                value={formData.dataset_name}
                onChange={(e) => handleInputChange('dataset_name', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="如: SQuAD-v1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">数据集版本</label>
              <input
                type="text"
                value={formData.dataset_version}
                onChange={(e) => handleInputChange('dataset_version', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="如: 1.0"
                required
              />
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">评测指标</h3>
            <button
              type="button"
              onClick={addMetric}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-sm"
            >
              + 添加指标
            </button>
          </div>
          <div className="space-y-4">
            {metrics.map((metric, index) => (
              <div key={index} className="grid grid-cols-5 gap-3 items-end bg-gray-50 p-4 rounded-md">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">指标名称</label>
                  <input
                    type="text"
                    value={metric.metric_name}
                    onChange={(e) => handleMetricChange(index, 'metric_name', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="accuracy"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">指标值</label>
                  <input
                    type="number"
                    step="any"
                    value={metric.metric_value}
                    onChange={(e) => handleMetricChange(index, 'metric_value', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.95"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">单位</label>
                  <input
                    type="text"
                    value={metric.metric_unit}
                    onChange={(e) => handleMetricChange(index, 'metric_unit', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="%"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">阈值</label>
                  <input
                    type="number"
                    step="any"
                    value={metric.threshold}
                    onChange={(e) => handleMetricChange(index, 'threshold', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.8"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={metric.is_alert}
                      onChange={(e) => handleMetricChange(index, 'is_alert', e.target.checked)}
                      className="mr-1"
                    />
                    告警
                  </label>
                  <button
                    type="button"
                    onClick={() => removeMetric(index)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">失败样本（可选）</h3>
            <button
              type="button"
              onClick={addSample}
              className="px-3 py-1 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 text-sm"
            >
              + 添加失败样本
            </button>
          </div>
          <div className="space-y-4">
            {failureSamples.map((sample, index) => (
              <div key={index} className="bg-red-50 p-4 rounded-md">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-gray-700">样本 #{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeSample(index)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    删除
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">样本ID</label>
                    <input
                      type="text"
                      value={sample.sample_id}
                      onChange={(e) => handleSampleChange(index, 'sample_id', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="S001"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">错误类型</label>
                    <input
                      type="text"
                      value={sample.error_type}
                      onChange={(e) => handleSampleChange(index, 'error_type', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="格式错误"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">输入数据</label>
                    <textarea
                      value={sample.input_data}
                      onChange={(e) => handleSampleChange(index, 'input_data', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="输入内容"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">期望输出</label>
                    <textarea
                      value={sample.expected_output}
                      onChange={(e) => handleSampleChange(index, 'expected_output', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="期望输出内容"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">实际输出</label>
                    <textarea
                      value={sample.actual_output}
                      onChange={(e) => handleSampleChange(index, 'actual_output', e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="实际输出内容"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '导入中...' : '导入评测'}
          </button>
        </div>
      </form>
    </div>
  )
}
