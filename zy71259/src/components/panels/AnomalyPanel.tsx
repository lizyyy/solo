import { useState } from 'react'
import { useExposureStore } from '@/store/exposureStore'
import { AlertTriangle, ChevronDown, ChevronUp, Check, X } from 'lucide-react'
import type { Anomaly } from '@/types'

const typeLabels: Record<Anomaly['type'], string> = {
  TRANSLATION_ERROR: '币种折算错',
  DUPLICATE_HEDGE: '套保重复',
  CONSOLIDATION_OMISSION: '子公司合并遗漏',
}

const severityColors: Record<Anomaly['severity'], string> = {
  HIGH: 'border-accent-red/50 bg-accent-red/5',
  MEDIUM: 'border-accent-gold/50 bg-accent-gold/5',
  LOW: 'border-accent-blue/50 bg-accent-blue/5',
}

const severityLabels: Record<Anomaly['severity'], string> = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
}

export default function AnomalyPanel() {
  const anomalies = useExposureStore((s) => s.anomalies)
  const updateAnomalyResolution = useExposureStore((s) => s.updateAnomalyResolution)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  if (anomalies.length === 0) {
    return (
      <div className="text-center text-txt-muted py-6 text-sm">
        <Check size={24} className="mx-auto mb-2 text-accent-green" />
        未检测到异常
      </div>
    )
  }

  const grouped = {
    TRANSLATION_ERROR: anomalies.filter((a) => a.type === 'TRANSLATION_ERROR'),
    DUPLICATE_HEDGE: anomalies.filter((a) => a.type === 'DUPLICATE_HEDGE'),
    CONSOLIDATION_OMISSION: anomalies.filter((a) => a.type === 'CONSOLIDATION_OMISSION'),
  }

  return (
    <div className="space-y-3">
      {(Object.entries(grouped) as [Anomaly['type'], Anomaly[]][]).map(([type, items]) =>
        items.length > 0 && (
          <div key={type}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className={type === 'TRANSLATION_ERROR' ? 'text-accent-red' : type === 'DUPLICATE_HEDGE' ? 'text-accent-gold' : 'text-accent-blue'} />
              <span className="text-xs font-medium text-txt-primary">{typeLabels[type]}</span>
              <span className="text-xs text-txt-muted">({items.length})</span>
            </div>
            <div className="space-y-2">
              {items.map((anomaly) => (
                <div
                  key={anomaly.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${severityColors[anomaly.severity]} ${anomaly.resolution !== 'UNRESOLVED' ? 'opacity-60' : ''}`}
                  onClick={() => setExpandedId(expandedId === anomaly.id ? null : anomaly.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${anomaly.severity === 'HIGH' ? 'bg-accent-red/20 text-accent-red' : anomaly.severity === 'MEDIUM' ? 'bg-accent-gold/20 text-accent-gold' : 'bg-accent-blue/20 text-accent-blue'}`}>
                          {severityLabels[anomaly.severity]}
                        </span>
                        {anomaly.resolution !== 'UNRESOLVED' && (
                          <span className="text-xs text-accent-green">✓ {anomaly.resolution === 'CONFIRMED' ? '已确认' : '已修复'}</span>
                        )}
                      </div>
                      <p className="text-xs text-txt-primary leading-relaxed">{anomaly.description}</p>
                    </div>
                    {expandedId === anomaly.id ? <ChevronUp size={14} className="text-txt-muted" /> : <ChevronDown size={14} className="text-txt-muted" />}
                  </div>
                  {expandedId === anomaly.id && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-2" onClick={(e) => e.stopPropagation()}>
                      {anomaly.userNote && (
                        <div className="text-xs text-txt-secondary">当前解释: {anomaly.userNote}</div>
                      )}
                      <div className="flex gap-2">
                        <input
                          className="flex-1 bg-deep border border-border rounded px-2 py-1 text-xs text-txt-primary outline-none focus:border-accent-green"
                          placeholder="添加解释说明..."
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="btn-primary text-xs py-1 px-3"
                          onClick={() => { updateAnomalyResolution(anomaly.id, 'CONFIRMED', noteText); setNoteText('') }}
                        >
                          确认
                        </button>
                        <button
                          className="btn-secondary text-xs py-1 px-3"
                          onClick={() => { updateAnomalyResolution(anomaly.id, 'FIXED', noteText); setNoteText('') }}
                        >
                          已修复
                        </button>
                        <button
                          className="btn-secondary text-xs py-1 px-3"
                          onClick={() => { updateAnomalyResolution(anomaly.id, 'UNRESOLVED', noteText); setNoteText('') }}
                        >
                          重置
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}
