import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getReplayList, clearReplays } from '@/utils/reportExport'
import { MATERIALS } from '@/data/gameConfig'
import type { ReplayRecord } from '@/types/game'
import { History, ChevronRight, Trash2, Trophy, Calendar, Clock } from 'lucide-react'

const BG = '#0D1B2A'
const CARD = '#1B2838'
const ACCENT = '#E85D04'
const TEXT = '#E0E1DD'
const BORDER = '#415A77'

export default function ReplayList() {
  const navigate = useNavigate()
  const [replays, setReplays] = useState<ReplayRecord[]>(() => getReplayList().reverse())

  const handleClear = () => {
    if (confirm('确定清除所有回放记录？')) {
      clearReplays()
      setReplays([])
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen" style={{ background: BG, color: TEXT }}>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History size={24} style={{ color: ACCENT }} /> 回放记录
          </h1>
          {replays.length > 0 && (
            <button onClick={handleClear} className="flex items-center gap-2 px-3 py-1.5 rounded text-xs text-red-400 hover:text-red-300" style={{ border: '1px solid #EF444444' }}>
              <Trash2 size={14} /> 清除全部
            </button>
          )}
        </div>

        {replays.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <History size={48} className="mx-auto mb-4 opacity-30" />
            <p>暂无回放记录</p>
            <button onClick={() => navigate('/')} className="mt-4 px-6 py-2 rounded-lg font-bold text-white text-sm" style={{ background: ACCENT }}>
              开始新游戏
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {replays.map(r => (
              <button
                key={r.sessionId}
                onClick={() => navigate(`/replay/${r.sessionId}`)}
                className="w-full text-left rounded-lg p-5 flex items-center justify-between group transition-all hover:scale-[1.01]"
                style={{ background: CARD, border: `1px solid ${BORDER}` }}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Trophy size={16} style={{ color: r.netProfit >= 0 ? '#10B981' : '#EF4444' }} />
                    <span className="font-bold" style={{ color: r.netProfit >= 0 ? '#10B981' : '#EF4444' }}>
                      {r.netProfit >= 0 ? '+' : ''}¥{r.netProfit.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs opacity-60">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(r.date)}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {r.rounds.length}回合</span>
                  </div>
                </div>
                <ChevronRight size={20} className="opacity-30 group-hover:opacity-70 transition-opacity" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
