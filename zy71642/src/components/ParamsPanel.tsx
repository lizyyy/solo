import { useMemo } from 'react'
import { useOrbitalStore } from '@/store/useOrbitalStore'
import { getOrbital, getMolecule } from '@/data/molecules'
import type { BondingType } from '@/data/molecules'

const BONDING_LABEL: Record<BondingType, string> = {
  bonding: '成键',
  antibonding: '反键',
  nonbonding: '非键',
}

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

function ParamRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-lab-border/50 last:border-b-0">
      <span className="text-xs text-lab-muted">{label}</span>
      <span className="font-mono text-xs">{children}</span>
    </div>
  )
}

export default function ParamsPanel() {
  const currentMoleculeId = useOrbitalStore((s) => s.currentMoleculeId)
  const currentOrbitalId = useOrbitalStore((s) => s.currentOrbitalId)

  const molecule = useMemo(() => getMolecule(currentMoleculeId), [currentMoleculeId])
  const orbital = useMemo(
    () => getOrbital(currentMoleculeId, currentOrbitalId),
    [currentMoleculeId, currentOrbitalId]
  )

  if (!orbital) return null

  const bondingColor = BONDING_COLORS[orbital.bondingType]
  const bondingBg = BONDING_BG[orbital.bondingType]
  const bondingLabel = BONDING_LABEL[orbital.bondingType]

  return (
    <div className="flex flex-col gap-3 p-3 bg-lab-panel rounded-lg border border-lab-border">
      <label className="block text-xs font-mono text-lab-muted uppercase tracking-wider">
        轨道参数
      </label>

      <div className="space-y-0">
        <ParamRow label="轨道">
          <span className="text-lab-glow text-glow">{orbital.label}</span>
        </ParamRow>

        <ParamRow label="能量">
          <span className="text-lab-glow text-glow">{orbital.energy.toFixed(1)}</span>
          <span className="text-lab-muted ml-1">eV</span>
        </ParamRow>

        <ParamRow label="对称性">
          <span className="text-lab-text">{orbital.symmetry}</span>
        </ParamRow>

        <ParamRow label="键型">
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
            style={{
              color: bondingColor,
              backgroundColor: bondingBg,
              boxShadow: `0 0 8px ${bondingColor}30`,
            }}
          >
            {bondingLabel}
          </span>
        </ParamRow>

        <ParamRow label="节点数">
          <span className="text-lab-glow text-glow">{orbital.nodeCount}</span>
        </ParamRow>

        <ParamRow label="电子数">
          <span className="text-lab-glow text-glow">{orbital.electronCount}</span>
        </ParamRow>

        {orbital.nodePlanes.length > 0 && (
          <div className="pt-2">
            <span className="text-xs text-lab-muted">节点面描述</span>
            <div className="mt-1.5 space-y-1">
              {orbital.nodePlanes.map((np, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-lab-surface border border-lab-border/50"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: '#ff9f1c', boxShadow: '0 0 6px rgba(255,159,28,0.4)' }}
                  />
                  <span className="font-mono text-[10px] text-lab-text">{np.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {molecule && (
          <div className="pt-1">
            <span className="text-[10px] text-lab-muted/60">
              {molecule.formula} · {orbital.shape.type}轨道
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
