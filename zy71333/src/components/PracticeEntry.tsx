import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { PracticeMistake, ErrorSeverity } from '../types'
import { generateId, formatDate, formatDateTime } from '../utils/helpers'

interface FormMistake {
  tempId: string
  fingeringId: string
  position: number
  errorCauseId: string
  severity: ErrorSeverity
  note: string
}

export const PracticeEntry: React.FC = () => {
  const { state, dispatch } = useApp()
  const [selectedSectionId, setSelectedSectionId] = useState('')
  const [practiceDate, setPracticeDate] = useState(formatDate(new Date()))
  const [practiceCount, setPracticeCount] = useState(1)
  const [durationMinutes, setDurationMinutes] = useState(15)
  const [selfAssessment, setSelfAssessment] = useState('')
  const [mistakes, setMistakes] = useState<FormMistake[]>([])
  const [currentPosition, setCurrentPosition] = useState(1)
  const [currentFingeringId, setCurrentFingeringId] = useState('')
  const [currentErrorCauseId, setCurrentErrorCauseId] = useState('')
  const [currentSeverity, setCurrentSeverity] = useState<ErrorSeverity>('warning')
  const [currentNote, setCurrentNote] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)

  const students = useMemo(() => {
    const map = new Map<string, string>()
    state.practiceRecords.forEach(p => {
      map.set(p.studentId, p.studentName)
    })
    return Array.from(map.entries())
  }, [state.practiceRecords])

  const selectedSection = state.sections.find(s => s.id === selectedSectionId)

  const getFingeringName = (id: string) => {
    const f = state.fingerings.find(f => f.id === id)
    return f ? f.name : id
  }

  const getErrorCauseName = (id: string) => {
    const ec = state.errorCauses.find(ec => ec.id === id)
    return ec ? ec.name : id
  }

  const addMistake = () => {
    if (!currentFingeringId || !currentErrorCauseId) return
    
    const newMistake: FormMistake = {
      tempId: generateId(),
      fingeringId: currentFingeringId,
      position: currentPosition,
      errorCauseId: currentErrorCauseId,
      severity: currentSeverity,
      note: currentNote
    }

    setMistakes([...mistakes, newMistake])
    setCurrentPosition(currentPosition + 1)
    setCurrentFingeringId('')
    setCurrentErrorCauseId('')
    setCurrentNote('')
  }

  const removeMistake = (tempId: string) => {
    setMistakes(mistakes.filter(m => m.tempId !== tempId))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedSectionId) {
      alert('请选择练习段落')
      return
    }

    const section = state.sections.find(s => s.id === selectedSectionId)
    if (!section) return

    const student = students.find(([id]) => id === state.currentStudent)
    const studentName = student ? student[1] : '未知学生'

    const practiceMistakes: PracticeMistake[] = mistakes.map(m => ({
      id: generateId(),
      fingeringId: m.fingeringId,
      fingeringName: getFingeringName(m.fingeringId),
      position: m.position,
      errorCauseId: m.errorCauseId,
      errorCauseName: getErrorCauseName(m.errorCauseId),
      severity: m.severity,
      note: m.note,
      timestamp: formatDateTime(new Date())
    }))

    dispatch({
      type: 'ADD_PRACTICE_RECORD',
      payload: {
        studentId: state.currentStudent,
        studentName,
        sectionId: selectedSectionId,
        sectionName: section.sectionName,
        scoreName: section.scoreName,
        practiceDate,
        practiceCount,
        durationMinutes,
        mistakes: practiceMistakes,
        selfAssessment
      }
    })

    setMistakes([])
    setCurrentPosition(1)
    setSelfAssessment('')
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }

  const severityColor = (s: ErrorSeverity) => {
    switch (s) {
      case 'critical': return 'badge-critical'
      case 'warning': return 'badge-warning'
      case 'info': return 'badge-info'
    }
  }

  const categoryLabels: Record<string, string> = {
    technique: '技巧',
    rhythm: '节奏',
    posture: '姿势',
    timbre: '音色',
    other: '其他'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">练习记录录入</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">当前学生：</span>
          <select
            className="input"
            style={{ width: 'auto' }}
            value={state.currentStudent}
            onChange={(e) => dispatch({ type: 'SET_CURRENT_STUDENT', payload: e.target.value })}
          >
            {students.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {showSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <span>✅</span>
          <span>练习记录已保存成功！</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h3 className="font-semibold mb-4">基本信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">练习日期 *</label>
              <input
                type="date"
                className="input"
                required
                value={practiceDate}
                onChange={(e) => setPracticeDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">练习段落 *</label>
              <select
                className="input"
                required
                value={selectedSectionId}
                onChange={(e) => {
                  setSelectedSectionId(e.target.value)
                  setCurrentPosition(1)
                }}
              >
                <option value="">请选择段落</option>
                {state.sections
                  .sort((a, b) => a.scoreName.localeCompare(b.scoreName) || a.sectionNumber - b.sectionNumber)
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.scoreName} - 第{s.sectionNumber}段 {s.sectionName}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label">练习次数 *</label>
              <input
                type="number"
                className="input"
                required
                min="1"
                value={practiceCount}
                onChange={(e) => setPracticeCount(parseInt(e.target.value))}
              />
            </div>
            <div>
              <label className="label">练习时长(分钟) *</label>
              <input
                type="number"
                className="input"
                required
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
              />
            </div>
          </div>

          {selectedSection && (
            <div className="mt-4 p-3 bg-guqin-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>段落内容：</strong>{selectedSection.content}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>指法序列：</strong>
                {selectedSection.fingeringSequence.map((id, idx) => (
                  <span key={idx} className="inline-block mr-1 px-2 py-0.5 bg-guqin-100 rounded text-xs">
                    {getFingeringName(id)}
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">错误记录</h3>
          
          {selectedSectionId ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                <div>
                  <label className="label">位置序号</label>
                  <input
                    type="number"
                    className="input"
                    min="1"
                    value={currentPosition}
                    onChange={(e) => setCurrentPosition(parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label">指法 *</label>
                  <select
                    className="input"
                    value={currentFingeringId}
                    onChange={(e) => setCurrentFingeringId(e.target.value)}
                  >
                    <option value="">选择指法</option>
                    {state.fingerings.map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({f.hand === 'right' ? '右' : '左'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">错误原因 *</label>
                  <select
                    className="input"
                    value={currentErrorCauseId}
                    onChange={(e) => setCurrentErrorCauseId(e.target.value)}
                  >
                    <option value="">选择错因</option>
                    {state.errorCauses.map(ec => (
                      <option key={ec.id} value={ec.id}>
                        [{categoryLabels[ec.category]}] {ec.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">严重程度</label>
                  <select
                    className="input"
                    value={currentSeverity}
                    onChange={(e) => setCurrentSeverity(e.target.value as ErrorSeverity)}
                  >
                    <option value="critical">严重</option>
                    <option value="warning">警告</option>
                    <option value="info">提示</option>
                  </select>
                </div>
                <div>
                  <label className="label">&nbsp;</label>
                  <button
                    type="button"
                    className="btn-primary w-full"
                    onClick={addMistake}
                    disabled={!currentFingeringId || !currentErrorCauseId}
                  >
                    + 添加错误
                  </button>
                </div>
              </div>
              <div className="mb-4">
                <label className="label">备注说明</label>
                <input
                  type="text"
                  className="input"
                  value={currentNote}
                  onChange={(e) => setCurrentNote(e.target.value)}
                  placeholder="详细描述这个错误的情况..."
                />
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-center py-4">请先选择练习段落</p>
          )}

          {mistakes.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">已记录的错误 ({mistakes.length})</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left py-2 px-3">位置</th>
                      <th className="text-left py-2 px-3">指法</th>
                      <th className="text-left py-2 px-3">错误原因</th>
                      <th className="text-left py-2 px-3">程度</th>
                      <th className="text-left py-2 px-3">备注</th>
                      <th className="text-left py-2 px-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mistakes.map(m => (
                      <tr key={m.tempId} className="border-b border-gray-100">
                        <td className="py-2 px-3 font-mono">#{m.position}</td>
                        <td className="py-2 px-3">{getFingeringName(m.fingeringId)}</td>
                        <td className="py-2 px-3">{getErrorCauseName(m.errorCauseId)}</td>
                        <td className="py-2 px-3">
                          <span className={`badge ${severityColor(m.severity)}`}>
                            {m.severity === 'critical' ? '严重' : m.severity === 'warning' ? '警告' : '提示'}
                          </span>
                        </td>
                        <td className="py-2 px-3 max-w-[200px] truncate">{m.note}</td>
                        <td className="py-2 px-3">
                          <button
                            type="button"
                            className="text-red-600 hover:text-red-800 text-sm"
                            onClick={() => removeMistake(m.tempId)}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">自我评估</h3>
          <textarea
            className="input"
            rows={3}
            value={selfAssessment}
            onChange={(e) => setSelfAssessment(e.target.value)}
            placeholder="描述本次练习的感受、遇到的困难、进步的地方..."
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setMistakes([])
              setSelfAssessment('')
              setCurrentPosition(1)
            }}
          >
            重置
          </button>
          <button type="submit" className="btn-primary">
            保存练习记录
          </button>
        </div>
      </form>
    </div>
  )
}
