import { useState, useEffect } from 'react'
import { modelVersions, releaseSuggestions } from '../services/api'
import { ModelVersion, ReleaseSuggestion } from '../types'

export default function ReleaseSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<ReleaseSuggestion[]>([])
  const [versions, setVersions] = useState<ModelVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [formData, setFormData] = useState({
    model_version_id: '',
    suggestion_type: 'review',
    content: '',
    author: '',
  })

  const [approvingId, setApprovingId] = useState<number | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [suggestionsData, versionsData] = await Promise.all([
        releaseSuggestions.getAll(),
        modelVersions.getAll(),
      ])
      setSuggestions(suggestionsData)
      setVersions(versionsData)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.model_version_id) {
      alert('请选择模型版本')
      return
    }

    try {
      await releaseSuggestions.create({
        ...formData,
        model_version_id: parseInt(formData.model_version_id),
      })
      setShowForm(false)
      setFormData({
        model_version_id: '',
        suggestion_type: 'review',
        content: '',
        author: '',
      })
      await fetchData()
    } catch (error) {
      console.error('Failed to create suggestion:', error)
      alert('创建失败，请重试')
    }
  }

  const handleApprove = async (id: number) => {
    const approvedBy = prompt('请输入审批人姓名:')
    if (!approvedBy) return

    setApprovingId(id)
    try {
      await releaseSuggestions.approve(id, approvedBy)
      await fetchData()
    } catch (error) {
      console.error('Failed to approve suggestion:', error)
      alert('审批失败，请重试')
    } finally {
      setApprovingId(null)
    }
  }

  const getVersionName = (id: number) => {
    const version = versions.find(v => v.id === id)
    return version ? version.version_name : `ID: ${id}`
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'release':
        return '建议发布'
      case 'review':
        return '建议复审'
      case 'hold':
        return '建议暂停'
      default:
        return type
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'release':
        return 'bg-green-100 text-green-800'
      case 'review':
        return 'bg-yellow-100 text-yellow-800'
      case 'hold':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">发布建议</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {showForm ? '取消' : '+ 新建建议'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">创建发布建议</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模型版本</label>
                <select
                  value={formData.model_version_id}
                  onChange={(e) => handleInputChange('model_version_id', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">请选择</option>
                  {versions.map(v => (
                    <option key={v.id} value={v.id}>{v.version_name} - {v.model_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">建议类型</label>
                <select
                  value={formData.suggestion_type}
                  onChange={(e) => handleInputChange('suggestion_type', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="review">建议复审</option>
                  <option value="release">建议发布</option>
                  <option value="hold">建议暂停</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">提出人</label>
                <input
                  type="text"
                  value={formData.author}
                  onChange={(e) => handleInputChange('author', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入姓名"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">建议内容</label>
              <textarea
                value={formData.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="请详细描述发布建议的内容和理由..."
                required
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                创建建议
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-12">加载中...</div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>暂无发布建议</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {suggestions.map(suggestion => (
              <div key={suggestion.id} className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(suggestion.suggestion_type)}`}>
                      {getTypeLabel(suggestion.suggestion_type)}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      模型版本: {getVersionName(suggestion.model_version_id)}
                    </span>
                    {suggestion.is_approved && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        已批准
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    创建于 {new Date(suggestion.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-gray-700 mb-4">{suggestion.content}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">提出人: {suggestion.author}</span>
                  <div>
                    {suggestion.is_approved ? (
                      <span className="text-sm text-gray-500">
                        批准人: {suggestion.approved_by} | 时间: {new Date(suggestion.approved_at!).toLocaleString()}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleApprove(suggestion.id)}
                        disabled={approvingId === suggestion.id}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
                      >
                        {approvingId === suggestion.id ? '处理中...' : '批准'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
