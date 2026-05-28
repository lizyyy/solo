import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calculator, Eye, Lightbulb, Scale, DollarSign } from 'lucide-react'
import { useGameStore } from '@/store'
import lots from '@/data/lots'

export default function Valuate() {
  const { lotId } = useParams<{ lotId: string }>()
  const navigate = useNavigate()
  const { setValuation, setConfidence, getLotProgress, activeProfileId } = useGameStore()

  const lot = lots.find(l => l.id === lotId)
  const progress = getLotProgress(lotId || '')

  const [valuationLow, setValuationLow] = useState<number>(progress?.valuation?.low || 0)
  const [valuationHigh, setValuationHigh] = useState<number>(progress?.valuation?.high || 0)
  const [confidence, setConfidenceValue] = useState<number>(progress?.confidence || 50)

  useEffect(() => {
    if (!activeProfileId || !lot) {
      navigate('/')
    }
  }, [activeProfileId, lot, navigate])

  if (!lot) return null

  const readCount = progress?.readDocuments.length || 0
  const collectedCount = progress?.collectedClues.length || 0
  const totalClues = lot.traps.length

  const handleValuationLowChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value)
    setValuationLow(value)
    setValuation(lot.id, value, valuationHigh)
  }

  const handleValuationHighChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value)
    setValuationHigh(value)
    setValuation(lot.id, valuationLow, value)
  }

  const handleConfidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value)
    setConfidenceValue(value)
    setConfidence(lot.id, value)
  }

  const getConfidenceLabel = () => {
    if (confidence <= 30) return { text: '不确定', color: 'text-seal' }
    if (confidence <= 70) return { text: '较有把握', color: 'text-gold' }
    return { text: '很有信心', color: 'text-jade' }
  }

  const confidenceInfo = getConfidenceLabel()
  const canProceed = valuationLow > 0 && valuationHigh > 0 && valuationLow <= valuationHigh && readCount >= 1

  return (
    <div className="min-h-screen wood-panel">
      <div className="max-w-4xl mx-auto py-8 px-6">
        <div className="mb-6">
          <button
            onClick={() => navigate(`/case/${lot.id}`)}
            className="flex items-center gap-2 text-gold-light hover:text-gold transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-serif text-sm tracking-wide">返回工作台</span>
          </button>
          <div className="flex items-start gap-6">
            <img
              src={lot.image}
              alt={lot.name}
              className="w-40 h-40 object-cover rounded-sm gold-border"
            />
            <div>
              <h1 className="font-serif text-2xl text-gold-light tracking-wide mb-1">
                {lot.name}
              </h1>
              <p className="font-body text-sm text-parchment-dark tracking-wider mb-3">
                {lot.subtitle}
              </p>
              <div className="flex items-center gap-4 text-sm font-body">
                <span className="flex items-center gap-1.5 text-parchment-dark">
                  <Eye className="w-4 h-4 text-gold" />
                  已读 {readCount}/{lot.documents.length} 份
                </span>
                <span className="flex items-center gap-1.5 text-parchment-dark">
                  <Lightbulb className="w-4 h-4 text-gold" />
                  线索 {collectedCount}/{totalClues}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="parchment-card relative rounded-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-5 h-5 text-seal" />
            <h2 className="font-serif text-lg text-ink font-semibold">估价区间</h2>
          </div>
          <p className="font-body text-sm text-ink/60 mb-6">
            根据您审阅的材料，输入您认为合理的估价区间（单位：万元人民币）
          </p>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block font-serif text-sm text-ink/70 mb-2">
                最低估价（万元）
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40" />
                <input
                  type="number"
                  value={valuationLow || ''}
                  onChange={handleValuationLowChange}
                  placeholder="输入最低估价"
                  className="w-full pl-10 pr-4 py-3 bg-parchment-dark/30 border border-gold/30 rounded-sm
                           font-serif text-ink focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block font-serif text-sm text-ink/70 mb-2">
                最高估价（万元）
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40" />
                <input
                  type="number"
                  value={valuationHigh || ''}
                  onChange={handleValuationHighChange}
                  placeholder="输入最高估价"
                  className="w-full pl-10 pr-4 py-3 bg-parchment-dark/30 border border-gold/30 rounded-sm
                           font-serif text-ink focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>
          </div>

          {valuationLow > 0 && valuationHigh > 0 && (
            <div className="p-4 bg-gold/10 rounded-sm mb-4">
              <p className="font-body text-sm text-ink/80">
                您的估价区间：
                <span className="font-serif font-semibold text-ink ml-2">
                  {valuationLow} - {valuationHigh} 万元
                </span>
              </p>
              <p className="font-body text-xs text-ink/50 mt-1">
                参考估价（含偏差）：{lot.referencePrice} 万元
              </p>
            </div>
          )}

          {valuationLow > valuationHigh && valuationHigh > 0 && (
            <p className="text-seal font-body text-sm mb-4">
              ⚠ 最低估价不能高于最高估价
            </p>
          )}
        </div>

        <div className="parchment-card relative rounded-sm p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Scale className="w-5 h-5 text-seal" />
            <h2 className="font-serif text-lg text-ink font-semibold">信心指数</h2>
          </div>
          <p className="font-body text-sm text-ink/60 mb-6">
            您对自己的估价判断有多大把握？信心指数会影响竞拍策略建议
          </p>

          <div className="mb-2">
            <input
              type="range"
              min="0"
              max="100"
              value={confidence}
              onChange={handleConfidenceChange}
              className="w-full h-2 bg-parchment-dark rounded-full appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:w-5
                         [&::-webkit-slider-thumb]:h-5
                         [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-gold
                         [&::-webkit-slider-thumb]:shadow-lg
                         [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>
          <div className="flex justify-between text-xs font-body text-ink/50">
            <span>0</span>
            <span className={confidenceInfo.color}>
              当前：{confidence}% - {confidenceInfo.text}
            </span>
            <span>100</span>
          </div>
        </div>

        <div className="parchment-card relative rounded-sm p-6 mb-8">
          <h3 className="font-serif text-base text-ink font-semibold mb-3">估价摘要</h3>
          <div className="grid grid-cols-2 gap-4 text-sm font-body">
            <div className="flex justify-between">
              <span className="text-ink/60">文档阅读：</span>
              <span className="text-ink font-semibold">{readCount}/{lot.documents.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/60">线索收集：</span>
              <span className="text-ink font-semibold">{collectedCount}/{totalClues}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/60">估价区间：</span>
              <span className="text-ink font-semibold">
                {valuationLow > 0 && valuationHigh > 0 ? `${valuationLow} - ${valuationHigh}万` : '未设置'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/60">信心指数：</span>
              <span className="text-ink font-semibold">{confidence}%</span>
            </div>
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
            onClick={() => navigate(`/case/${lot.id}/auction`)}
            disabled={!canProceed}
            className={`btn-seal text-sm ${!canProceed ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            进入竞拍
          </button>
        </div>

        {!canProceed && readCount < 1 && (
          <p className="text-seal font-body text-sm mt-4 text-center">
            请至少阅读 1 份文档后再提交估价
          </p>
        )}
      </div>
    </div>
  )
}
