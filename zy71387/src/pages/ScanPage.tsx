import ScanInput from '@/components/scan/ScanInput'
import ImpactTree from '@/components/scan/ImpactTree'
import { useLineageStore } from '@/store/useLineageStore'
import { useScanStore } from '@/store/useScanStore'

export default function ScanPage() {
  const { nodes, edges } = useLineageStore()
  const { executeScan } = useScanStore()

  const handleScan = () => {
    executeScan(nodes, edges)
  }

  return (
    <div className="h-full flex bg-base-900">
      <ScanInput onScan={handleScan} />
      <ImpactTree />
    </div>
  )
}
