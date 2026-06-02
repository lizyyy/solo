import TrailMap from '@/components/TrailMap'
import Sidebar from '@/components/Sidebar'
import ConflictBanner from '@/components/ConflictBanner'
import DetailPanel from '@/components/DetailPanel'
import { useTrailStore } from '@/store/useStore'
import { Download } from 'lucide-react'

export default function Home() {
  const exportReport = useTrailStore((s) => s.exportReport)

  const handleExport = () => {
    const report = exportReport()
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `河岸步道拥挤监测报告_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f7f3e9]">
      <div className="flex-1 relative flex flex-col">
        <header className="flex items-center justify-between px-4 py-2 bg-[#1a535c] text-white">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-wide">河岸步道拥挤监测</h1>
            <span className="text-xs text-white/70">社区运营看板</span>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-sm transition-colors"
          >
            <Download size={14} />
            导出报告
          </button>
        </header>
        <div className="flex-1">
          <TrailMap />
        </div>
      </div>

      <div className="w-[380px] flex flex-col border-l border-stone-200">
        <div className="p-3">
          <ConflictBanner />
        </div>
        <div className="flex-1 overflow-hidden">
          <Sidebar />
        </div>
      </div>

      <DetailPanel />
    </div>
  )
}
