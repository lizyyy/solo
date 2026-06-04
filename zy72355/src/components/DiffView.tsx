interface DiffViewProps {
  oldValue: string
  newValue: string
}

function computeDiff(oldStr: string, newStr: string): { type: 'equal' | 'added' | 'removed'; text: string }[] {
  const oldParts = oldStr.split('')
  const newParts = newStr.split('')
  const result: { type: 'equal' | 'added' | 'removed'; text: string }[] = []

  let oi = 0
  let ni = 0

  while (oi < oldParts.length || ni < newParts.length) {
    if (oi < oldParts.length && ni < newParts.length && oldParts[oi] === newParts[ni]) {
      result.push({ type: 'equal', text: oldParts[oi] })
      oi++
      ni++
    } else if (oi < oldParts.length && (ni >= newParts.length || oldParts[oi] !== newParts[ni])) {
      let removedRun = ''
      while (oi < oldParts.length && (ni >= newParts.length || oldParts[oi] !== newParts[ni])) {
        removedRun += oldParts[oi]
        oi++
      }
      result.push({ type: 'removed', text: removedRun })
    } else if (ni < newParts.length) {
      let addedRun = ''
      while (ni < newParts.length && (oi >= oldParts.length || oldParts[oi] !== newParts[ni])) {
        addedRun += newParts[ni]
        ni++
      }
      result.push({ type: 'added', text: addedRun })
    }
  }

  return result
}

export default function DiffView({ oldValue, newValue }: DiffViewProps) {
  if (oldValue === newValue) {
    return <span className="text-zinc-500">{newValue || '（空）'}</span>
  }

  const diff = computeDiff(oldValue, newValue)

  return (
    <span>
      {diff.map((part, i) => {
        if (part.type === 'equal') return <span key={i}>{part.text}</span>
        if (part.type === 'removed') return <span key={i} className="bg-red-100 text-red-700 line-through">{part.text}</span>
        if (part.type === 'added') return <span key={i} className="bg-emerald-100 text-emerald-700">{part.text}</span>
        return null
      })}
    </span>
  )
}
