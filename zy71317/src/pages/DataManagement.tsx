import { useEffect } from "react"
import { useExperimentStore } from "@/store/useExperimentStore"
import DataImport from "@/components/DataImport"
import AnomalyFilter from "@/components/AnomalyFilter"
import DataTable from "@/components/DataTable"
import { Link } from "react-router-dom"
import { ArrowLeft, Cpu } from "lucide-react"

export default function DataManagement() {
  const loadAllRecords = useExperimentStore((s) => s.loadAllRecords)

  useEffect(() => {
    loadAllRecords()
  }, [])

  return (
    <div className="min-h-screen bg-[#0A1628] text-white">
      <header className="border-b border-[#1A3A5C] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-1.5 bg-[#0D1F3C] border border-[#1A3A5C] rounded-lg
              text-[#8899AA] text-xs hover:text-[#00E5CC] hover:border-[#00E5CC]/30 transition-all"
          >
            <ArrowLeft size={14} />
            返回控制台
          </Link>
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-[#00E5CC]" />
            <h1 className="text-sm font-bold tracking-wider" style={{ fontFamily: "Orbitron, monospace" }}>
              DATA MANAGEMENT
            </h1>
          </div>
        </div>
        <p className="text-[10px] text-[#556677]">数据管理 · 导入 · 筛选 · 导出</p>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1">
            <DataImport />
          </div>
          <div className="col-span-2">
            <AnomalyFilter />
          </div>
        </div>

        <DataTable />
      </div>
    </div>
  )
}
