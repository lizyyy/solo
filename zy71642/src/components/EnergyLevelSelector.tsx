import { useMemo } from 'react'
import { useOrbitalStore } from '@/store/useOrbitalStore'
import { getMolecule } from '@/data/molecules'
import type { BondingType } from '@/data/molecules'

const BONDING_COLORS: Record<BondingType, string> = {
  bonding: '#00ffd5',
  antibonding: '#ff9f1c',
  nonbonding: '#8b5cf6',
}

const BONDING_BG: Record<BondingType, string> = {
  bonding: 'rgba(0,255,213,0.15)',
  antibonding: 'rgba(255,159,28,0.15)',
  nonbonding: 'rgba(139,92,246,0.15)',
}

const BONDING_LABEL: Record<BondingType, string> = {
  bonding: '成键',
  antibonding: '反键',
  nonbonding: '非键',
}

function ElectronDots({ count }: { count: number }) {
  const dots = []
  for (let i = 0; i < count; i++) {
    dots.push(
      <span
        key={i}
        className="inline-block w-1.5 h-1.5 rounded-full bg-current ml-0.5"
        style={{ boxShadow: '0 0 4px currentColor' }}
      />
    )
  }
  return <span className="flex items-center gap-0">{dots}</span>
}

export default function EnergyLevelSelector() {
  const currentMoleculeId = useOrbitalStore((s) => s.currentMoleculeId)
  const currentOrbitalId = useOrbitalStore((s) => s.currentOrbitalId)
  const setCurrentOrbital = useOrbitalStore((s) => s.setCurrentOrbital)

  const molecule = useMemo(() => getMolecule(currentMoleculeId), [currentMoleculeId])

  const orderedOrbitals = useMemo(() => {
    if (!molecule) return []
    return molecule.energyOrder
      .map((id) => molecule.orbitals.find((o) => o.id === id))
      .filter(Boolean)
  }, [molecule])

  if (!molecule || orderedOrbitals.length === 0) return null

  return (
    <div className="flex flex-col h-full bg-lab-bg overflow-hidden">
      <div className="px-3 py-2 border-b border-lab-border bg-lab-surface shrink-0">
        <h3 className="text-xs font-mono text-lab-muted tracking-widest">
          {molecule.formula} — 能级图
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto py-2" style={{ minHeight: 0 }}>
        <div className="flex flex-col gap-1 px-2">
          {orderedOrbitals.map((orbital) => {
            if (!orbital) return null
            const isSelected = orbital.id === currentOrbitalId
            const color = BONDING_COLORS[orbital.bondingType]
            const bgColor = BONDING_BG[orbital.bondingType]
            const isLeft = orbital.bondingType === 'bonding' || orbital.bondingType === 'nonbonding'

            return (
              <button
                key={orbital.id}
                onClick={() => setCurrentOrbital(orbital.id)}
                className="w-full flex items-center transition-all duration-200 cursor-pointer"
              >
                <div className="w-full flex items-center gap-1.5">
                  {isLeft ? (
                    <>
                      <div
                        className="flex items-center justify-between flex-1 h-7 px-2 rounded font-mono text-xs transition-all duration-200"
                        style={{
                          backgroundColor: isSelected ? bgColor : 'transparent',
                          border: `1px solid ${isSelected ? color : 'transparent'}`,
                          color: isSelected ? color : '#94a3b8',
                          boxShadow: isSelected
                            ? `0 0 12px ${color}40, 0 0 4px ${color}30, inset 0 0 8px ${color}10`
                            : 'none',
                        }}
                      >
                        <span className="truncate text-[11px]">{orbital.label}</span>
                        <span className="flex items-center shrink-0" style={{ color: color }}>
                          <ElectronDots count={orbital.electronCount} />
                        </span>
                      </div>
                      <div className="w-px h-7 bg-lab-border shrink-0" />
                      <div className="w-24 shrink-0" />
                    </>
                  ) : (
                    <>
                      <div className="w-24 shrink-0" />
                      <div className="w-px h-7 bg-lab-border shrink-0" />
                      <div
                        className="flex items-center justify-between flex-1 h-7 px-2 rounded font-mono text-xs transition-all duration-200"
                        style={{
                          backgroundColor: isSelected ? bgColor : 'transparent',
                          border: `1px solid ${isSelected ? color : 'transparent'}`,
                          color: isSelected ? color : '#94a3b8',
                          boxShadow: isSelected
                            ? `0 0 12px ${color}40, 0 0 4px ${color}30, inset 0 0 8px ${color}10`
                            : 'none',
                        }}
                      >
                        <span className="truncate text-[11px]">{orbital.label}</span>
                        <span className="flex items-center shrink-0" style={{ color: color }}>
                          <ElectronDots count={orbital.electronCount} />
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-3 py-1.5 border-t border-lab-border bg-lab-surface flex items-center gap-3 text-[9px] font-mono shrink-0">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: BONDING_COLORS.bonding }} />
          <span className="text-lab-muted">成键</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: BONDING_COLORS.antibonding }} />
          <span className="text-lab-muted">反键</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: BONDING_COLORS.nonbonding }} />
          <span className="text-lab-muted">非键</span>
        </span>
      </div>
    </div>
  )
}
