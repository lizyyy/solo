import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Eye,
  Copy,
} from 'lucide-react'
import { useChallengeStore } from '@/store/challengeStore'
import { computeTotalScore } from '@/engine/challenge'
import type { RoundRecord, AuditEntry } from '@/types'

const SOURCE_LABELS: Record<string, string> = {
  player: '学员操作',
  timeout: '超时',
  system: '系统',
}

const AUDIT_SOURCE_LABELS: Record<string, string> = {
  'level-config': '关卡配置',
  'player-action': '学员操作',
  'system-auto': '系统自动',
  'teacher-remark': '教师备注',
}

function getChoiceLabel(record: RoundRecord, options: Record<number, string[]>) {
  if (record.playerChoice === null) return '未选择'
  const roundOptions = options[record.roundNumber]
  return roundOptions?.find((o) => o.startsWith(record.playerChoice!)) ?? record.playerChoice
}

function getChoiceColor(record: RoundRecord) {
  if (record.playerChoice === null) return 'var(--accent-amber)'
  const choiceKey = record.playerChoice.charAt(0)
  return choiceKey === record.correctAnswer
    ? 'var(--accent-green)'
    : 'var(--accent-red)'
}

function getChoiceIcon(record: RoundRecord) {
  if (record.playerChoice === null) return <Clock size={14} />
  const choiceKey = record.playerChoice.charAt(0)
  return choiceKey === record.correctAnswer
    ? <CheckCircle size={14} />
    : <XCircle size={14} />
}

export default function Settlement() {
  const { challengeId } = useParams<{ challengeId: string }>()
  const { instance, records, deductions, audits, level, loadChallenge } =
    useChallengeStore()

  useEffect(() => {
    if (challengeId && (!instance || instance.id !== challengeId)) {
      loadChallenge(challengeId)
    }
  }, [challengeId, instance, loadChallenge])

  if (!instance || !level) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="card p-8 text-center animate-fade-in">
          <AlertTriangle size={40} style={{ color: 'var(--accent-amber)' }} className="mx-auto mb-4" />
          <p style={{ color: 'var(--text-secondary)' }}>未找到挑战记录</p>
          <Link to="/" className="btn-cyan inline-block mt-4">返回首页</Link>
        </div>
      </div>
    )
  }

  const totalScore = computeTotalScore(records)
  const recordIds = new Set(records.map((r) => r.id))
  const challengeDeductions = deductions.filter((d) => recordIds.has(d.roundId))
  const totalDeduction = challengeDeductions.reduce((s, d) => s + d.points, 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FileText size={24} style={{ color: 'var(--accent-cyan)' }} />
          <h1 className="text-2xl font-bold text-glow-cyan">结算报告</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>
          {level.name} &middot; ID: {instance.id}
        </p>
        <div className="mt-4 card p-4 flex items-center gap-6">
          <div>
            <span style={{ color: 'var(--text-muted)' }} className="text-sm">综合得分</span>
            <p className="font-mono-display text-3xl font-bold" style={{ color: 'var(--accent-cyan)' }}>
              {totalScore}
            </p>
          </div>
          <div className="w-px h-10" style={{ background: 'var(--border-dim)' }} />
          <div>
            <span style={{ color: 'var(--text-muted)' }} className="text-sm">总回合</span>
            <p className="font-mono-display text-xl" style={{ color: 'var(--text-primary)' }}>
              {records.length}
            </p>
          </div>
          <div className="w-px h-10" style={{ background: 'var(--border-dim)' }} />
          <div>
            <span style={{ color: 'var(--text-muted)' }} className="text-sm">总扣分</span>
            <p className="font-mono-display text-xl" style={{ color: 'var(--accent-red)' }}>
              -{totalDeduction}
            </p>
          </div>
        </div>
      </header>

      <section className="mb-8 animate-slide-up">
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Eye size={18} style={{ color: 'var(--accent-cyan)' }} />
          选择回顾
        </h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-dim)' }}>
                {['回合', '学员选择', '正确答案', '得分', '来源', ''].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                  <td className="px-3 py-2 font-mono-display" style={{ color: 'var(--text-secondary)' }}>
                    R{r.roundNumber}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1" style={{ color: getChoiceColor(r) }}>
                      {getChoiceIcon(r)}
                      {getChoiceLabel(r, level.options)}
                    </span>
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--accent-green)' }}>
                    {level.options[r.roundNumber]?.find((o) => o.startsWith(r.correctAnswer)) ?? r.correctAnswer}
                  </td>
                  <td className="px-3 py-2 font-mono-display" style={{ color: 'var(--text-primary)' }}>
                    {r.score}
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                    {SOURCE_LABELS[r.source] ?? r.source}
                  </td>
                  <td className="px-3 py-2">
                    {r.isDuplicate && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(255,171,0,0.15)', color: 'var(--accent-amber)' }}
                      >
                        重复
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8 animate-slide-up">
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--accent-red)' }} />
          扣分明细
        </h2>
        {challengeDeductions.length === 0 ? (
          <div className="card p-4 text-center" style={{ color: 'var(--text-muted)' }}>无扣分记录</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-dim)' }}>
                  {['回合', '扣分原因', '扣分值', '详细说明'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {challengeDeductions.map((d) => {
                  const record = records.find((r) => r.id === d.roundId)
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                      <td className="px-3 py-2 font-mono-display" style={{ color: 'var(--text-secondary)' }}>
                        R{record?.roundNumber ?? '-'}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--accent-red)' }}>{d.reason}</td>
                      <td className="px-3 py-2 font-mono-display" style={{ color: 'var(--accent-red)' }}>
                        -{d.points}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{d.detail}</td>
                    </tr>
                  )
                })}
                <tr>
                  <td colSpan={2} className="px-3 py-2 font-medium text-right" style={{ color: 'var(--text-secondary)' }}>
                    总扣分
                  </td>
                  <td className="px-3 py-2 font-mono-display font-bold" style={{ color: 'var(--accent-red)' }}>
                    -{totalDeduction}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-8 animate-slide-up">
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Copy size={18} style={{ color: 'var(--accent-amber)' }} />
          判断过程
        </h2>
        {audits.length === 0 ? (
          <div className="card p-4 text-center" style={{ color: 'var(--text-muted)' }}>无审计记录</div>
        ) : (
          <div
            className="card p-4 font-mono-display text-xs overflow-x-auto scrollbar-thin"
            style={{ background: '#0d1117' }}
          >
            {audits.map((a: AuditEntry) => (
              <div key={a.id} className="mb-3 last:mb-0" style={{ borderBottom: '1px solid var(--border-dim)', paddingBottom: 8 }}>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ color: 'var(--text-muted)' }}>
                    [{new Date(a.processedAt).toLocaleString('zh-CN')}]
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded text-xs"
                    style={{ background: 'rgba(0,229,255,0.1)', color: 'var(--accent-cyan)' }}
                  >
                    {AUDIT_SOURCE_LABELS[a.source] ?? a.source}
                  </span>
                </div>
                <div style={{ color: 'var(--text-primary)' }}>{a.action}</div>
                {Object.keys(a.snapshot).length > 0 && (
                  <pre className="mt-1 whitespace-pre-wrap" style={{ color: 'var(--text-muted)' }}>
                    {JSON.stringify(a.snapshot, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="flex gap-4 justify-center py-6">
        <Link to={`/review/${instance.id}`} className="btn-cyan flex items-center gap-2">
          <Eye size={16} />
          查看复盘
        </Link>
        <Link to="/" className="btn-red flex items-center gap-2">
          <ArrowLeft size={16} />
          返回首页
        </Link>
      </footer>
    </div>
  )
}
