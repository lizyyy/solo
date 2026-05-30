import { useState } from "react"
import { RiskTower3D } from "@/components/RiskTower3D"
import FilterPanel from "@/components/FilterPanel"
import DetailSidebar from "@/components/DetailSidebar"
import Toolbar from "@/components/Toolbar"
import AuditTimeline from "@/components/AuditTimeline"

export default function RiskTower() {
  const [auditOpen, setAuditOpen] = useState(false)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0a0e17]">
      <Toolbar auditOpen={auditOpen} onToggleAudit={() => setAuditOpen((v) => !v)} />
      <div className="flex flex-1 min-h-0">
        <FilterPanel />
        <div className="relative flex-1 min-w-0">
          <RiskTower3D />
        </div>
        <DetailSidebar />
      </div>
      <AuditTimeline open={auditOpen} onClose={() => setAuditOpen(false)} />
    </div>
  )
}
