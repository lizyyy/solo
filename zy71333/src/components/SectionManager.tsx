import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { Section } from '../types'
import { hashSection } from '../utils/helpers'

export const SectionManager: React.FC = () => {
  const { state, dispatch } = useApp()
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selectedScore, setSelectedScore] = useState<string | 'all'>('all')
  const [formData, setFormData] = useState({
    scoreId: '',
    scoreName: '',
    sectionNumber: 1,
    sectionName: '',
    content: '',
    fingeringIds: ''
  })

  const scores = useMemo(() => {
    const map = new Map<string, string>()
    state.sections.forEach(s => {
      map.set(s.scoreId, s.scoreName)
    })
    return Array.from(map.entries())
  }, [state.sections])

  const filteredSections = selectedScore === 'all'
    ? state.sections
    : state.sections.filter(s => s.scoreId === selectedScore)

  const sectionsByScore = useMemo(() => {
    const groups = new Map<string, Section[]>()
    filteredSections.forEach(s => {
      if (!groups.has(s.scoreId)) {
        groups.set(s.scoreId, [])
      }
      groups.get(s.scoreId)!.push(s)
    })
    return groups
  }, [filteredSections])

  const checkSectionIssues = (sections: Section[]) => {
    const issues: { type: string; message: string; section?: Section }[] = []
    
    const sorted = [...sections].sort((a, b) => a.sectionNumber - b.sectionNumber)
    
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].sectionNumber !== i + 1) {
        issues.push({
          type: 'gap',
          message: `段落序号不连续：期望第${i + 1}，实际为第${sorted[i].sectionNumber}`,
          section: sorted[i]
        })
      }
    }

    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1].previousHash && sorted[i].previousHash) {
        const currentHash = hashSection(sorted[i])
        if (sorted[i + 1].previousHash !== currentHash) {
          issues.push({
            type: 'hash',
            message: `版本链断裂：第${sorted[i].sectionNumber}与第${sorted[i + 1].sectionNumber}版本不匹配`,
            section: sorted[i + 1]
          })
        }
      }
    }

    const invalidIds = sections.flatMap(s => 
      s.fingeringSequence
        .filter(id => !state.fingerings.some(f => f.id === id))
        .map(id => ({ section: s, invalidId: id }))
    )
    invalidIds.forEach(({ section, invalidId }) => {
      issues.push({
        type: 'missing',
        message: `引用无效指法ID: ${invalidId}`,
        section
      })
    })

    return issues
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const fingeringIdsArray = formData.fingeringIds
      .split(/[,，]/)
      .map(id => id.trim())
      .filter(Boolean)

    if (editingSection) {
      dispatch({
        type: 'UPDATE_SECTION',
        payload: {
          ...editingSection,
          ...formData,
          fingeringSequence: fingeringIdsArray
        }
      })
    } else {
      dispatch({
        type: 'ADD_SECTION',
        payload: {
          ...formData,
          fingeringSequence: fingeringIdsArray,
          version: 1
        }
      })
    }

    resetForm()
  }

  const resetForm = () => {
    setFormData({
      scoreId: '',
      scoreName: '',
      sectionNumber: 1,
      sectionName: '',
      content: '',
      fingeringIds: ''
    })
    setEditingSection(null)
    setShowForm(false)
  }

  const handleEdit = (section: Section) => {
    setEditingSection(section)
    setFormData({
      scoreId: section.scoreId,
      scoreName: section.scoreName,
      sectionNumber: section.sectionNumber,
      sectionName: section.sectionName,
      content: section.content,
      fingeringIds: section.fingeringSequence.join(', ')
    })
    setShowForm(true)
  }

  const getFingeringName = (id: string) => {
    const f = state.fingerings.find(f => f.id === id)
    return f ? f.name : `[无效: ${id}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">曲谱段落管理</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">筛选曲谱：</span>
          <select
            className="input"
            style={{ width: 'auto' }}
            value={selectedScore}
            onChange={(e) => setSelectedScore(e.target.value)}
          >
            <option value="all">全部</option>
            {scores.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + 新增段落
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h3 className="font-semibold mb-4">
            {editingSection ? '编辑段落' : '新增段落'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">曲谱ID *</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={formData.scoreId}
                  onChange={(e) => setFormData({ ...formData, scoreId: e.target.value })}
                  placeholder="如：score-liushui"
                />
              </div>
              <div>
                <label className="label">曲谱名称 *</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={formData.scoreName}
                  onChange={(e) => setFormData({ ...formData, scoreName: e.target.value })}
                  placeholder="如：流水"
                />
              </div>
              <div>
                <label className="label">段落序号 *</label>
                <input
                  type="number"
                  className="input"
                  required
                  min="1"
                  value={formData.sectionNumber}
                  onChange={(e) => setFormData({ ...formData, sectionNumber: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">段落名称 *</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={formData.sectionName}
                  onChange={(e) => setFormData({ ...formData, sectionName: e.target.value })}
                  placeholder="如：引子"
                />
              </div>
            </div>
            <div>
              <label className="label">段落内容描述</label>
              <textarea
                className="input"
                rows={2}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="描述段落内容或意境"
              />
            </div>
            <div>
              <label className="label">指法序列（指法ID，用逗号分隔）*</label>
              <input
                type="text"
                className="input font-mono text-sm"
                required
                value={formData.fingeringIds}
                onChange={(e) => setFormData({ ...formData, fingeringIds: e.target.value })}
                placeholder="如：f-tuo-001, f-mo-001, f-gou-001"
              />
              <p className="text-xs text-gray-500 mt-1">
                可用指法: {state.fingerings.map(f => `${f.name}(${f.id})`).join(', ')}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                {editingSection ? '保存修改' : '添加段落'}
              </button>
              <button type="button" className="btn-secondary" onClick={resetForm}>
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-6">
        {Array.from(sectionsByScore.entries()).map(([scoreId, sections]) => {
          const scoreName = sections[0].scoreName
          const issues = checkSectionIssues(sections)
          
          return (
            <div key={scoreId} className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">{scoreName}</h3>
                {issues.length > 0 && (
                  <span className="badge badge-warning">{issues.length} 个问题</span>
                )}
              </div>
              
              {issues.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                <h4 className="font-medium text-sm text-yellow-800 mb-2">检测到以下问题：</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {issues.map((issue, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span>⚠️</span>
                      <span>
                        {issue.section && <strong>[{issue.section.sectionName}]</strong>} {issue.message}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2">序号</th>
                      <th className="text-left py-2 px-2">段落名称</th>
                      <th className="text-left py-2 px-2">内容</th>
                      <th className="text-left py-2 px-2">指法序列</th>
                      <th className="text-left py-2 px-2">版本</th>
                      <th className="text-left py-2 px-2">版本哈希</th>
                      <th className="text-left py-2 px-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...sections].sort((a, b) => a.sectionNumber - b.sectionNumber).map(section => {
                      const hasIssue = issues.some(i => i.section?.id === section.id)
                      return (
                        <tr key={section.id} className={`border-b border-gray-100 ${hasIssue ? 'bg-yellow-50' : ''}`}>
                          <td className="py-2 px-2 font-medium">{section.sectionNumber}</td>
                          <td className="py-2 px-2">{section.sectionName}</td>
                          <td className="py-2 px-2 max-w-[200px] truncate" title={section.content}>
                            {section.content}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex flex-wrap gap-1">
                              {section.fingeringSequence.map((id, idx) => (
                                <span
                                  key={idx}
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    state.fingerings.some(f => f.id === id)
                                      ? 'bg-guqin-100 text-guqin-800'
                                      : 'bg-red-100 text-red-800'
                                  }
                                >
                                  {getFingeringName(id)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 px-2">v{section.version}</td>
                          <td className="py-2 px-2">
                            {section.previousHash ? (
                              <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                                {section.previousHash.substring(0, 8)}...
                              </code>
                            ) : (
                              <span className="text-gray-400 text-xs">无</span>
                            )}
                          </td>
                          <td className="py-2 px-2">
                            <button
                              className="text-guqin-600 hover:text-guqin-800 text-sm"
                              onClick={() => handleEdit(section)}
                            >
                              编辑
                            </button>
                          </td>
                        </tr>
                      )})}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
