import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { Trophy, ArrowRight } from 'lucide-react'
import NotePanel from '@/components/NotePanel'
import DiffViewer from '@/components/DiffViewer'
import { formatTimestamp, formatDuration } from '@/utils/timeUtils'
import type { GameSession } from '@/types'

export default function Settlement() {
  const navigate = useNavigate()
  const { sessions, currentSessionId, getCurrentSession, getCurrentSettlement, addSupplementaryNote, getSettlement } = useGameStore()

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(currentSessionId)

  const endedSessions = useMemo(() => sessions.filter(s => s.status === 'ended'), [sessions])
  const activeSession = useMemo(() => {
    if (selectedSessionId) return sessions.find(s => s.id === selectedSessionId) || null
    return getCurrentSession()
  }, [selectedSessionId, sessions, getCurrentSession])

  const settlement = useMemo(() => {
    if (!activeSession) return null
    if (activeSession.id === currentSessionId) return getCurrentSettlement()
    return getSettlement(activeSession.id)
  }, [activeSession, currentSessionId, getCurrentSettlement, getSettlement])

  const handleAddNote = (roundIndex: number, content: string, author: string) => {
    if (!activeSession) return
    const prevId = currentSessionId
    useGameStore.setState({ currentSessionId: activeSession.id })
    addSupplementaryNote(roundIndex, content, author)
    useGameStore.setState({ currentSessionId: prevId })
  }

  if (endedSessions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <p className="text-lg text-gray-500">暂无已结束的游戏</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-lg bg-purple-600/60 hover:bg-purple-500/60 text-white text-sm font-medium transition-all"
          >
            前往操控台
          </button>
        </div>
      </div>
    )
  }

  const gradeColors: Record<string, string> = {
    S: 'from-amber-400 to-yellow-300',
    A: 'from-emerald-400 to-cyan-400',
    B: 'from-blue-400 to-indigo-400',
    C: 'from-gray-400 to-gray-300',
    D: 'from-red-400 to-orange-400',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold text-purple-300">结算中心</h2>
        <div className="flex gap-1 overflow-x-auto">
          {endedSessions.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSessionId(s.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeSession?.id === s.id
                  ? 'bg-purple-600/40 text-purple-300 border border-purple-500/60'
                  : 'bg-gray-800/40 text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              {s.levelParams.name}
            </button>
          ))}
        </div>
      </div>

      {activeSession && settlement && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-4">
            <div className="bg-[#12163a]/80 rounded-xl border border-purple-900/40 p-5 text-center">
              <div className={`text-6xl font-bold bg-gradient-to-br ${gradeColors[settlement.grade] || 'from-gray-400 to-gray-300'} bg-clip-text text-transparent mb-2`} style={{ fontFamily: 'Orbitron, monospace' }}>
                {settlement.grade}
              </div>
              <div className="flex items-center justify-center gap-2 text-2xl text-cyan-400 font-bold">
                <Trophy size={20} />
                {settlement.totalScore}
                <span className="text-sm text-gray-500 font-normal">分</span>
              </div>
            </div>

            <div className="bg-[#12163a]/80 rounded-xl border border-purple-900/40 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-300">基本信息</h3>
              <InfoRow label="关卡" value={activeSession.levelParams.name} />
              <InfoRow label="难度" value={{ easy: '简单', medium: '中等', hard: '困难' }[activeSession.levelParams.difficulty] || ''} />
              <InfoRow label="总回合" value={`${activeSession.currentRound}`} />
              <InfoRow label="结束原因" value={activeSession.endReason} />
              <InfoRow label="开始时间" value={activeSession.startedAt ? formatTimestamp(activeSession.startedAt) : '—'} />
              <InfoRow label="结束时间" value={activeSession.endedAt ? formatTimestamp(activeSession.endedAt) : '—'} />
              <InfoRow label="累计暂停" value={formatDuration(activeSession.totalPausedDuration)} />
              <InfoRow label="数据来源" value={activeSession.source} />
              <InfoRow label="录入时间" value={formatTimestamp(activeSession.createdAt)} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-[#12163a]/80 rounded-xl border border-purple-900/40 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-300">回合统计</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left py-1.5 pr-2">回合</th>
                      <th className="text-right py-1.5 pr-2">得分</th>
                      <th className="text-right py-1.5 pr-2">命中</th>
                      <th className="text-right py-1.5 pr-2">失误</th>
                      <th className="text-right py-1.5">连击</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlement.roundStats.map(stat => (
                      <tr key={stat.roundIndex} className="border-b border-gray-800/40">
                        <td className="py-1.5 text-gray-400">R{stat.roundIndex}</td>
                        <td className={`py-1.5 text-right font-mono ${stat.score > 0 ? 'text-emerald-400' : stat.score < 0 ? 'text-red-400' : 'text-gray-500'}`}>{stat.score}</td>
                        <td className="py-1.5 text-right text-emerald-400">{stat.hits}</td>
                        <td className="py-1.5 text-right text-red-400">{stat.misses}</td>
                        <td className="py-1.5 text-right text-purple-300">{stat.combo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-[#12163a]/80 rounded-xl border border-purple-900/40 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-300">处理建议</h3>
              <div className="space-y-2">
                {settlement.suggestions.map((s, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="text-cyan-400 mt-0.5 flex-shrink-0">▸</span>
                    <span className="text-gray-300 leading-relaxed">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <NotePanel session={activeSession} onAddNote={handleAddNote} />
            <DiffViewer roundStats={settlement.roundStats} notes={activeSession.notes} />
            <button
              onClick={() => navigate('/replay')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-500/30 text-cyan-300 text-sm font-medium transition-all border border-cyan-700/40"
            >
              查看回放 <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300">{value}</span>
    </div>
  )
}
