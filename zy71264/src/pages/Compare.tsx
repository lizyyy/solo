import { useState, useRef, useEffect, useMemo } from 'react'
import TopNavbar from '@/components/ui/TopNavbar'
import ReadOnlyScene, { ReadOnlySceneRef } from '@/components/scene/ReadOnlyScene'
import { X, AlertTriangle, CheckCircle, XCircle, GitCompare } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { ParamSet, AnomalyItem, AirflowSample, CompareScore } from '@/types'
import { computeAirflowSamples, detectAnomalies, computeScore } from '@/lib/mockEngine'
import { cn } from '@/lib/utils'

interface DerivedData {
  paramSet: ParamSet
  anomalies: AnomalyItem[]
  airflowSamples: AirflowSample[]
  score: CompareScore
}

interface ScoreDetailModalProps {
  isOpen: boolean
  onClose: () => void
  score: CompareScore | null
  paramSetName: string
}

function CompareScoreDetailModal({ isOpen, onClose, score, paramSetName }: ScoreDetailModalProps) {
  if (!isOpen || !score) return null

  const metrics = [
    {
      key: 'coolingEfficiency',
      label: '制冷效率',
      value: score.coolingEfficiency,
      explanation: '衡量CRAC单位制冷量与机架总散热量的比值，越高表示制冷效率越好。',
    },
    {
      key: 'hotspotCount',
      label: '热点数量',
      value: 100 - score.hotspotCount,
      explanation: '检测温度超过阈值的区域数量，热点越少得分越高。',
    },
    {
      key: 'airflowUtilization',
      label: '气流利用率',
      value: score.airflowUtilization,
      explanation: '衡量有效冷却气流与总送风量的比值，反映气流组织的合理性。',
    },
    {
      key: 'overallScore',
      label: '综合评分',
      value: score.overallScore,
      explanation: '综合以上各项指标的加权总分，满分为100分。',
    },
  ]

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'bg-green-500'
    if (s >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getScoreTextColor = (s: number) => {
    if (s >= 80) return 'text-green-400'
    if (s >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-dc-panel border border-dc-border rounded-lg w-[500px] max-h-[80vh] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-dc-border">
        <h2 className="text-lg font-medium text-dc-text">评分详情 - {paramSetName}</h2>
        <button
          onClick={onClose}
          className="p-1 rounded text-dc-muted hover:text-dc-text hover:bg-dc-bg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
        {metrics.map((metric) => (
          <div key={metric.key} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-dc-text">{metric.label}</span>
              <span
                className={cn(
                  'text-sm font-bold font-mono',
                  getScoreTextColor(metric.value)
                )}
              >
                {metric.value.toFixed(1)}
              </span>
            </div>
            <div className="h-2 bg-dc-bg rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', getScoreColor(metric.value))}
                style={{ width: `${Math.min(100, metric.value)}%` }}
              />
            </div>
            <p className="text-xs text-dc-muted">{metric.explanation}</p>
          </div>
        ))}

        <div className="pt-4 border-t border-dc-border">
          <h3 className="text-sm font-medium text-dc-text mb-3">计算详情</h3>
          <pre className="bg-dc-bg border border-dc-border rounded-md p-4 text-xs text-dc-muted font-mono whitespace-pre-wrap overflow-x-auto">
            {score.details}
          </pre>
        </div>
      </div>

      <div className="p-4 border-t border-dc-border flex justify-end">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-dc-cold text-dc-bg rounded-md text-sm font-medium hover:bg-opacity-90 transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
    </div>
  )
}

function ScoreCard({
  side,
  derivedData,
  accentColor,
  onMetricClick,
}: {
  side: 'left' | 'right'
  derivedData: DerivedData | null
  accentColor: string
  onMetricClick: () => void
}) {
  if (!derivedData) {
    return (
      <div className="flex-1 bg-dc-panel border border-dc-border rounded-lg p-6 flex flex-col items-center justify-center min-h-[300px]">
        <div className="text-dc-muted text-sm">请选择参数方案</div>
      </div>
    )
  }

  const { score, paramSet } = derivedData

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-400'
    if (s >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getProgressColor = (s: number) => {
    if (s >= 80) return 'bg-green-500'
    if (s >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const metrics = [
    { key: 'coolingEfficiency', label: '制冷效率', value: score.coolingEfficiency },
    { key: 'hotspotCount', label: '热点控制', value: 100 - score.hotspotCount },
    { key: 'airflowUtilization', label: '气流利用率', value: score.airflowUtilization },
  ]

  return (
    <div
      className="flex-1 bg-dc-panel border rounded-lg p-6 space-y-6"
      style={{ borderColor: accentColor + '40' }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-dc-muted text-xs mb-1">{side === 'left' ? '方案 A' : '方案 B'}</div>
          <div className="text-dc-text font-medium">{paramSet.name} <span className="text-dc-muted text-xs">v{paramSet.version}</span></div>
          {paramSet.notes && <div className="text-dc-muted text-xs mt-0.5 truncate max-w-[160px]">{paramSet.notes}</div>}
        </div>
        <div
          onClick={onMetricClick}
          className="cursor-pointer text-right"
        >
          <div className={cn('text-5xl font-bold font-mono', getScoreColor(score.overallScore))}>
            {score.overallScore}
          </div>
          <div className="text-dc-muted text-xs mt-1">综合评分</div>
        </div>
      </div>

      <div className="space-y-4">
        {metrics.map((metric) => (
          <div
            key={metric.key}
            className="space-y-2 cursor-pointer hover:bg-dc-bg rounded p-2 -mx-2 transition-colors"
            onClick={onMetricClick}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm text-dc-text">{metric.label}</span>
              <span className={cn('text-sm font-mono font-medium', getScoreColor(metric.value))}>
                {metric.value.toFixed(1)}
              </span>
            </div>
            <div className="h-2 bg-dc-bg rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', getProgressColor(metric.value))}
                style={{ width: `${Math.min(100, metric.value)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 pt-2 border-t border-dc-border">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <span className="text-xs text-dc-muted">
            {derivedData.anomalies.filter(a => a.severity === 'critical').length} 严重
          </span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-orange-500" />
          <span className="text-xs text-dc-muted">
            {derivedData.anomalies.filter(a => a.severity === 'warning').length} 警告
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-blue-500" />
          <span className="text-xs text-dc-muted">
            {derivedData.anomalies.filter(a => a.severity === 'info').length} 信息
          </span>
        </div>
      </div>
    </div>
  )
}

export default function Compare() {
  const { savedParamSets, compareLeftId, compareRightId, setCompareIds } = useStore()
  const [syncViews, setSyncViews] = useState(false)
  const [scoreModalData, setScoreModalData] = useState<{
    side: 'left' | 'right'
    score: CompareScore
    paramSetName: string
  } | null>(null)

  const leftSceneRef = useRef<ReadOnlySceneRef>(null)
  const rightSceneRef = useRef<ReadOnlySceneRef>(null)

  const leftDerived = useMemo<DerivedData | null>(() => {
    if (!compareLeftId) return null
    const ps = savedParamSets.find(s => s.id === compareLeftId)
    if (!ps) return null
    const airflowSamples = computeAirflowSamples(ps)
    const anomalies = detectAnomalies(ps, airflowSamples)
    const score = computeScore(ps, anomalies)
    return { paramSet: ps, anomalies, airflowSamples, score }
  }, [compareLeftId, savedParamSets])

  const rightDerived = useMemo<DerivedData | null>(() => {
    if (!compareRightId) return null
    const ps = savedParamSets.find(s => s.id === compareRightId)
    if (!ps) return null
    const airflowSamples = computeAirflowSamples(ps)
    const anomalies = detectAnomalies(ps, airflowSamples)
    const score = computeScore(ps, anomalies)
    return { paramSet: ps, anomalies, airflowSamples, score }
  }, [compareRightId, savedParamSets])

  const handleLeftChange = (id: string) => {
    setCompareIds(id || null, compareRightId)
  }

  const handleRightChange = (id: string) => {
    setCompareIds(compareLeftId, id || null)
  }

  useEffect(() => {
    if (!syncViews) return

    const leftControls = leftSceneRef.current?.controls
    const rightControls = rightSceneRef.current?.controls
    if (!leftControls || !rightControls) return

    let isSyncing = false

    const syncLeftToRight = () => {
      if (isSyncing) return
      isSyncing = true
      rightControls.object.position.copy(leftControls.object.position)
      rightControls.target.copy(leftControls.target)
      rightControls.update()
      isSyncing = false
    }

    const syncRightToLeft = () => {
      if (isSyncing) return
      isSyncing = true
      leftControls.object.position.copy(rightControls.object.position)
      leftControls.target.copy(rightControls.target)
      leftControls.update()
      isSyncing = false
    }

    leftControls.addEventListener('change', syncLeftToRight)
    rightControls.addEventListener('change', syncRightToLeft)

    return () => {
      leftControls.removeEventListener('change', syncLeftToRight)
      rightControls.removeEventListener('change', syncRightToLeft)
    }
  }, [syncViews, leftDerived, rightDerived])

  return (
    <div className="w-full h-screen flex flex-col bg-dc-bg">
      <TopNavbar />
      <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-dc-cold" />
            <h1 className="text-lg font-medium text-dc-text">方案对比</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-dc-muted">同步视角</span>
            <button
              onClick={() => setSyncViews(!syncViews)}
              className={cn(
                'relative w-12 h-6 rounded-full transition-colors',
                syncViews ? 'bg-dc-cold' : 'bg-dc-border'
              )}
            >
              <div
                className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                  syncViews ? 'left-7' : 'left-1'
                )}
              />
            </button>
          </div>
        </div>

        <div className="flex-1 flex gap-4 min-h-0">
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: '#00d4ff' }}
              />
              <select
                value={compareLeftId || ''}
                onChange={(e) => handleLeftChange(e.target.value)}
                className="flex-1 bg-dc-panel border border-dc-border rounded-md px-3 py-2 text-sm text-dc-text focus:outline-none focus:border-dc-cold"
              >
                <option value="">选择方案 A...</option>
                {savedParamSets.map((ps) => (
                  <option key={ps.id} value={ps.id}>{ps.name} v{ps.version}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 rounded-lg overflow-hidden border" style={{ borderColor: '#00d4ff40' }}>
              {leftDerived ? (
                <ReadOnlyScene
                  ref={leftSceneRef}
                  paramSet={leftDerived.paramSet}
                  anomalies={leftDerived.anomalies}
                  airflowSamples={leftDerived.airflowSamples}
                  score={leftDerived.score}
                  accentColor="#00d4ff"
                />
              ) : (
                <div className="w-full h-full bg-dc-panel flex items-center justify-center">
                  <div className="text-dc-muted text-sm">请选择参数方案</div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: '#ff6b35' }}
              />
              <select
                value={compareRightId || ''}
                onChange={(e) => handleRightChange(e.target.value)}
                className="flex-1 bg-dc-panel border border-dc-border rounded-md px-3 py-2 text-sm text-dc-text focus:outline-none focus:border-dc-hot"
              >
                <option value="">选择方案 B...</option>
                {savedParamSets.map((ps) => (
                  <option key={ps.id} value={ps.id}>{ps.name} v{ps.version}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 rounded-lg overflow-hidden border" style={{ borderColor: '#ff6b3540' }}>
              {rightDerived ? (
                <ReadOnlyScene
                  ref={rightSceneRef}
                  paramSet={rightDerived.paramSet}
                  anomalies={rightDerived.anomalies}
                  airflowSamples={rightDerived.airflowSamples}
                  score={rightDerived.score}
                  accentColor="#ff6b35"
                />
              ) : (
                <div className="w-full h-full bg-dc-panel flex items-center justify-center">
                  <div className="text-dc-muted text-sm">请选择参数方案</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <ScoreCard
            side="left"
            derivedData={leftDerived}
            accentColor="#00d4ff"
            onMetricClick={() => leftDerived && setScoreModalData({
              side: 'left', score: leftDerived.score, paramSetName: leftDerived.paramSet.name })}
          />
          <ScoreCard
            side="right"
            derivedData={rightDerived}
            accentColor="#ff6b35"
            onMetricClick={() => rightDerived && setScoreModalData({
              side: 'right', score: rightDerived.score, paramSetName: rightDerived.paramSet.name })}
          />
        </div>
      </div>

      {scoreModalData && (
        <CompareScoreDetailModal
          isOpen={!!scoreModalData}
          onClose={() => setScoreModalData(null)}
          score={scoreModalData.score}
          paramSetName={scoreModalData.paramSetName}
        />
      )}
    </div>
  )
}
