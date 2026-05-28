import { useExposureStore } from '@/store/exposureStore'
import { useSnapshotStore } from '@/store/snapshotStore'
import { captureScreenshot, downloadScreenshot, exportPDF, exportExcel } from '@/utils/exportUtils'
import { calcSummary } from '@/utils/hedgingCalc'
import { Camera, FileDown, FileSpreadsheet, Save } from 'lucide-react'
import type { Snapshot } from '@/types'

export default function ExportBar() {
  const exposures = useExposureStore((s) => s.exposures)
  const hedgeContracts = useExposureStore((s) => s.hedgeContracts)
  const anomalies = useExposureStore((s) => s.anomalies)
  const saveSnapshot = useSnapshotStore((s) => s.saveSnapshot)

  const handleScreenshot = async () => {
    try {
      const dataUrl = await captureScreenshot('tree-3d-scene')
      downloadScreenshot(dataUrl, `fx-exposure-${Date.now()}.png`)
    } catch (err) {
      console.error('截图失败', err)
    }
  }

  const handlePDF = async () => {
    try {
      const screenshotUrl = await captureScreenshot('tree-3d-scene')
      const summary = calcSummary(exposures, hedgeContracts)
      exportPDF(screenshotUrl, summary, exposures, hedgeContracts, anomalies)
    } catch (err) {
      console.error('PDF导出失败', err)
    }
  }

  const handleExcel = () => {
    exportExcel(exposures, hedgeContracts, anomalies)
  }

  const handleSaveSnapshot = async () => {
    const state = useExposureStore.getState()
    const snap: Snapshot = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
      createdAt: new Date().toISOString(),
      createdBy: '当前用户',
      summary: `敞口${state.exposures.length}条 套保${state.hedgeContracts.length}条 异常${state.anomalies.length}条`,
      cameraState: { position: [0, 10, 14], target: [0, 0, 0] },
      filterState: {
        currencies: state.selectedCurrencies,
        subsidiaryCodes: state.selectedSubsidiaryCodes,
        directions: state.selectedDirections,
      },
      subsidiaries: state.subsidiaries,
      currencies: state.currencies,
      exposures: state.exposures,
      hedgeContracts: state.hedgeContracts,
      exchangeRates: state.exchangeRates,
      anomalies: state.anomalies,
    }
    await saveSnapshot(snap)
  }

  return (
    <div className="flex items-center gap-3">
      <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={handleScreenshot}>
        <Camera size={14} />
        截图
      </button>
      <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={handlePDF}>
        <FileDown size={14} />
        PDF
      </button>
      <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={handleExcel}>
        <FileSpreadsheet size={14} />
        Excel
      </button>
      <button className="btn-primary text-xs flex items-center gap-1.5" onClick={handleSaveSnapshot}>
        <Save size={14} />
        保存快照
      </button>
    </div>
  )
}
