import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { LEVEL_CONFIGS, ANOMALY_DESCRIPTIONS } from '@/utils/constants'
import { formatTimestamp, buildExportMetadata, downloadFile } from '@/utils/helpers'
import type { DirtyDataMark, StudentData } from '@/types'
import { ArrowLeft, Download, Users, AlertTriangle, CheckCircle, BarChart3, TrendingUp } from 'lucide-react'

export default function Report() {
  const navigate = useNavigate()
  const [selectedTab, setSelectedTab] = useState<'overview' | 'anomalies'>('overview')

  const currentUser = useGameStore(s => s.currentUser)
  const allStudents = useGameStore(s => s.allStudents)
  const dirtyDataMarks = useGameStore(s => s.dirtyDataMarks)
  const confirmDirtyData = useGameStore(s => s.confirmDirtyData)
  const logout = useGameStore(s => s.logout)

  const activeStudents = allStudents.filter(s => s.records.length > 0)
  const totalRecords = allStudents.flatMap(s => s.records)
  const passedRecords = totalRecords.filter(r => r.passed)
  const totalAnomalies = dirtyDataMarks.length
  const confirmedAnomalies = dirtyDataMarks.filter(m => m.manuallyConfirmed).length

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleExport = () => {
    const metadata = buildExportMetadata('全班课堂报告 - 包含所有学生记录与脏数据标记')

    const studentsSummary = allStudents.map((s: StudentData) => ({
      name: s.name,
      recordCount: s.records.length,
      passedCount: s.records.filter(r => r.passed).length,
      totalStars: s.records.filter(r => r.passed).reduce((sum, r) => sum + r.stars, 0),
      avgStars: s.records.filter(r => r.passed).length > 0
        ? s.records.filter(r => r.passed).reduce((sum, r) => sum + r.stars, 0) / s.records.filter(r => r.passed).length
        : 0,
      createdAt: new Date(s.createdAt).toISOString(),
    }))

    const anomaliesSummary = dirtyDataMarks.map((m: DirtyDataMark) => ({
      id: m.id,
      snapshotId: m.snapshotId,
      anomalyType: m.anomalyType,
      description: m.description,
      manuallyConfirmed: m.manuallyConfirmed,
      markedAt: new Date(m.markedAt).toISOString(),
      confirmedAt: m.confirmedAt ? new Date(m.confirmedAt).toISOString() : null,
      historyTrail: m.historyTrail,
    }))

    const levelStats = LEVEL_CONFIGS.map(level => {
      const levelRecords = totalRecords.filter(r => r.levelId === level.id)
      return {
        levelId: level.id,
        levelName: level.name,
        totalAttempts: levelRecords.length,
        passedCount: levelRecords.filter(r => r.passed).length,
        passRate: levelRecords.length > 0 ? levelRecords.filter(r => r.passed).length / levelRecords.length : 0,
        avgStars: levelRecords.filter(r => r.passed).length > 0
          ? levelRecords.filter(r => r.passed).reduce((sum, r) => sum + r.stars, 0) / levelRecords.filter(r => r.passed).length
          : 0,
      }
    })

    const content = JSON.stringify({
      _meta: metadata,
      summary: {
        studentCount: allStudents.length,
        activeStudents: activeStudents.length,
        totalRecords: totalRecords.length,
        passedRecords: passedRecords.length,
        totalAnomalies,
        confirmedAnomalies,
      },
      students: studentsSummary,
      levelStats,
      anomalies: anomaliesSummary,
    }, null, 2)

    downloadFile(content, `课堂报告_${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-grid noise-overlay" style={{ background: 'var(--bg-deep)' }}>
      <div className="relative z-10 min-h-screen px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <header className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition hover:scale-105"
                style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
              >
                <ArrowLeft className="w-4 h-4" />
                退出
              </button>
              <div>
                <h1 className="font-display text-2xl font-bold glow-text" style={{ color: 'var(--accent-cyan)' }}>
                  课堂报告
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  教师：{currentUser?.name}
                </p>
              </div>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-5 py-2 rounded-lg font-bold transition hover:scale-105"
              style={{ background: 'var(--accent-cyan)', color: 'var(--bg-deep)' }}
            >
              <Download className="w-4 h-4" />
              导出报告
            </button>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="glow-border rounded-2xl p-5 text-center" style={{ background: 'var(--bg-card)' }}>
              <Users className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--accent-cyan)' }} />
              <div className="font-display text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {activeStudents.length}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>活跃学生</div>
            </div>
            <div className="glow-border rounded-2xl p-5 text-center" style={{ background: 'var(--bg-card)' }}>
              <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--success-green)' }} />
              <div className="font-display text-3xl font-bold" style={{ color: 'var(--success-green)' }}>
                {passedRecords.length}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>通关次数</div>
            </div>
            <div className="glow-border rounded-2xl p-5 text-center" style={{ background: 'var(--bg-card)' }}>
              <AlertTriangle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--error-red)' }} />
              <div className="font-display text-3xl font-bold" style={{ color: 'var(--error-red)' }}>
                {totalAnomalies}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>脏数据标记</div>
            </div>
            <div className="glow-border rounded-2xl p-5 text-center" style={{ background: 'var(--bg-card)' }}>
              <TrendingUp className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--accent-purple)' }} />
              <div className="font-display text-3xl font-bold" style={{ color: 'var(--accent-purple)' }}>
                {totalRecords.length > 0 ? ((passedRecords.length / totalRecords.length) * 100).toFixed(0) : 0}%
              </div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>总通过率</div>
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setSelectedTab('overview')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition ${
                selectedTab === 'overview' ? '' : 'opacity-60'
              }`}
              style={{
                background: selectedTab === 'overview' ? 'var(--accent-cyan)' : 'var(--bg-card)',
                color: selectedTab === 'overview' ? 'var(--bg-deep)' : 'var(--text-secondary)',
              }}
            >
              <BarChart3 className="w-4 h-4" />
              学生概览
            </button>
            <button
              onClick={() => setSelectedTab('anomalies')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition ${
                selectedTab === 'anomalies' ? '' : 'opacity-60'
              }`}
              style={{
                background: selectedTab === 'anomalies' ? 'var(--error-red)' : 'var(--bg-card)',
                color: selectedTab === 'anomalies' ? 'var(--bg-deep)' : 'var(--text-secondary)',
              }}
            >
              <AlertTriangle className="w-4 h-4" />
              脏数据标记
              {totalAnomalies > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'var(--bg-deep)' }}>
                  {totalAnomalies - confirmedAnomalies}
                </span>
              )}
            </button>
          </div>

          {selectedTab === 'overview' ? (
            <div className="space-y-4">
              {LEVEL_CONFIGS.map(level => {
                const levelRecords = totalRecords.filter(r => r.levelId === level.id)
                const passed = levelRecords.filter(r => r.passed)
                const passRate = levelRecords.length > 0
                  ? ((passed.length / levelRecords.length) * 100).toFixed(0)
                  : 0

                return (
                  <div key={level.id} className="glow-border rounded-2xl p-6" style={{ background: 'var(--bg-card)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-display font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                          {level.name}
                        </h3>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          {level.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-2xl font-bold" style={{ color: 'var(--accent-cyan)' }}>
                          {passRate}%
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>通过率</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {activeStudents
                        .map(s => ({
                          student: s,
                          record: s.records.find(r => r.levelId === level.id && r.passed),
                        }))
                        .map(({ student, record }) => (
                          <div
                            key={student.name}
                            className="flex items-center justify-between p-3 rounded-lg"
                            style={{ background: 'var(--bg-deep)' }}
                          >
                            <span style={{ color: 'var(--text-primary)' }}>{student.name}</span>
                            <div className="flex items-center gap-3">
                              {record ? (
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3].map(n => (
                                    <span
                                      key={n}
                                      className="w-3 h-3"
                                      style={{
                                        background: n <= record.stars ? 'var(--warning-amber)' : 'var(--text-muted)',
                                        borderRadius: '50%',
                                        opacity: n <= record.stars ? 1 : 0.3,
                                      }}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>未通过</span>
                              )}
                              <CheckCircle
                                className="w-4 h-4"
                                style={{ color: record ? 'var(--success-green)' : 'var(--text-muted)', opacity: record ? 1 : 0.3 }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {dirtyDataMarks.length === 0 ? (
                <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                  <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--success-green)' }} />
                  <p>暂无脏数据标记，所有操作都很规范！</p>
                </div>
              ) : (
                [...dirtyDataMarks]
                  .sort((a, b) => b.markedAt - a.markedAt)
                  .map((mark, idx) => (
                    <div
                      key={mark.id}
                      className="glow-border rounded-2xl p-6 animate-fade-in-up"
                      style={{
                        background: 'var(--bg-card)',
                        borderColor: mark.manuallyConfirmed ? 'var(--success-green)' : 'var(--error-red)',
                        animationDelay: `${idx * 0.1}s`,
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle
                            className="w-5 h-5"
                            style={{ color: mark.manuallyConfirmed ? 'var(--success-green)' : 'var(--error-red)' }}
                          />
                          <span
                            className="px-3 py-1 rounded-full text-xs font-medium"
                            style={{
                              background: mark.manuallyConfirmed
                                ? 'rgba(105,240,174,0.15)'
                                : 'rgba(255,82,82,0.15)',
                              color: mark.manuallyConfirmed ? 'var(--success-green)' : 'var(--error-red)',
                            }}
                          >
                            {mark.manuallyConfirmed ? '已确认' : '待确认'}
                          </span>
                        </div>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {formatTimestamp(mark.markedAt)}
                        </span>
                      </div>

                      <div className="mb-3">
                        <h4 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                          {ANOMALY_DESCRIPTIONS[mark.anomalyType] || mark.description}
                        </h4>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {mark.description}
                        </p>
                      </div>

                      <div className="p-3 rounded-lg mb-4" style={{ background: 'var(--bg-deep)' }}>
                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>历史痕迹：</p>
                        <div className="space-y-1">
                          {mark.historyTrail.map((trail, i) => (
                            <div key={i} className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                              • {trail}
                            </div>
                          ))}
                        </div>
                      </div>

                      {!mark.manuallyConfirmed && (
                        <button
                          onClick={() => confirmDirtyData(mark.id)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition hover:scale-105"
                          style={{ background: 'var(--success-green)', color: 'var(--bg-deep)' }}
                        >
                          <CheckCircle className="w-4 h-4" />
                          人工确认此标记
                        </button>
                      )}
                    </div>
                  ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
