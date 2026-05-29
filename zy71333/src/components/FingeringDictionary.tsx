import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Fingering, FingeringHand } from '../types'

export const FingeringDictionary: React.FC = () => {
  const { state, dispatch } = useApp()
  const [editingFingering, setEditingFingering] = useState<Fingering | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [filterHand, setFilterHand] = useState<FingeringHand | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    aliases: '',
    hand: 'right' as FingeringHand,
    description: '',
    standardAction: '',
    commonMistakes: ''
  })

  const filteredFingerings = state.fingerings.filter(f => {
    const matchesHand = filterHand === 'all' || f.hand === filterHand
    const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.aliases.some(a => a.toLowerCase().includes(searchTerm.toLowerCase())) ||
      f.description.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesHand && matchesSearch
  })

  const duplicateNames = new Map<string, number>()
  state.fingerings.forEach(f => {
    const key = f.name.toLowerCase()
    duplicateNames.set(key, (duplicateNames.get(key) || 0) + 1)
    f.aliases.forEach(a => {
      const aliasKey = a.toLowerCase()
      duplicateNames.set(aliasKey, (duplicateNames.get(aliasKey) || 0) + 1)
    })
  })

  const hasDuplicate = (f: Fingering) => {
    return (duplicateNames.get(f.name.toLowerCase()) || 0) > 1 ||
      f.aliases.some(a => (duplicateNames.get(a.toLowerCase()) || 0) > 1)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const aliasesArray = formData.aliases.split(/[,，]/).map(a => a.trim()).filter(Boolean)
    const mistakesArray = formData.commonMistakes.split(/[,，]/).map(m => m.trim()).filter(Boolean)

    if (editingFingering) {
      dispatch({
        type: 'UPDATE_FINGERING',
        payload: {
          ...editingFingering,
          ...formData,
          aliases: aliasesArray,
          commonMistakes: mistakesArray
        }
      })
    } else {
      dispatch({
        type: 'ADD_FINGERING',
        payload: {
          ...formData,
          aliases: aliasesArray,
          commonMistakes: mistakesArray
        }
      })
    }

    resetForm()
  }

  const resetForm = () => {
    setFormData({
      name: '',
      aliases: '',
      hand: 'right',
      description: '',
      standardAction: '',
      commonMistakes: ''
    })
    setEditingFingering(null)
    setShowForm(false)
  }

  const handleEdit = (fingering: Fingering) => {
    setEditingFingering(fingering)
    setFormData({
      name: fingering.name,
      aliases: fingering.aliases.join(', '),
      hand: fingering.hand,
      description: fingering.description,
      standardAction: fingering.standardAction,
      commonMistakes: fingering.commonMistakes.join(', ')
    })
    setShowForm(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个指法吗？')) {
      dispatch({ type: 'DELETE_FINGERING', payload: id })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">指法字典</h2>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            className="input"
            placeholder="搜索指法名称、别名或描述..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'right', 'left'] as const).map(h => (
            <button
              key={h}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            filterHand === h
              ? 'bg-guqin-600 text-white'
              : 'bg-guqin-100 text-guqin-700 hover:bg-guqin-200'
          }`}
              onClick={() => setFilterHand(h)}
            >
              {h === 'all' ? '全部' : h === 'right' ? '右手' : '左手'}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + 新增指法
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h3 className="font-semibold mb-4">
            {editingFingering ? '编辑指法' : '新增指法'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">指法名称 *</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：勾、挑、抹、剔"
                />
              </div>
              <div>
                <label className="label">别名（用逗号分隔）</label>
                <input
                  type="text"
                  className="input"
                  value={formData.aliases}
                  onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                  placeholder="如：中指出, 勾弦"
                />
              </div>
              <div>
                <label className="label">用手</label>
                <select
                  className="input"
                  value={formData.hand}
                  onChange={(e) => setFormData({ ...formData, hand: e.target.value as FingeringHand })}
                >
                  <option value="right">右手</option>
                  <option value="left">左手</option>
                </select>
              </div>
              <div>
                <label className="label">常见错误（用逗号分隔）</label>
                <input
                  type="text"
                  className="input"
                  value={formData.commonMistakes}
                  onChange={(e) => setFormData({ ...formData, commonMistakes: e.target.value })}
                  placeholder="如：力度过大, 触弦位置不对"
                />
              </div>
            </div>
            <div>
              <label className="label">指法描述</label>
              <input
                type="text"
                className="input"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="简要描述这个指法"
              />
            </div>
            <div>
              <label className="label">标准动作要领</label>
              <textarea
                className="input"
                rows={3}
                value={formData.standardAction}
                onChange={(e) => setFormData({ ...formData, standardAction: e.target.value })}
                placeholder="详细描述标准动作要领"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                {editingFingering ? '保存修改' : '添加指法'}
              </button>
              <button type="button" className="btn-secondary" onClick={resetForm}>
                取消
              </button>
            </div>
          </form>
        </div>
        )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFingerings.map(fingering => (
          <div
            key={fingering.id}
            className={`card relative ${hasDuplicate(fingering) ? 'ring-2 ring-red-400' : ''}`}
          >
            {hasDuplicate(fingering) && (
              <div className="absolute -top-2 -right-2">
                <span className="badge badge-critical">名称冲突</span>
              </div>
            )}
            <div className="flex items-start justify-between mb-2">
              <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-lg">{fingering.name}</h4>
                <span className={`badge ${fingering.hand === 'right' ? 'badge-info' : 'badge-warning'}`}>
                  {fingering.hand === 'right' ? '右手' : '左手'}
                </span>
              </div>
              {fingering.aliases.length > 0 && (
                <p className="text-sm text-gray-500">
                  别名: {fingering.aliases.join(', ')}
                </p>
              )}
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-3">{fingering.description}</p>
            
            <div className="mb-3">
              <h5 className="text-xs font-semibold text-gray-500 mb-1">标准动作</h5>
              <p className="text-sm">{fingering.standardAction}</p>
            </div>
            
            {fingering.commonMistakes.length > 0 && (
              <div className="mb-3">
                <h5 className="text-xs font-semibold text-gray-500 mb-1">常见错误</h5>
                <div className="flex flex-wrap gap-1">
                  {fingering.commonMistakes.map((mistake, idx) => (
                    <span key={idx} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">
                      {mistake}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-gray-400 mb-3">
              <p>ID: {fingering.id}</p>
              <p>创建: {fingering.createdAt}</p>
            </div>

            <div className="flex gap-2">
              <button
                className="btn-secondary text-sm flex-1"
                onClick={() => handleEdit(fingering)}
              >
                编辑
              </button>
              <button
                className="btn-danger text-sm"
                onClick={() => handleDelete(fingering.id)}
              >
                删除
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredFingerings.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          没有找到匹配的指法
        </div>
      )}
    </div>
  )
}
