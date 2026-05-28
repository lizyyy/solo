import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Gavel, CheckCircle, XCircle, User, Trophy, TrendingUp, TrendingDown } from 'lucide-react'
import { useGameStore } from '@/store'
import lots from '@/data/lots'
import { CLUE_TYPE_LABELS } from '@/types'

type Phase = 'start' | 'bidding' | 'result'

export default function Auction() {
  const { lotId } = useParams<{ lotId: string }>()
  const navigate = useNavigate()
  const { submitAuction, getLotProgress, completeLot, activeProfileId } = useGameStore()

  const lot = lots.find(l => l.id === lotId)
  const progress = getLotProgress(lotId || '')

  const [phase, setPhase] = useState<Phase>('start')
  const [currentBid, setCurrentBid] = useState(0)
  const [bidRound, setBidRound] = useState(0)
  const [playerIn, setPlayerIn] = useState(true)
  const [showButtons, setShowButtons] = useState(true)
  const [finalResult, setFinalResult] = useState<{
    won: boolean
    playerBid: number
    finalPrice: number
    profitLoss: number
    valuationDeviation: number
    trapResults: { trapId: string; identified: boolean; pointsEarned: number; pointsPossible: number; description: string; type: string }[]
  } | null>(null)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    if (!activeProfileId || !lot || !progress?.valuation) {
      navigate('/')
    }
  }, [activeProfileId, lot, progress?.valuation, navigate])

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  if (!lot || !progress?.valuation) return null

  const playerMaxBid = progress.valuation.high
  const finalPrice = lot.finalPrice
  const startPrice = Math.floor(finalPrice * 0.55)
  const bidSteps = [
    Math.floor(startPrice * 1.15),
    Math.floor(startPrice * 1.35),
    Math.floor(startPrice * 1.55),
    Math.floor(startPrice * 1.75),
    finalPrice,
  ]
  const bidders = ['张先生', '李女士', '王先生', '赵女士', '藏家联盟']

  const startAuction = () => {
    setPhase('bidding')
    setCurrentBid(startPrice)
    setBidRound(0)
    setPlayerIn(true)
    setShowButtons(true)
    setFinalResult(null)
  }

  const animateBid = (target: number, callback: () => void) => {
    const start = currentBid
    const duration = 800
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrentBid(Math.floor(start + (target - start) * eased))

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        callback()
      }
    }
    animate()
  }

  const handleNextRound = () => {
    const nextRound = bidRound + 1
    if (nextRound >= bidSteps.length) {
      handleFinalize(true)
      return
    }

    const nextBid = bidSteps[nextRound]
    if (nextBid > playerMaxBid) {
      animateBid(nextBid, () => {
        setBidRound(nextRound)
        setShowButtons(false)
        setTimeout(() => {
          setPlayerIn(false)
          handleFinalize(false)
        }, 1200)
      })
    } else {
      animateBid(nextBid, () => {
        setBidRound(nextRound)
        setShowButtons(true)
      })
    }
  }

  const handleFollow = () => {
    setShowButtons(false)
    handleNextRound()
  }

  const handleDrop = () => {
    setShowButtons(false)
    setPlayerIn(false)
    handleFinalize(false)
  }

  const handleFinalize = (won: boolean) => {
    setPhase('result')
    const playerBid = won ? finalPrice : bidSteps[Math.max(0, bidRound - 1)]

    submitAuction(lot.id, playerBid)
    completeLot(lot.id)

    const updatedProgress = getLotProgress(lot.id)
    const trapResultsWithInfo = updatedProgress?.auctionResult?.trapResults.map(tr => {
      const trap = lot.traps.find(t => t.id === tr.trapId)
      return {
        ...tr,
        description: trap?.description || '',
        type: trap?.type || 'unknown',
      }
    }) || []

    setFinalResult({
      won,
      playerBid,
      finalPrice,
      profitLoss: updatedProgress?.auctionResult?.profitLoss || 0,
      valuationDeviation: updatedProgress?.auctionResult?.valuationDeviation || 0,
      trapResults: trapResultsWithInfo,
    })
  }

  return (
    <div className="min-h-screen wood-panel">
      <div className="max-w-3xl mx-auto py-8 px-6">
        <button
          onClick={() => navigate(`/case/${lot.id}/valuate`)}
          className="flex items-center gap-2 text-gold-light hover:text-gold transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-serif text-sm tracking-wide">返回估价</span>
        </button>

        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl text-gold-light tracking-wider mb-2">
            {lot.name}
          </h1>
          <p className="font-body text-parchment-dark tracking-wider">
            {lot.subtitle}
          </p>
        </div>

        {phase === 'start' && (
          <div className="parchment-card relative rounded-sm p-8 text-center animate-float-in">
            <Gavel className="w-16 h-16 text-seal mx-auto mb-4" />
            <h2 className="font-serif text-2xl text-ink mb-4">竞拍即将开始</h2>
            <p className="font-body text-ink/70 mb-2">
              您的最高出价上限：<span className="font-semibold text-ink">{playerMaxBid} 万元</span>
            </p>
            <p className="font-body text-ink/60 text-sm mb-6">
              竞拍过程中，价格将逐步攀升。您需要决定是否继续跟价，或放弃竞拍。
            </p>
            <button
              onClick={startAuction}
              className="btn-seal text-lg px-10"
            >
              开始竞拍
            </button>
          </div>
        )}

        {phase === 'bidding' && (
          <div className="parchment-card relative rounded-sm p-8 animate-float-in">
            <div className="text-center mb-8">
              <p className="font-body text-ink/60 text-sm mb-2">当前出价</p>
              <div className="flex items-center justify-center gap-3">
                <span className="font-serif text-5xl text-ink font-bold animate-price-flip">
                  {currentBid}
                </span>
                <span className="font-serif text-2xl text-ink/60">万元</span>
              </div>
            </div>

            {!showButtons && bidRound < bidSteps.length - 1 && (
              <div className="text-center py-6">
                <div className="flex items-center justify-center gap-2 text-ink/60 font-body">
                  <User className="w-4 h-4" />
                  <span>{bidders[bidRound % bidders.length]} 出价中...</span>
                </div>
              </div>
            )}

            {!showButtons && bidRound >= bidSteps.length - 1 && playerIn && (
              <div className="text-center py-6">
                <Gavel className="w-8 h-8 text-seal mx-auto animate-gavel-slam mb-2" />
                <p className="font-body text-ink/60">成交！</p>
              </div>
            )}

            {!showButtons && !playerIn && (
              <div className="text-center py-6">
                <p className="font-body text-seal mb-2">您已退出竞拍</p>
                <p className="font-body text-ink/60 text-sm">等待竞拍结束...</p>
              </div>
            )}

            {showButtons && (
              <div className="flex items-center justify-center gap-4 pt-4">
                <button
                  onClick={handleDrop}
                  className="px-8 py-3 border border-seal text-seal font-serif rounded-sm
                           hover:bg-seal hover:text-parchment transition-all"
                >
                  放弃竞拍
                </button>
                <button
                  onClick={handleFollow}
                  className="btn-seal"
                >
                  继续跟价
                </button>
              </div>
            )}

            <div className="mt-8 pt-4 border-t border-ink/10">
              <p className="font-body text-ink/50 text-xs text-center">
                您的最高出价：{playerMaxBid} 万元
              </p>
            </div>
          </div>
        )}

        {phase === 'result' && finalResult && (
          <div className="animate-float-in">
            <div className={`parchment-card relative rounded-sm p-8 text-center mb-6
                            ${finalResult.won ? 'bg-gradient-to-b from-jade/10 to-transparent' : ''}`}>
              {finalResult.won ? (
                <>
                  <Trophy className="w-16 h-16 text-jade mx-auto mb-4" />
                  <h2 className="font-serif text-3xl text-jade mb-2">恭喜拍得！</h2>
                  <p className="font-body text-ink/70 mb-4">
                    您以 <span className="font-semibold text-ink">{finalResult.playerBid} 万元</span> 成功拍得此拍品
                  </p>
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-sm
                                  ${finalResult.profitLoss >= 0 ? 'bg-jade/15 text-jade' : 'bg-seal/15 text-seal'}`}>
                    {finalResult.profitLoss >= 0 ? (
                      <TrendingUp className="w-5 h-5" />
                    ) : (
                      <TrendingDown className="w-5 h-5" />
                    )}
                    <span className="font-serif font-semibold">
                      预估盈亏：{finalResult.profitLoss >= 0 ? '+' : ''}{(finalResult.profitLoss / 10000).toFixed(0)} 万元
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-16 h-16 text-seal mx-auto mb-4" />
                  <h2 className="font-serif text-3xl text-seal mb-2">拍品旁落</h2>
                  <p className="font-body text-ink/70 mb-4">
                    最终成交价：<span className="font-semibold text-ink">{finalResult.finalPrice} 万元</span>
                  </p>
                  <p className="font-body text-ink/60 text-sm">
                    您的最高出价：{playerMaxBid} 万元
                  </p>
                </>
              )}
            </div>

            <div className="parchment-card relative rounded-sm p-6 mb-6">
              <h3 className="font-serif text-lg text-ink font-semibold mb-4">估价偏差分析</h3>
              <div className="grid grid-cols-2 gap-4 text-sm font-body mb-4">
                <div className="flex justify-between">
                  <span className="text-ink/60">正确估价区间：</span>
                  <span className="text-ink font-semibold">
                    {lot.correctValuation.low} - {lot.correctValuation.high} 万
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink/60">您的估价区间：</span>
                  <span className="text-ink font-semibold">
                    {progress.valuation.low} - {progress.valuation.high} 万
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink/60">实际成交价：</span>
                  <span className="text-ink font-semibold">{finalResult.finalPrice} 万</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink/60">估价偏差：</span>
                  <span className={`font-semibold ${finalResult.valuationDeviation > 20 ? 'text-seal' : 'text-jade'}`}>
                    {finalResult.valuationDeviation}%
                  </span>
                </div>
              </div>
            </div>

            <div className="parchment-card relative rounded-sm p-6 mb-6">
              <h3 className="font-serif text-lg text-ink font-semibold mb-4">
                陷阱识别情况
                <span className="ml-2 text-sm font-normal text-ink/60">
                  ({finalResult.trapResults.filter(t => t.identified).length}/{finalResult.trapResults.length})
                </span>
              </h3>
              <div className="space-y-3">
                {finalResult.trapResults.map((tr) => (
                  <div
                    key={tr.trapId}
                    className={`p-3 rounded-sm flex items-start gap-3
                               ${tr.identified ? 'bg-jade/10' : 'bg-seal/10'}`}
                  >
                    {tr.identified ? (
                      <CheckCircle className="w-5 h-5 text-jade flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-seal flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-ink/10 text-ink/70 font-body">
                          {CLUE_TYPE_LABELS[tr.type as keyof typeof CLUE_TYPE_LABELS] || tr.type}
                        </span>
                        <span className={`text-xs font-body ${tr.identified ? 'text-jade' : 'text-seal'}`}>
                          {tr.pointsEarned}/{tr.pointsPossible} 分
                        </span>
                      </div>
                      <p className="font-body text-sm text-ink/80">{tr.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-ink/10 text-right">
                <span className="font-serif text-ink">
                  陷阱识别得分：
                  <span className="text-gold font-semibold ml-2">
                    {finalResult.trapResults.reduce((sum, t) => sum + t.pointsEarned, 0)} /
                    {finalResult.trapResults.reduce((sum, t) => sum + t.pointsPossible, 0)} 分
                  </span>
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => navigate(`/case/${lot.id}`)}
                className="btn-gold text-sm"
              >
                返回工作台
              </button>
              <button
                onClick={() => navigate(`/case/${lot.id}/analysis`)}
                className="btn-seal text-sm"
              >
                查看错因分析
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
