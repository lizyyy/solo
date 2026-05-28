import { useParams, useNavigate } from 'react-router-dom'
import { Download, Home, Eye, EyeOff, CheckCircle2, XCircle, FileText } from 'lucide-react'
import { useGameStore } from '@/store'
import lots from '@/data/lots'
import { DIMENSION_LABELS, DOC_TYPE_LABELS, CLUE_TYPE_LABELS } from '@/types'
import type { ExportReport, AnalysisItem } from '@/types'

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 pb-1 border-b border-ink/15">
        <span className="font-serif text-base text-ink tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  )
}

function DifficultyLabel({ difficulty }: { difficulty: number }) {
  const labels = { 1: '初级', 2: '中级', 3: '高级' }
  const colors = { 1: 'text-jade', 2: 'text-gold-dark', 3: 'text-seal' }
  return <span className={`font-serif text-sm ${colors[difficulty as keyof typeof colors]}`}>{labels[difficulty as keyof typeof labels]}</span>
}

function generateSummary(report: ExportReport): string {
  const parts: string[] = []

  if (!report.auctionResult) {
    return '本次练习未完成竞价环节，建议重新挑战以获取完整的练习报告。'
  }

  const trapResults = report.auctionResult.trapResults
  const identified = trapResults.filter(t => t.identified).length
  const total = trapResults.length
  const trapRatio = total > 0 ? identified / total : 0

  if (trapRatio >= 0.8) {
    parts.push('您在本次练习中展现了出色的陷阱识别能力，准确识别了大部分陷阱线索。')
  } else if (trapRatio >= 0.5) {
    parts.push('您在本次练习中识别了部分陷阱线索，但仍有改进空间。')
  } else {
    parts.push('您在本次练习中未能识别多数陷阱线索，建议加强对文档细节的审读能力。')
  }

  if (report.auctionResult.valuationDeviation <= 10) {
    parts.push('估价偏差较小，说明您对拍品价值有较为准确的判断。')
  } else if (report.auctionResult.valuationDeviation <= 30) {
    parts.push('估价存在一定偏差，建议在审读材料时更加关注品相和来源对价格的影响。')
  } else {
    parts.push('估价偏差较大，建议重新审视材料中的关键线索，特别是估价参考中可能存在的锚定陷阱。')
  }

  if (report.auctionResult.won) {
    parts.push('成功竞得拍品，恭喜您！')
  } else {
    parts.push('未能竞得拍品，但这也是宝贵的学习经验。')
  }

  const unreadDocs = report.documents.filter(d => !d.read).length
  if (unreadDocs > 0) {
    parts.push(`尚有${unreadDocs}份材料未阅读，建议完整审阅所有材料后再做估价判断。`)
  }

  const uncollectedClues = report.clues.filter(c => !c.collected).length
  if (uncollectedClues > 0) {
    parts.push(`有${uncollectedClues}条关键线索未收集，线索的完整收集有助于做出更准确的估价。`)
  }

  return parts.join('')
}

export default function Report() {
  const { lotId } = useParams<{ lotId: string }>()
  const navigate = useNavigate()
  const { exportReport, completeLot } = useGameStore()

  const report = lotId ? exportReport(lotId) : null

  if (!report) {
    return (
      <div className="min-h-screen wood-panel flex items-center justify-center">
        <div className="parchment-card relative rounded-sm p-8 text-center max-w-md">
          <FileText className="w-10 h-10 text-gold mx-auto mb-4" />
          <p className="font-serif text-lg text-ink tracking-wide">暂无报告数据</p>
          <p className="font-body text-sm text-ink/60 mt-2">请先完成估价挑战</p>
          <button onClick={() => navigate('/')} className="btn-gold mt-6 text-sm">
            返回大厅
          </button>
        </div>
      </div>
    )
  }

  const handleDownload = () => {
    const json = JSON.stringify(report, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `估价报告-${report.lotName}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleBack = () => {
    if (lotId) completeLot(lotId)
    navigate('/')
  }

  const summary = generateSummary(report)

  return (
    <div className="min-h-screen wood-panel">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-wood-900/30" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 py-8">
          <div className="parchment-card relative rounded-sm overflow-hidden">
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center select-none">
              <span className="text-ink font-serif text-[120px] tracking-[0.5em] rotate-[-15deg]">
                估价练习
              </span>
            </div>

            <div className="relative z-10">
              <header className="text-center py-8 px-6 border-b-2 border-gold/30">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold/50" />
                  <div className="w-2 h-2 rotate-45 border border-gold/50" />
                  <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold/50" />
                </div>
                <h1 className="font-serif text-3xl text-ink tracking-[0.3em] mb-2">估价练习报告</h1>
                <p className="font-body text-xs text-ink/40 tracking-wider">
                  {new Date(report.generatedAt).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <div className="flex items-center justify-center gap-3 mt-4">
                  <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold/50" />
                  <div className="w-2 h-2 rotate-45 border border-gold/50" />
                  <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold/50" />
                </div>
              </header>

              <div className="p-6 md:p-8">
                <ReportSection title="拍品信息">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-body text-sm text-ink/50 w-16">名称</span>
                      <span className="font-serif text-base text-ink tracking-wide">{report.lotName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-body text-sm text-ink/50 w-16">副标题</span>
                      <span className="font-body text-sm text-ink/70">{report.lotSubtitle}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-body text-sm text-ink/50 w-16">难度</span>
                      <DifficultyLabel difficulty={report.difficulty} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-body text-sm text-ink/50 w-16">鉴定师</span>
                      <span className="font-body text-sm text-ink/70">{report.profileName}</span>
                    </div>
                  </div>
                </ReportSection>

                <ReportSection title="材料审阅记录">
                  <div className="space-y-1.5">
                    {report.documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center gap-2 py-1.5 px-2 rounded-sm hover:bg-ink/5">
                        {doc.read
                          ? <Eye className="w-4 h-4 text-jade shrink-0" />
                          : <EyeOff className="w-4 h-4 text-ink/30 shrink-0" />
                        }
                        <span className={`font-body text-sm flex-1 ${doc.read ? 'text-ink/80' : 'text-ink/40'}`}>
                          {doc.title}
                        </span>
                        <span className="text-xs font-body text-ink/30">
                          {DOC_TYPE_LABELS[doc.type]}
                        </span>
                        {doc.read
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-jade shrink-0" />
                          : <XCircle className="w-3.5 h-3.5 text-seal/50 shrink-0" />
                        }
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs font-body text-ink/40">
                    已阅读 {report.documents.filter(d => d.read).length}/{report.documents.length} 份
                  </div>
                </ReportSection>

                <ReportSection title="线索收集情况">
                  <div className="space-y-1.5">
                    {report.clues.map((clue, idx) => (
                      <div key={idx} className={`flex items-start gap-2 py-1.5 px-2 rounded-sm ${clue.collected ? 'bg-jade/5' : 'opacity-60'}`}>
                        {clue.collected
                          ? <CheckCircle2 className="w-4 h-4 text-jade shrink-0 mt-0.5" />
                          : <XCircle className="w-4 h-4 text-seal/50 shrink-0 mt-0.5" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className={`font-body text-sm ${clue.collected ? 'text-ink/80' : 'text-ink/40'}`}>
                            {clue.description}
                          </p>
                          <span className="text-xs font-body text-ink/30">
                            {CLUE_TYPE_LABELS[clue.type as keyof typeof CLUE_TYPE_LABELS] ?? clue.type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs font-body text-ink/40">
                    已收集 {report.clues.filter(c => c.collected).length}/{report.clues.length} 条
                  </div>
                </ReportSection>

                <ReportSection title="估价区间">
                  <div className="space-y-3">
                    {report.valuation ? (
                      <div className="flex items-center justify-between py-2 px-3 rounded-sm bg-gold/10 border border-gold/20">
                        <span className="font-body text-sm text-ink/60">你的估价</span>
                        <span className="font-serif text-lg text-gold-dark">
                          {report.valuation.low}-{report.valuation.high}万
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between py-2 px-3 rounded-sm bg-ink/5">
                        <span className="font-body text-sm text-ink/60">你的估价</span>
                        <span className="font-body text-sm text-ink/30">未估价</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-2 px-3 rounded-sm bg-jade/10 border border-jade/20">
                      <span className="font-body text-sm text-ink/60">正确估价</span>
                      <span className="font-serif text-lg text-jade">
                        {(() => {
                          const lot = lots.find(l => l.id === lotId)
                          return lot ? `${lot.correctValuation.low}-${lot.correctValuation.high}万` : '-'
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-body text-xs text-ink/40">信心指数：</span>
                      <div className="flex-1 h-1.5 bg-ink/10 rounded-full overflow-hidden max-w-[200px]">
                        <div
                          className="h-full bg-gradient-to-r from-gold-dark to-gold rounded-full"
                          style={{ width: `${report.confidence}%` }}
                        />
                      </div>
                      <span className="font-body text-xs text-ink/50">{report.confidence}%</span>
                    </div>
                  </div>
                </ReportSection>

                <ReportSection title="竞拍结果">
                  {report.auctionResult ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between py-1.5">
                        <span className="font-body text-sm text-ink/50">你的出价</span>
                        <span className="font-serif text-base text-ink">{report.auctionResult.playerBid}万</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="font-body text-sm text-ink/50">成交价</span>
                        <span className="font-serif text-base text-ink">{report.auctionResult.finalPrice}万</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <span className="font-body text-sm text-ink/50">竞价结果</span>
                        <span className={`font-serif text-base ${report.auctionResult.won ? 'text-jade' : 'text-seal'}`}>
                          {report.auctionResult.won ? '竞得拍品' : '未能竞得'}
                        </span>
                      </div>
                      {report.auctionResult.won && (
                        <div className="flex items-center justify-between py-1.5">
                          <span className="font-body text-sm text-ink/50">盈亏</span>
                          <span className={`font-serif text-base ${report.auctionResult.profitLoss >= 0 ? 'text-jade' : 'text-seal'}`}>
                            {report.auctionResult.profitLoss >= 0 ? '+' : ''}{report.auctionResult.profitLoss}元
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between py-1.5">
                        <span className="font-body text-sm text-ink/50">估价偏差</span>
                        <span className="font-serif text-base text-seal">{report.auctionResult.valuationDeviation}%</span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-ink/10">
                        <p className="font-body text-xs text-ink/40 mb-1.5">陷阱识别</p>
                        <div className="flex flex-wrap gap-2">
                          {report.auctionResult.trapResults.map((trap) => (
                            <span
                              key={trap.trapId}
                              className={`text-xs font-body px-2 py-0.5 rounded-sm ${
                                trap.identified
                                  ? 'bg-jade/15 text-jade border border-jade/20'
                                  : 'bg-seal/10 text-seal border border-seal/15'
                              }`}
                            >
                              {trap.identified ? '✓' : '✗'} +{trap.pointsEarned}/{trap.pointsPossible}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="font-body text-sm text-ink/40">未参与竞拍</p>
                  )}
                </ReportSection>

                <ReportSection title="偏差分析">
                  <div className="space-y-4">
                    {report.analysis.map((item: AnalysisItem) => (
                      <div key={item.dimension} className="py-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-serif text-sm text-ink tracking-wide">
                            {DIMENSION_LABELS[item.dimension]}
                          </span>
                          <span className={`text-xs font-serif font-semibold px-1.5 py-0.5 rounded-sm ${
                            item.impactOnPrice > 0 ? 'bg-jade/10 text-jade' : item.impactOnPrice < 0 ? 'bg-seal/10 text-seal' : 'bg-ink/5 text-ink/40'
                          }`}>
                            {item.impactOnPrice > 0 ? '+' : ''}{item.impactOnPrice}%
                          </span>
                        </div>
                        <div className="pl-3 border-l-2 border-jade/30 mb-2">
                          <p className="text-xs font-body text-jade/70 mb-0.5">正确分析</p>
                          <p className="font-body text-sm text-ink/70 leading-relaxed">{item.correctAnalysis}</p>
                        </div>
                        {item.impactOnPrice !== 0 && (
                          <div className="pl-3 border-l-2 border-seal/30">
                            <p className="text-xs font-body text-seal/70 mb-0.5">常见错误</p>
                            <p className="font-body text-sm text-ink/60 leading-relaxed">{item.commonMistake}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ReportSection>

                <ReportSection title="总结与建议">
                  <div className="py-2 px-3 bg-ink/5 rounded-sm">
                    <p className="font-body text-sm text-ink/70 leading-relaxed">{summary}</p>
                  </div>
                </ReportSection>
              </div>

              <footer className="py-4 px-6 border-t border-gold/20 text-center">
                <p className="text-xs font-body text-ink/30 tracking-wider">
                  AUCTION HOUSE VALUATION CHALLENGE · 估价练习报告
                </p>
              </footer>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 py-8">
            <button onClick={handleDownload} className="btn-gold text-sm flex items-center gap-2">
              <Download className="w-4 h-4" />
              下载报告
            </button>
            <button onClick={handleBack} className="btn-gold text-sm flex items-center gap-2">
              <Home className="w-4 h-4" />
              返回大厅
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
