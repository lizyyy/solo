import { useState } from "react"
import { Link } from "lucide-react"
import { useStore } from "@/store/useStore"

interface Props {
  sourceRef: string
  label?: string
}

export default function SourceLink({ sourceRef, label = "来源" }: Props) {
  const [showTooltip, setShowTooltip] = useState(false)

  const handleClick = () => {
    alert(`溯源跳转: ${sourceRef}`)
    console.log("Navigate to source:", sourceRef)
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors font-mono"
      >
        <Link size={12} />
        <span className="underline decoration-dotted">{label}</span>
      </button>
      {showTooltip && (
        <div className="absolute left-0 top-full mt-1 px-2 py-1 bg-gray-800 text-xs text-gray-300 rounded shadow-lg whitespace-nowrap z-50 font-mono">
          {sourceRef}
        </div>
      )}
    </div>
  )
}
