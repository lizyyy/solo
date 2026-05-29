import { useState } from 'react'
import { Database, ArrowRightLeft, FileBarChart, Globe, AlertTriangle } from 'lucide-react'
import { useScanStore } from '@/store/useScanStore'
import type { ImpactResult } from '@/types'
import SeverityBadge from './SeverityBadge'

const typeIconMap = {
  field: Database,
  etl: ArrowRightLeft,
  report: FileBarChart,
  api: Globe,
}

const typeLabelMap = {
  field: '字段',
  etl: 'ETL',
  report: '报表',
  api: 'API',
}

const borderColorMap = {
  high: 'border-danger',
  medium: 'border-warn',
  low: 'border-safe',
}

interface ImpactCardProps {
  result: ImpactResult
}

function ImpactCard({ result }: ImpactCardProps) {
  const [expanded, setExpanded] = useState(false)
  const TypeIcon = typeIconMap[result.nodeType]

  return (
    <div className={`border-l-4 ${borderColorMap[result.severity]} p-4 bg-base-700 rounded-r mb-2`}>
      <div className="flex items-start justify-between mb-2">
        <span className="font-mono text-white text-base">{result.label}</span>
        <SeverityBadge severity={result.severity} />
      </div>
      <div className="flex items-center gap-2 text-muted text-sm">
        <TypeIcon size={14} />
        <span>{typeLabelMap[result.nodeType]}</span>
        <span>·</span>
        <span>{result.reason}</span>
      </div>
      {result.path.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-accent hover:text-accent/80 mt-2"
        >
          {expanded ? '收起路径' : '展开路径'}
        </button>
      )}
      {expanded && result.path.length > 0 && (
        <div className="mt-2 text-sm text-muted font-mono bg-base-800 p-2 rounded">
          {result.path.join(' → ')}
        </div>
      )}
    </div>
  )
}

export default function ImpactTree() {
  const { results, hasScanned } = useScanStore()

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <h2 className="font-mono text-lg text-white mb-4">影响范围</h2>

      {hasScanned && results.length === 0 && (
        <div className="text-danger text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>未找到匹配字段，建议检查别名页面确认字段别名配置</span>
        </div>
      )}

      {results.length > 0 && (
        <div>
          {results.map((result) => (
            <ImpactCard key={result.nodeId} result={result} />
          ))}
        </div>
      )}
    </div>
  )
}
