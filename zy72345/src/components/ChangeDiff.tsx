interface ChangeDiffProps {
  oldText: string
  newText: string
}

export default function ChangeDiff({ oldText, newText }: ChangeDiffProps) {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')

  return (
    <div className="rounded-lg border border-slate-700/50 overflow-hidden text-sm font-mono">
      <div className="grid grid-cols-2">
        <div className="bg-slate-800/30 border-r border-slate-700/50">
          <div className="px-3 py-1.5 bg-slate-800/50 text-slate-500 text-xs border-b border-slate-700/50">修改前</div>
          {oldLines.map((line, i) => (
            <div key={i} className="px-3 py-1 diff-remove">{line || '\u00A0'}</div>
          ))}
        </div>
        <div>
          <div className="px-3 py-1.5 bg-slate-800/50 text-slate-500 text-xs border-b border-slate-700/50">修改后</div>
          {newLines.map((line, i) => (
            <div key={i} className="px-3 py-1 diff-add">{line || '\u00A0'}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
