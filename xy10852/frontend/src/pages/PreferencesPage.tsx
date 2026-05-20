import { useState, useEffect } from 'react'
import { Plus, RefreshCw, Filter, ChevronDown } from 'lucide-react'
import { preferenceApi } from '../services/api'
import type { Preference, PreferenceCreate, ChannelType, SourceType, BusinessScene } from '../types'

export default function PreferencesPage() {
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [filters, setFilters] = useState({
    channel: '',
    status: '',
    business_scene: ''
  })
  const [newPreference, setNewPreference] = useState<PreferenceCreate>({
    user_id: '',
    channel: 'email',
    business_scene: 'marketing',
    enabled: true,
    source: 'admin_panel'
  })

  useEffect(() => {
    loadPreferences()
  }, [filters])

  const loadPreferences = async () => {
    setLoading(true)
    try {
      const response = await preferenceApi.getAll({
        channel: filters.channel || undefined,
        status: filters.status || undefined,
        business_scene: filters.business_scene || undefined
      })
      setPreferences(response.data)
    } catch (error) {
      console.error('Failed to load preferences:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      await preferenceApi.create(newPreference)
      setShowModal(false)
      loadPreferences()
      setNewPreference({
        user_id: '',
        channel: 'email',
        business_scene: 'marketing',
        enabled: true,
        source: 'admin_panel'
      })
    } catch (error) {
      console.error('Failed to create preference:', error)
    }
  }

  const channels: ChannelType[] = ['sms', 'email', 'in_app']
  const sources: SourceType[] = ['user_profile', 'admin_panel', 'batch_import', 'api', 'marketing_campaign']
  const scenes: BusinessScene[] = ['transactional', 'marketing', 'security', 'system']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">偏好管理</h1>
          <p className="text-gray-500 mt-1">管理用户通知偏好配置</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadPreferences}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新增偏好
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filters.channel}
            onChange={(e) => setFilters({ ...filters, channel: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部渠道</option>
            {channels.map((c) => (
              <option key={c} value={c}>{c.toUpperCase()}</option>
            ))}
          </select>
          <select
            value={filters.business_scene}
            onChange={(e) => setFilters({ ...filters, business_scene: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部场景</option>
            {scenes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            <option value="active">活跃</option>
            <option value="pending">待处理</option>
            <option value="conflict">冲突</option>
            <option value="merged">已合并</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">用户ID</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">渠道</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">场景</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">来源</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">优先级</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">状态</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">创建时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {preferences.map((pref) => (
              <tr key={pref.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-800">{pref.user_id}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    {pref.channel.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600 text-sm">{pref.business_scene}</td>
                <td className="px-6 py-4 text-gray-600 text-sm">{pref.source}</td>
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-gray-800">{pref.source_priority}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium status-${pref.status}`}>
                    {pref.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500 text-sm">
                  {new Date(pref.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {preferences.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-gray-800 mb-6">新增偏好配置</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户ID</label>
                <input
                  type="text"
                  value={newPreference.user_id}
                  onChange={(e) => setNewPreference({ ...newPreference, user_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入用户ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">通知渠道</label>
                <select
                  value={newPreference.channel}
                  onChange={(e) => setNewPreference({ ...newPreference, channel: e.target.value as ChannelType })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {channels.map((c) => (
                    <option key={c} value={c}>{c.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">业务场景</label>
                <select
                  value={newPreference.business_scene}
                  onChange={(e) => setNewPreference({ ...newPreference, business_scene: e.target.value as BusinessScene })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {scenes.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">来源</label>
                <select
                  value={newPreference.source}
                  onChange={(e) => setNewPreference({ ...newPreference, source: e.target.value as SourceType })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {sources.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={newPreference.enabled}
                  onChange={(e) => setNewPreference({ ...newPreference, enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
                  启用通知
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
