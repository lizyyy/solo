import type { CoordinateEntry } from '@/types'
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { useState, Fragment } from 'react'
import { cn } from '@/lib/utils'

const typeLabels: Record<string, { label: string; cls: string }> = {
  latlng: { label: '经纬度', cls: 'bg-status-blue/15 text-status-blue border-status-blue/30' },
  metric: { label: '米制', cls: 'bg-status-green/15 text-status-green border-status-green/30' },
  mixed: { label: '混用', cls: 'bg-accent/15 text-accent border-accent/30' },
}

function CorrectionDetail({ correction }: { correction: NonNullable<CoordinateEntry['manualCorrection']> }) {
  return (
    <div className="ml-6 mt-1 rounded border border-border bg-bg/50 p-3 text-xs text-text-secondary space-y-1">
      <p>修正人: <span className="text-text-primary data-font">{correction.correctedBy}</span></p>
      <p>修正时间: <span className="text-text-primary data-font">{correction.correctedAt}</span></p>
      <p>原因: <span className="text-text-primary">{correction.reason}</span></p>
    </div>
  )
}

interface CoordinateTableProps {
  coordinates: CoordinateEntry[]
}

export default function CoordinateTable({ coordinates }: CoordinateTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-secondary">
            <th className="pb-2 pr-4 font-medium">点位名称</th>
            <th className="pb-2 pr-4 font-medium">坐标类型</th>
            <th className="pb-2 pr-4 font-medium">经纬度</th>
            <th className="pb-2 pr-4 font-medium">米制坐标</th>
            <th className="pb-2 font-medium">人工修正</th>
          </tr>
        </thead>
        <tbody>
          {coordinates.map((coord) => {
            const isMixed = coord.coordinateType === 'mixed'
            const isOpen = expanded.has(coord.id)
            return (
              <Fragment key={coord.id}>
                <tr className={cn('border-b border-border/50', isMixed && 'border-l-2 border-l-accent')}>
                  <td className="py-2 pr-4 data-font">{coord.pointName}</td>
                  <td className="py-2 pr-4">
                    <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs border', typeLabels[coord.coordinateType]?.cls)}>
                      {isMixed && <AlertTriangle className="mr-1 h-3 w-3" />}
                      {typeLabels[coord.coordinateType]?.label ?? coord.coordinateType}
                    </span>
                  </td>
                  <td className="py-2 pr-4 data-font text-xs">
                    {coord.lat != null && coord.lng != null
                      ? `${coord.lat}, ${coord.lng}`
                      : '—'}
                  </td>
                  <td className="py-2 pr-4 data-font text-xs">
                    {coord.x != null && coord.y != null
                      ? `(${coord.x}, ${coord.y}${coord.z != null ? `, ${coord.z}` : ''})`
                      : '—'}
                  </td>
                  <td className="py-2">
                    {coord.manualCorrection ? (
                      <button
                        onClick={() => toggle(coord.id)}
                        className="flex items-center gap-1 text-accent hover:text-accent/80 text-xs"
                      >
                        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        已修正
                      </button>
                    ) : (
                      <span className="text-text-secondary">—</span>
                    )}
                  </td>
                </tr>
                {coord.manualCorrection && isOpen && (
                  <tr>
                    <td colSpan={5} className="pb-2">
                      <CorrectionDetail correction={coord.manualCorrection} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
