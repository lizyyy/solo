import { useMemo } from 'react'
import { useOrbitalStore } from '@/store/useOrbitalStore'
import { getOrbital } from '@/data/molecules'
import { generateSectionCanvas } from '@/utils/orbitalGeometry'

export default function SectionView() {
  const currentMoleculeId = useOrbitalStore((s) => s.currentMoleculeId)
  const currentOrbitalId = useOrbitalStore((s) => s.currentOrbitalId)
  const sectionPosition = useOrbitalStore((s) => s.sectionPosition)
  const sectionAxis = useOrbitalStore((s) => s.sectionAxis)
  const showSection = useOrbitalStore((s) => s.showSection)

  const sectionDataUrl = useMemo(() => {
    if (!showSection) return ''
    const orbital = getOrbital(currentMoleculeId, currentOrbitalId)
    if (!orbital) return ''
    return generateSectionCanvas(orbital.shape, sectionAxis, sectionPosition)
  }, [showSection, currentMoleculeId, currentOrbitalId, sectionAxis, sectionPosition])

  const axisLabel = sectionAxis.toUpperCase()

  if (!showSection) {
    return (
      <div className="flex items-center justify-center h-32 p-3 bg-lab-panel rounded-lg border border-lab-border">
        <span className="text-xs text-lab-muted font-mono">
          开启截面查看2D等值线图
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-lab-panel rounded-lg border border-lab-border">
      <div className="text-xs font-mono text-lab-muted">
        {axisLabel}轴截面 <span className="text-lab-glow">@ {sectionPosition.toFixed(2)}</span>
      </div>
      {sectionDataUrl && (
        <img
          src={sectionDataUrl}
          alt={`${axisLabel}轴截面 @ ${sectionPosition.toFixed(2)}`}
          className="w-full border border-lab-border rounded"
        />
      )}
    </div>
  )
}
