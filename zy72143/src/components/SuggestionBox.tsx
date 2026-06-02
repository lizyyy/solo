import { Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SuggestionBoxProps {
  suggestion: string | null
  className?: string
}

export default function SuggestionBox({ suggestion, className }: SuggestionBoxProps) {
  if (!suggestion) return null

  return (
    <div
      className={cn(
        'rounded-lg border-l-4 border-amber-500 bg-amber-500/5 p-4',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-sm leading-relaxed text-amber-200/90">{suggestion}</p>
      </div>
    </div>
  )
}
