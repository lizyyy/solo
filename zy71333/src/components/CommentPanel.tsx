import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { CommentStatus } from '../types'

export const CommentPanel: React.FC = () => {
  const { state, dispatch } = useApp()
  const [selectedStudentId, setSelectedStudentId] = useState<string | 'all'>('all')
  const [selectedSectionId, setSelectedSectionId] = useState<string | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<CommentStatus | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [selectedPracticeId, setSelectedPracticeId] = useState('')
  const [commentContent, setCommentContent] = useState('')
  const [sourceMaterialRef, setSourceMaterialRef] = useState('')
  const [teacherName, setTeacherName] = useState('王老师')

  const students = useMemo(() => {
    const map = new Map<string, string>()
    state.practiceRecords.forEach(p => {
      map.set(p.studentId, p.studentName)
    })
    return Array.from(map.entries())
  }, [state.practiceRecords])

  const sections = useMemo(() => {
    const map = new Map<string, { name: string; score: string }>()
    state.sections.forEach(s => {
      map.set(s.id, { name: s.sectionName, score: s.scoreName })
    })
    return Array.from(map.entries())
  }, [state.sections])

  const filteredRecords = useMemo(() => {
    return state.practiceRecords.filter(p => {
      const matchesStudent = selectedStudentId === 'all' || p.studentId === selectedStudentId
      const matchesSection = selectedSectionId === 'all' || p.sectionId === selectedSectionId
      return matchesStudent && matchesSection
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [state.practiceRecords, selectedStudentId, selectedSectionId])

  const getCommentsForPractice = (practiceId: string) => {
    return state.comments
      .filter(c => c.practiceRecordId === practiceId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  const checkDuplicateComment = (practiceId: string) => {
    const recentComments = state.comments.filter(c => {
      if (c.practiceRecordId !== practiceId) return false
      const commentTime = new Date(c.createdAt).getTime()
      const now = Date.now()
      return now - commentTime < 24 * 60 * 60 * 1000
    })
    return recentComments.length > 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedPracticeId || !commentContent.trim()) return

    const practice = state.practiceRecords.find(p => p.id === selectedPracticeId)
    if (!practice) return

    const hasDuplicate = checkDuplicateComment(selectedPracticeId)
    if (hasDuplicate) {
      if (!confirm('该练习记录24小时内已有点评，确定要继续添加吗？')) {
        return
      }
    }

    dispatch({
      type: 'ADD_COMMENT',
      payload: {
        practiceRecordId: selectedPracticeId,
        studentId: practice.studentId,
        teacherId: 'teacher-001',
        teacherName,
        sectionId: practice.sectionId,
        content: commentContent,
        status: 'pending',
        sourceMaterialRef
      }
    })

    setCommentContent('')
    setSourceMaterialRef('')
    setShowForm(false)
    setSelectedPracticeId('')
  }

  const updateCommentStatus = (commentId: string, status: CommentStatus) => {
    dispatch({
      type: 'UPDATE_COMMENT_STATUS',
      payload: { id: commentId, status }
    })
  }

  const statusConfig: Record<CommentStatus | 'all', { label: string; color: string }> = {
    all: { label: '全部', color: 'bg-gray-100 text-gray-800' },
    pending: { label: '待处理', color: 'badge-warning' },
    reviewed: { label: '已审阅', color: 'badge-info' },
    resolved: { label: '已解决', color: 'badge-success' }
  }

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'info': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const severityLabel = (s: string) => {
    switch (s) {
      case 'critical': return '严重'
      case 'warning': return '警告'
      case 'info': return '提示'
      default: return s
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">老师点评</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '取消点评' : '+ 新增点评'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h3 className="font-semibold mb-4">新增点评</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">老师姓名</label>
                <input
                  type="text"
                  className="input"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                />
              </div>
              <div>
                <label className="label">选择练习记录 *</label>
                <select
                  className="input"
                  required
                  value={selectedPracticeId}
                  onChange={(e) => setSelectedPracticeId(e.target.value)}
                >
                  <option value="">请选择练习记录</option>
                  {filteredRecords.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.studentName} - {p.scoreName} {p.sectionName} ({p.practiceDate})
                      {checkDuplicateComment(p.id) && ' ⚠️ 24h内已有点评'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">来源材料引用</label>
              <input
                type="text"
                className="input"
                value={sourceMaterialRef}
                onChange={(e) => setSourceMaterialRef(e.target.value)}
                placeholder="如：流水-引子-第3小节"
              />
            </div>
            <div>
              <label className="label">点评内容 *</label>
              <textarea
                className="input"
                rows={4}
                required
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder="请输入点评内容..."
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">保存点评</button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowForm(false)
                  setSelectedPracticeId('')
                  setCommentContent('')
                }}
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">学生：</span>
          <select
            className="input"
            style={{ width: 'auto' }}
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
          >
            <option value="all">全部</option>
            {students.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">段落：</span>
          <select
            className="input"
            style={{ width: 'auto' }}
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
          >
            <option value="all">全部</option>
            {sections.map(([id, info]) => (
              <option key={id} value={id}>{info.score} - {info.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">状态：</span>
          {(['all', 'pending', 'reviewed', 'resolved'] as const).map(s => (
            <button
              key={s}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                statusFilter === s ? statusConfig[s].color : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => setStatusFilter(s)}
            >
              {statusConfig[s].label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredRecords.map(practice => {
          const comments = getCommentsForPractice(practice.id)
          const filteredComments = statusFilter === 'all' 
            ? comments 
            : comments.filter(c => c.status === statusFilter)
          
          if (filteredComments.length === 0) return null

          return (
            <div key={practice.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-semibold">
                    {practice.studentName} - {practice.scoreName} {practice.sectionName}
                  </h4>
                  <p className="text-sm text-gray-500">
                    练习日期: {practice.practiceDate} | 练习次数: {practice.practiceCount} | 时长: {practice.durationMinutes}分钟
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {practice.mistakes.length > 0 && (
                    <span className="badge badge-critical">
                      {practice.mistakes.length} 个错误
                    </span>
                  )}
                  {comments.length > 1 && (
                    <span className="badge badge-warning">
                      {comments.length} 条点评
                    </span>
                  )}
                </div>
              </div>

              {practice.mistakes.length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 rounded">
                  <h5 className="text-sm font-medium mb-2">本次练习错误：</h5>
                  <div className="flex flex-wrap gap-2">
                    {practice.mistakes.map(m => (
                      <span
                        key={m.id}
                        className={`text-xs px-2 py-1 rounded ${severityColor(m.severity)}`}
                      >
                        #{m.position} {m.fingeringName}: {m.errorCauseName}
                        {m.note && ` - ${m.note}`}
                      </span>
                    ))}
                  </div>
                  {practice.selfAssessment && (
                    <p className="text-sm text-gray-600 mt-2">
                      <strong>自我评估：</strong>{practice.selfAssessment}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {filteredComments.map((comment, idx) => (
                  <div
                    key={comment.id}
                    className={`p-3 rounded-lg border ${
                      idx === 0 ? 'bg-guqin-50 border-guqin-200' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`badge ${statusConfig[comment.status].color}`}>
                          {statusConfig[comment.status].label}
                        </span>
                        <span className="font-medium">{comment.teacherName}</span>
                        <span className="text-xs text-gray-500">{comment.createdAt}</span>
                        {idx === 0 && <span className="badge badge-info">最新</span>}
                        {idx > 0 && <span className="badge badge-warning">重复点评</span>}
                      </div>
                    </div>
                    <p className="text-gray-700">{comment.content}</p>
                    {comment.sourceMaterialRef && (
                      <p className="text-xs text-gray-500 mt-2">
                        📍 来源: {comment.sourceMaterialRef}
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      {comment.status === 'pending' && (
                        <>
                          <button
                            className="text-sm text-blue-600 hover:text-blue-800"
                            onClick={() => updateCommentStatus(comment.id, 'reviewed')}
                          >
                            标记为已审阅
                          </button>
                          <button
                            className="text-sm text-green-600 hover:text-green-800"
                            onClick={() => updateCommentStatus(comment.id, 'resolved')}
                          >
                            标记为已解决
                          </button>
                        </>
                      )}
                      {comment.status === 'reviewed' && (
                        <button
                          className="text-sm text-green-600 hover:text-green-800"
                          onClick={() => updateCommentStatus(comment.id, 'resolved')}
                        >
                          标记为已解决
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {filteredRecords.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          没有找到匹配的练习记录
        </div>
      )}
    </div>
  )
}
