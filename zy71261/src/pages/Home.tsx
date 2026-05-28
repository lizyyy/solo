import { useEffect } from "react"
import { useTermWallStore } from "@/store/useTermWallStore"
import WallScene from "@/components/3d/WallScene"
import Toolbar from "@/components/ui/Toolbar"
import FilterPanel from "@/components/ui/FilterPanel"
import DataPanel from "@/components/ui/DataPanel"
import LegendBar from "@/components/ui/LegendBar"
import DrillDownModal from "@/components/ui/DrillDownModal"
import MonthSliceView from "@/components/ui/MonthSliceView"

export default function Home() {
  const initializeData = useTermWallStore((s) => s.initializeData)
  const dataLoaded = useTermWallStore((s) => s.dataLoaded)

  useEffect(() => {
    initializeData()
  }, [initializeData])

  if (!dataLoaded) {
    return (
      <div className="h-screen w-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-slate-400 font-mono text-sm animate-pulse">
          加载持仓数据...
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-[#0a0e1a] flex flex-col overflow-hidden">
      <Toolbar />
      <div className="flex-1 flex overflow-hidden" style={{ paddingTop: 48, paddingBottom: 32 }}>
        <FilterPanel />
        <div className="flex-1 relative">
          <WallScene />
        </div>
        <DataPanel />
      </div>
      <LegendBar />
      <DrillDownModal />
      <MonthSliceView />
    </div>
  )
}
