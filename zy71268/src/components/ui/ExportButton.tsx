import { useState, type RefObject } from 'react'
import { Camera, Check } from 'lucide-react'

interface ExportButtonProps {
  canvasRef?: RefObject<HTMLCanvasElement | null>
}

export default function ExportButton({ canvasRef }: ExportButtonProps) {
  const [exported, setExported] = useState(false)

  const handleExport = () => {
    const canvas = canvasRef?.current
    if (!canvas) return

    try {
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `sculpture-cog-${Date.now()}.png`
      link.href = dataUrl
      link.click()
      setExported(true)
      setTimeout(() => setExported(false), 2000)
    } catch {
      // canvas cross-origin or not available
    }
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
    >
      {exported ? (
        <>
          <Check className="w-4 h-4 text-green-400" />
          <span className="text-green-400">已导出</span>
        </>
      ) : (
        <>
          <Camera className="w-4 h-4" />
          导出
        </>
      )}
    </button>
  )
}
