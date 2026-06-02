import { useNavigate } from "react-router-dom"
import { FileDown } from "lucide-react"
import StatsBar from "@/components/StatsBar"
import FilterPanel from "@/components/FilterPanel"
import AlertMap from "@/components/AlertMap"

export default function MapPage() {
  const navigate = useNavigate()

  function handleViewDetail(id: string) {
    navigate(`/alert/${id}`)
  }

  return (
    <div className="flex flex-col h-screen bg-[#1a1a2e]">
      <StatsBar />
      <div className="flex flex-1 min-h-0 relative">
        <FilterPanel />
        <AlertMap onViewDetail={handleViewDetail} />
        <button
          onClick={() => navigate("/export")}
          className="absolute bottom-6 right-6 z-[1000] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4a90d9] text-white text-sm font-medium shadow-lg shadow-[#4a90d9]/25 hover:bg-[#4a90d9]/80 transition-all"
        >
          <FileDown size={16} />
          导出预警数据
        </button>
      </div>
    </div>
  )
}
