import { useState, useEffect } from 'react'
import { evaluations } from '../services/api'
import { Evaluation } from '../types'

export default function CompareEvaluations() {
  const [allEvaluations, setAllEvaluations] = useState<Evaluation[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [comparisonData, setComparisonData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)

  useEffect(() => {
    fetchEvaluations()
  }, [])

  const fetchEvaluations = async () => {
    try {
      const data = await evaluations.getAll()
      setAllEvaluations(data)
    } catch (error) {
      console.error('Failed to fetch evaluations:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelection = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  const handleCompare = async () => {
    if (selectedIds.length < 2) {
      alert('请至少选择2个评测进行对比')
      return
    }

    setComparing(true)
    try {
      const data = await metrics.compare(selectedIds)
      setComparisonData(data)
    } catch (error) {
      console.error('Failed to compare:', error)
      alert('对比失败，请重试')
    } finally {
      setComparing(false)
    }
  }

  const getEvaluationLabel = (id: number) => {
    const evalItem = allEvaluations.find(e => e.id === id)
    if (!evalItem) return `ID: ${id}`
    return `${evalItem.dataset_name} (ID: ${id})`
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">指标对比</h1>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">选择评测进行对比</h3>
        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 max-h-64 overflow-y-auto">
              {allEvaluations.map(evalItem => (
                <div
                  key={evalItem.id}
                  onClick={() => toggleSelection(evalItem.id)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedIds.includes(evalItem.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{evalItem.dataset_name}</p>
                      <p className="text-sm text-gray-500">ID: {evalItem.id} | 状态: {evalItem.status}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(evalItem.id)}
                      onChange={() => {}}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">已选择 {selectedIds.length} 个评测</p>
              <button
                onClick={handleCompare}
                disabled={selectedIds.length < 2 || comparing}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {comparing ? '对比中...' : '开始对比'}
              </button>
            </div>
          </>
        )}
      </div>

      {comparisonData.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">对比结果</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    指标名称
                  </th>
                  {selectedIds.map(id => (
                    <th
                      key={id}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {getEvaluationLabel(id)}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    变化
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {comparisonData.map((item, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.metric_name}
                    </td>
                    {item.values.map((v: any, i: number) => (
                      <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {v.value} {v.unit || ''}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {item.values.length >= 2 ? (
                        <>
                          {((item.values[item.values.length - 1].value - item.values[0].value) /
                            item.values[0].value * 100).toFixed(2)}%
                          {item.values[item.values.length - 1].value > item.values[0].value ? (
                            <span className="ml-2 text-green-600">↑ 提升</span>
                          ) : item.values[item.values.length - 1].value < item.values[0].value ? (
                            <span className="ml-2 text-red-600">↓ 下降</span>
                          ) : (
                            <span className="ml-2 text-gray-500">持平</span>
                          )}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
