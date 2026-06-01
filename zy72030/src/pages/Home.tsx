import { useState, useEffect } from 'react'
import { Mountain, Star, BookOpen, History } from 'lucide-react'
import ActivityConsole from '@/components/ActivityConsole'
import RecordPanel from '@/components/RecordPanel'
import FailureFeedback from '@/components/FailureFeedback'
import ReportPage from '@/components/ReportPage'
import ReplayPage from '@/components/ReplayPage'
import { useActivityStore } from '@/store'
import { getColleagueFailureDetail } from '@/utils'

export default function Home() {
  const { records, currentActivity, addSupplementRecord } = useActivityStore()
  const [showReport, setShowReport] = useState(false)
  const [showReplay, setShowReplay] = useState(false)
  const [failureFeedback, setFailureFeedback] = useState<{
    open: boolean
    reason: 'rule_misunderstanding' | 'operation_timeout' | 'boundary_score' | 'other_exception' | null
    polyhedron: string
    score: number
    detail: string | null
  }>({
    open: false,
    reason: null,
    polyhedron: '',
    score: 0,
    detail: null,
  })
  const [hasInitializedSamples, setHasInitializedSamples] = useState(false)

  useEffect(() => {
    if (currentActivity && records.length === 0 && !hasInitializedSamples) {
      const existingAnyRecords = localStorage.getItem('polyhedron-samples-initialized')
      if (!existingAnyRecords) {
        addSupplementRecord({
          polyhedronType: '正十二面体',
          score: 12,
          timeCostSeconds: 8,
          result: 'success',
          failureReason: null,
          failureDetail: null,
          rawNote: '顺利，这条没问题',
          source: 'realtime',
        })
        addSupplementRecord({
          polyhedronType: '正八面体',
          score: 5,
          timeCostSeconds: 15,
          result: 'pending_review',
          failureReason: 'boundary_score',
          failureDetail: getColleagueFailureDetail('boundary_score', '正八面体', 5),
          rawNote: '小何说这条再看看，卡在及格线上',
          source: 'realtime',
        })
        addSupplementRecord({
          polyhedronType: '正六面体',
          score: 0,
          timeCostSeconds: 20,
          result: 'failure',
          failureReason: 'rule_misunderstanding',
          failureDetail:
            '选择了正六面体，但题目要求（旧口径按面数计分，新口径按顶点数）——规则没理解，不是手慢的问题。此条从活动复盘群补录。',
          rawNote: '群聊记录：当时按旧规则算的，小何说别删留着对照',
          source: 'old_standard',
        })
        setHasInitializedSamples(true)
        localStorage.setItem('polyhedron-samples-initialized', 'true')
      }
    }
  }, [currentActivity, records.length, hasInitializedSamples, addSupplementRecord])

  useEffect(() => {
    if (records.length > 0) {
      const last = records[records.length - 1]
      if (last.result === 'failure' && last.failureReason) {
        setFailureFeedback({
          open: true,
          reason: last.failureReason,
          polyhedron: last.polyhedronType,
          score: last.score,
          detail: last.failureDetail,
        })
      }
    }
  }, [records.length])

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white">
      <header className="border-b border-[#0f3460] bg-[#16213e]/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#f0a500] rounded-lg">
              <Mountain size={24} className="text-[#1a1a2e]" />
            </div>
            <div>
              <h1
                className="text-xl font-bold text-white"
                style={{ fontFamily: '"Noto Serif SC", serif' }}
              >
                多面体矿山探险
              </h1>
              <p className="text-xs text-gray-500">课堂活动管理与复盘工具</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <BookOpen size={14} />
              <span>例外不消失 · 来源可追溯</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <ActivityConsole
            onOpenReport={() => setShowReport(true)}
            onOpenReplay={() => setShowReplay(true)}
          />
        </div>

        {currentActivity && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="lg:order-1 order-2">
              <div className="bg-[#16213e] rounded-xl p-5 border border-[#0f3460] mb-6">
                <h3
                  className="text-lg font-bold text-white mb-4"
                  style={{ fontFamily: '"Noto Serif SC", serif' }}
                >
                  快速录入
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { name: '正四面体', score: 4, time: 5, result: 'success' as const },
                    { name: '正六面体', score: 6, time: 8, result: 'success' as const },
                    { name: '正八面体', score: 8, time: 10, result: 'success' as const },
                    { name: '正十二面体', score: 12, time: 12, result: 'success' as const },
                    { name: '正二十面体', score: 20, time: 15, result: 'success' as const },
                    { name: '立方八面体', score: 5, time: 30, result: 'failure' as const, reason: 'operation_timeout' as const },
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const detail =
                          item.result === 'failure'
                            ? getColleagueFailureDetail(
                                item.reason || 'operation_timeout',
                                item.name,
                                item.score
                              )
                            : null
                        addSupplementRecord({
                          polyhedronType: item.name,
                          score: item.score,
                          timeCostSeconds: item.time,
                          result: item.result,
                          failureReason: item.reason || null,
                          failureDetail: detail,
                          rawNote: '',
                          source: 'realtime',
                        })
                      }}
                      className="flex flex-col items-center p-3 bg-[#1a1a2e] hover:bg-[#0f3460] border border-[#0f3460] hover:border-[#f0a500]/50 rounded-lg transition-all group"
                    >
                      <Star size={20} className="text-[#f0a500] mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-medium text-white">{item.name}</span>
                      <span className="text-xs text-gray-500">{item.score}分 / {item.time}秒</span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  快速按钮用于演示。实际使用时请用右侧"实时录入"或"群聊补录"按钮。
                </p>
              </div>

              <div className="bg-[#16213e] rounded-xl p-5 border border-[#0f3460]">
                <h3
                  className="text-lg font-bold text-white mb-3"
                  style={{ fontFamily: '"Noto Serif SC", serif' }}
                >
                  使用说明
                </h3>
                <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
                  <li>点击「开始新活动」启动计时</li>
                  <li>用「实时录入」记录学生操作，或用「群聊补录」/「旧口径」补录历史记录</li>
                  <li>失败时会自动弹出原因提示，区分规则误解 vs 操作迟缓</li>
                  <li>可随时「暂停」，暂停记录在回放中完整保留</li>
                  <li>点击「结算」生成复盘报告，支持导出为 CSV 或 JSON</li>
                  <li>点击「回放」可按时间轴重温整个活动过程</li>
                </ol>
                <div className="mt-4 p-3 bg-amber-900/20 border border-amber-800/30 rounded-lg">
                  <p className="text-xs text-amber-300">
                    <strong>💡 设计初衷：</strong>原始备注会完整保留，不会为了整齐被自动清洗。
                    例外记录（失败、待确认、暂停）不会在汇总数字里悄悄消失。
                    导出的报告像同事写给同事看的话，月底复盘直接能用。
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:order-2 order-1 h-[calc(100vh-320px)] min-h-[500px]">
              <RecordPanel />
            </div>
          </div>
        )}

        {!currentActivity && (
          <div className="bg-[#16213e] rounded-xl p-16 border border-[#0f3460] text-center">
            <div className="inline-flex p-5 bg-[#f0a500]/10 rounded-full mb-6">
              <Mountain size={56} className="text-[#f0a500]" />
            </div>
            <h2
              className="text-3xl font-bold text-white mb-4"
              style={{ fontFamily: '"Noto Serif SC", serif' }}
            >
              多面体矿山探险
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto mb-8 leading-relaxed">
              点击上方「开始新活动」按钮，开启一次课堂探险。
              <br />
              每条记录都会保留来源、处理时间和原始备注，例外不消失，复盘有依据。
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1a2e] rounded-lg text-gray-300">
                <Star size={16} className="text-emerald-400" />
                顺利记录
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1a2e] rounded-lg text-gray-300">
                <History size={16} className="text-amber-400" />
                暂停不丢
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1a2e] rounded-lg text-gray-300">
                <BookOpen size={16} className="text-red-400" />
                失败分原因
              </div>
            </div>
          </div>
        )}
      </main>

      <FailureFeedback
        open={failureFeedback.open}
        onClose={() => setFailureFeedback({ ...failureFeedback, open: false })}
        failureReason={failureFeedback.reason}
        polyhedronType={failureFeedback.polyhedron}
        score={failureFeedback.score}
        detail={failureFeedback.detail}
      />

      {showReport && (
        <ReportPage open={showReport} onClose={() => setShowReport(false)} />
      )}

      {showReplay && (
        <ReplayPage open={showReplay} onClose={() => setShowReplay(false)} />
      )}
    </div>
  )
}
