import { useRef } from "react"
import html2canvas from "html2canvas"
import { Camera } from "lucide-react"

interface Props {
  targetRef: React.RefObject<HTMLDivElement | null>
}

export default function ScreenshotBtn({ targetRef }: Props) {
  const taking = useRef(false)

  const handleScreenshot = async () => {
    if (taking.current || !targetRef.current) return
    taking.current = true

    try {
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: "#0A1628",
        scale: 2,
      })

      const link = document.createElement("a")
      link.download = `maglev_${Date.now()}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    } catch (err) {
      console.error("截图失败:", err)
    } finally {
      taking.current = false
    }
  }

  return (
    <button
      onClick={handleScreenshot}
      className="flex items-center gap-2 px-4 py-2 bg-[#0D1F3C] border border-[#1A3A5C] rounded-lg
        text-[#00E5CC] text-xs font-medium hover:bg-[#00E5CC]/10 hover:border-[#00E5CC]/30
        transition-all duration-200"
    >
      <Camera size={14} />
      截图导出
    </button>
  )
}
