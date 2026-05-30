import { useParams, useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { LEVEL_CONFIGS } from '@/utils/constants'
import { formatTimestamp, buildExportMetadata, downloadFile } from '@/utils/helpers'
import { ArrowLeft, Download, Star, Play, Clock, CheckCircle, XCircle } from 'lucide-react'

export default function Record() {
  const { studentName } = useParams<{ studentName: string }>()
  const navigate = useNavigate()

  const openReplay = useGameStore(s => s.openReplay)
  const getStudentRecords = useGameStore(s => s.getStudentRecords)
  const allStudents = useGameStore(s => s.allStudents)

  const records = getStudentRecords(studentName || '')
  const student = allStudents.find(s => s.name === studentName)

  const passedRecords = records.filter(r => r.passed)
  const avgStars = passedRecords.length > 0
    ? (passedRecords.reduce((sum, r) => sum + r.stars, 0) / passedRecords.length).toFixed(1)
    : '0'

  const getLevelName = (levelId: string) => {
    return LEVEL_CONFIGS.find(l => l.id === levelId)?.name || levelId
  }

  const handleExport = (format: 'json' | 'csv') => {
    const metadata = buildExportMetadata(`学生 ${studentName} 的全部游戏记录`)
    const exportData = records.map(r => ({
      id: r.id,
      levelId: r.levelId,
      levelName: getLevelName(r.levelId),
      passed: r.passed,
      stars: r.stars,
      attemptCount: r.attemptCount,
      startedAt: new Date(r.startedAt).toISOString(),
      completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
      snapshotCount: r.snapshots.length,
      feedbackCount: r.feedbacks.length,
      anomalies: r.snapshots.filter(s => s.isAnomaly).map(s => ({
        type: s.anomalyType,
        time: new Date(s.timestamp).toISOString(),
      })),
    }))

    if (format === 'json') {
      const content = JSON.stringify({ _meta: metadata, data: exportData }, null, 2)
      downloadFile(content, `${studentName}_成绩记录.json`, 'application/json')
    } else {
      const headerComment = `# 处理口径: ${metadata.processingCaliber}\n# 异常处理: ${metadata.anomalyHandling}\n# 导出时间: ${metadata.exportTime}\n`
      const headers = ['关卡ID', '关卡名称', '是否通过', '星级', '尝试次数', '开始时间', '完成时间', '操作数', '异常数']
      const rows = exportData.map(r => [
        r.levelId,
        r.levelName,
        r.passed ? '是' : '否',
        r.stars,
        r.attemptCount,
        r.startedAt,
        r.completedAt || '',
        r.snapshotCount,
        r.anomalies.length,
      ])
      const csv = headerComment + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      downloadFile(csv, `${studentName}_成绩记录.csv`, 'text/csv')
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-grid noise-overlay" style={{ background: 'var(--bg-deep)' }}>
      <div className="relative z-10 min-h-screen px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <header className="flex items-center justify-between mb-8">
            <button
              onClick={() => navigate('/levels')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition hover:scale-105"
              style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => handleExport('json')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition hover:scale-105"
                style={{ background: 'var(--accent-cyan)', color: 'var(--bg-deep)' }}
              >
                <Download className="w-4 h-4" />
                导出 JSON
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition hover:scale-105"
                style={{ background: 'var(--accent-purple)', color: 'var(--bg-deep)' }}
              >
                <Download className="w-4 h-4" />
                导出 CSV
              </button>
            </div>
          </header>

          <div className="text-center mb-10">
            <h1 className="font-display text-3xl font-bold glow-text mb-2" style={{ color: 'var(--accent-cyan)' }}>
              {studentName} 的实验记录
            </h1>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="text-center">
                <div className="font-display text-3xl font-bold" style={{ color: 'var(--success-green)' }}>
                  {passedRecords.length}/{LEVEL_CONFIGS.length}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>通关关卡</div>
              </div>
              <div className="text-center">
                <div className="font-display text-3xl font-bold" style={{ color: 'var(--warning-amber)' }}>
                  {avgStars}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>平均星级</div>
              </div>
              <div className="text-center">
                <div className="font-display text-3xl font-bold" style={{ color: 'var(--accent-purple)' }}>
                  {records.reduce((sum, r) => sum + r.snapshots.length, 0)}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>操作次数</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {records.length === 0 ? (
              <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>还没有游戏记录，快去挑战吧！</p>
              </div>
            ) : (
              [...records].sort((a, b) => b.startedAt - a.startedAt).map((record, idx) => (
                <div
                  key={record.id}
                  className="relative glow-border rounded-2xl p-6 animate-fade-in-up"
                  style={{
                    background: 'var(--bg-card)',
                    animationDelay: `${idx * 0.1}s`,
                    borderColor: record.passed ? 'var(--success-green)' : 'var(--border-glow)',
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {record.passed ? (
                          <CheckCircle className="w-5 h-5" style={{ color: 'var(--success-green)' }} />
                        ) : (
                          <XCircle className="w-5 h-5" style={{ color: 'var(--error-red)' }} />
                        )}
                        <h3 className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                          {getLevelName(record.levelId)}
                        </h3>
                      </div>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        开始于 {formatTimestamp(record.startedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3].map(n => (
                        <Star
                          key={n}
                          className="w-5 h-5"
                          style={{
                            color: n <= record.stars ? 'var(--warning-amber)' : 'var(--text-muted)',
                            fill: n <= record.stars ? 'var(--warning-amber)' : 'transparent',
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-deep)' }}>
                      <div className="font-display text-xl font-bold" style={{ color: 'var(--accent-cyan)' }}>
                        {record.attemptCount}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>尝试次数</div>
                    </div>
                    <div className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-deep)' }}>
                      <div className="font-display text-xl font-bold" style={{ color: 'var(--accent-purple)' }}>
                        {record.snapshots.length}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>操作步数</div>
                    </div>
                    <div className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-deep)' }}>
                      <div className="font-display text-xl font-bold" style={{ color: 'var(--error-red)' }}>
                        {record.snapshots.filter(s => s.isAnomaly).length}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>异常操作</div>
                    </div>
                    <div className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-deep)' }}>
                      <div className="font-display text-xl font-bold" style={{ color: 'var(--accent-pink)' }}>
                        {record.feedbacks.length}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>失败次数</div>
                    </div>
                  </div>

                  {record.snapshots.length > 0 && (
                    <button
                      onClick={() => {
                        navigate(`/play/${record.levelId}`)
                        setTimeout(() => openReplay(record.snapshots[0].id), 500)
                      }}
                      className="flex items-center gap-2 text-sm font-medium transition hover:scale-105"
                      style={{ color: 'var(--accent-cyan)' }}
                    >
                      <Play className="w-4 h-4" />
                      回放本次实验
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
