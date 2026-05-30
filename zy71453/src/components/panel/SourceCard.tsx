import type { DataSource } from '../../utils/types'

export default function SourceCard({
  source,
  rawValue,
}: {
  source: DataSource
  rawValue?: string
}) {
  const displayValue = rawValue ?? source.rawValue

  return (
    <div className="rounded-lg border-l-2 border-l-[#00f0ff] bg-[#111827] p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500">文件:</span>
        <span className="text-xs text-gray-300">{source.file}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500">行号:</span>
        <span className="text-xs text-gray-300">{source.line}</span>
      </div>
      {displayValue && (
        <div className="space-y-1">
          <span className="text-[10px] text-gray-500">原始值:</span>
          <pre className="rounded bg-[#0a0e1a] p-2 text-[11px] text-[#00f0ff] font-mono overflow-x-auto whitespace-pre-wrap">
            {displayValue}
          </pre>
        </div>
      )}
    </div>
  )
}
