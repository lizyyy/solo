import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  FileJson,
  Printer,
  Shield,
  Clock,
} from 'lucide-react'
import { useChallengeStore } from '@/store/challengeStore'
import { exportAsText, formatElapsed, computeTotalScore } from '@/engine/challenge'

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  'level-config': { label: '关卡配置', color: 'var(--accent-cyan)' },
  'player-action': { label: '学员操作', color: 'var(--accent-amber)' },
  'system-auto': { label: '系统自动', color: 'var(--accent-green)' },
  'teacher-remark': { label: '教师备注', color: '#a855f7' },
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Review() {
  const { challengeId } = useParams<{ challengeId: string }>()
  const { instance, records, deductions, audits, level, loadChallenge } =
    useChallengeStore()
  const [replayIndex, setReplayIndex] = useState(0)

  useEffect(() => {
    if (challengeId && !instance) {
      loadChallenge(challengeId)
    }
  }, [challengeId, instance, loadChallenge])

  const exportedText = useMemo(() => {
    if (!level || !instance) return ''
    return exportAsText(level, records, deductions, audits, instance)
  }, [level, instance, records, deductions, audits])

  const totalScore = useMemo(() => computeTotalScore(records), [records])

  if (!instance || !level) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ color: 'var(--text-muted)' }}>
        <div className="text-center animate-slide-up">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg">未找到挑战记录</p>
          <Link to="/" className="btn-cyan mt-4 inline-block">返回首页</Link>
        </div>
      </div>
    )
  }

  const currentRecord = records[replayIndex]
  const currentParam = level.parameters.find(
    (p) => p.roundNumber === (currentRecord?.roundNumber ?? 1)
  )
  const currentChoiceLabel = currentRecord?.playerChoice
    ? level.options[currentRecord.roundNumber]?.find((o) => o.startsWith(currentRecord.playerChoice!)) ?? currentRecord.playerChoice
    : '（未选择）'
  const currentCorrectLabel = currentRecord
    ? level.options[currentRecord.roundNumber]?.find((o) => o.startsWith(currentRecord.correctAnswer)) ?? currentRecord.correctAnswer
    : ''
  const isChoiceCorrect = currentRecord?.playerChoice
    ? currentRecord.playerChoice.charAt(0) === currentRecord.correctAnswer
    : false

  const handleExportText = () => {
    downloadBlob(exportedText, `challenge-${instance.id}.txt`, 'text/plain')
  }

  const handleExportJson = () => {
    const payload = JSON.stringify({ instance, records, deductions, audits }, null, 2)
    downloadBlob(payload, `challenge-${instance.id}.json`, 'application/json')
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 animate-slide-up">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--accent-cyan)' }}>
            电磁炮校准挑战 — 回顾
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {level.name} · 综合得分 <span className="font-mono-display text-glow-cyan">{totalScore}</span> · 用时 {formatElapsed(instance.elapsedSeconds)}
          </p>
        </div>
        <Link to="/" className="btn-cyan text-sm">返回首页</Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left - Replay */}
        <section className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--accent-cyan)' }}>
            <Play className="w-4 h-4" /> 回放播放器
          </h2>

          <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-4 scrollbar-thin">
            {records.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setReplayIndex(i)}
                className="flex-shrink-0 w-8 h-8 rounded-full border text-xs font-mono-display flex items-center justify-center transition-all"
                style={{
                  borderColor: i === replayIndex ? 'var(--accent-cyan)' : 'var(--border-dim)',
                  color: i === replayIndex ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  boxShadow: i === replayIndex ? '0 0 12px rgba(0,229,255,0.35)' : 'none',
                  background: i === replayIndex ? 'rgba(0,229,255,0.08)' : 'transparent',
                }}
              >
                {r.roundNumber}
              </button>
            ))}
          </div>

          {currentRecord && (
            <div className="animate-fade-in space-y-3">
              <div className="p-3 rounded" style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid var(--border-dim)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>回合参数</p>
                {currentParam && (
                  <p className="font-mono-display text-xs" style={{ color: 'var(--text-secondary)' }}>
                    频率 {currentParam.frequency}GHz · 功率 {currentParam.power}kW · 角度 {currentParam.angle}° · 温度 {currentParam.temperature}℃
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded" style={{ background: currentRecord?.playerChoice === null ? 'rgba(255,171,0,0.06)' : isChoiceCorrect ? 'rgba(76,175,80,0.06)' : 'rgba(239,83,80,0.06)', border: '1px solid var(--border-dim)' }}>
                  <p className="text-xs mb-1" style={{ color: currentRecord?.playerChoice === null ? 'var(--accent-amber)' : isChoiceCorrect ? 'var(--accent-green)' : 'var(--accent-red)' }}>学员选择</p>
                  <p className="font-mono-display text-sm" style={{ color: 'var(--text-primary)' }}>
                    {currentChoiceLabel}
                  </p>
                </div>
                <div className="p-3 rounded" style={{ background: 'rgba(76,175,80,0.06)', border: '1px solid var(--border-dim)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--accent-green)' }}>正确答案</p>
                  <p className="font-mono-display text-sm" style={{ color: 'var(--text-primary)' }}>
                    {currentCorrectLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  得分：<span className="font-mono-display text-glow-cyan">{currentRecord.score}</span>
                </span>
                {currentRecord.source === 'timeout' && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(239,83,80,0.15)', color: 'var(--accent-red)' }}>超时</span>
                )}
                {currentRecord.isDuplicate && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,171,0,0.15)', color: 'var(--accent-amber)' }}>重复选择</span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <button
              className="btn-cyan flex items-center gap-1 text-sm disabled:opacity-30"
              onClick={() => setReplayIndex(Math.max(0, replayIndex - 1))}
              disabled={replayIndex === 0}
            >
              <ChevronLeft className="w-4 h-4" /> 上一回合
            </button>
            <span className="font-mono-display text-xs" style={{ color: 'var(--text-muted)' }}>
              {replayIndex + 1} / {records.length}
            </span>
            <button
              className="btn-cyan flex items-center gap-1 text-sm disabled:opacity-30"
              onClick={() => setReplayIndex(Math.min(records.length - 1, replayIndex + 1))}
              disabled={replayIndex >= records.length - 1}
            >
              下一回合 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Center - Export */}
        <section className="card p-4 flex flex-col">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--accent-cyan)' }}>
            <Download className="w-4 h-4" /> 成绩导出
          </h2>

          <pre
            className="flex-1 p-3 rounded text-xs font-mono-display overflow-auto scrollbar-thin mb-4 whitespace-pre-wrap"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-dim)',
              color: 'var(--text-secondary)',
              minHeight: '200px',
            }}
          >
            {exportedText}
          </pre>

          <div className="flex flex-wrap gap-2">
            <button className="btn-cyan flex items-center gap-1.5 text-sm" onClick={handleExportText}>
              <FileText className="w-4 h-4" /> 导出文本
            </button>
            <button className="btn-amber flex items-center gap-1.5 text-sm" onClick={handleExportJson}>
              <FileJson className="w-4 h-4" /> 导出 JSON
            </button>
            <button className="btn-cyan flex items-center gap-1.5 text-sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4" /> 打印
            </button>
          </div>
        </section>

        {/* Right - Audit */}
        <section className="card p-4 flex flex-col">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--accent-cyan)' }}>
            <Shield className="w-4 h-4" /> 审计追踪
          </h2>

          <div className="flex-1 overflow-y-auto scrollbar-thin space-y-0">
            {audits.map((audit, i) => {
              const badge = SOURCE_BADGE[audit.source] ?? { label: audit.source, color: 'var(--text-muted)' }
              return (
                <div
                  key={audit.id}
                  className="flex gap-3 py-2.5 animate-slide-up"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                      style={{ background: badge.color, boxShadow: `0 0 6px ${badge.color}` }}
                    />
                    {i < audits.length - 1 && (
                      <div className="w-px flex-1 mt-1" style={{ background: 'var(--border-dim)' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: `${badge.color}18`, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                      <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <Clock className="w-3 h-3" />
                        {new Date(audit.processedAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {audit.action}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
