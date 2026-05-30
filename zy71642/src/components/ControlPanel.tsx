import { useOrbitalStore } from '@/store/useOrbitalStore'
import { MOLECULES } from '@/data/molecules'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-all duration-300 cursor-pointer ${
        checked
          ? 'bg-lab-glow/30 shadow-glow-sm'
          : 'bg-lab-border'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-all duration-300 ${
          checked
            ? 'translate-x-4 bg-lab-glow shadow-glow-sm'
            : 'translate-x-0 bg-lab-muted'
        }`}
      />
    </button>
  )
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2 w-full">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1"
      />
      <span className="font-mono text-xs text-lab-glow min-w-[3ch] text-right">
        {value.toFixed(step < 1 ? 2 : 0)}
      </span>
    </div>
  )
}

export default function ControlPanel() {
  const currentMoleculeId = useOrbitalStore((s) => s.currentMoleculeId)
  const showNodePlanes = useOrbitalStore((s) => s.showNodePlanes)
  const nodePlaneOpacity = useOrbitalStore((s) => s.nodePlaneOpacity)
  const showSection = useOrbitalStore((s) => s.showSection)
  const sectionAxis = useOrbitalStore((s) => s.sectionAxis)
  const sectionPosition = useOrbitalStore((s) => s.sectionPosition)
  const isosurfaceThreshold = useOrbitalStore((s) => s.isosurfaceThreshold)

  const setCurrentMolecule = useOrbitalStore((s) => s.setCurrentMolecule)
  const setShowNodePlanes = useOrbitalStore((s) => s.setShowNodePlanes)
  const setNodePlaneOpacity = useOrbitalStore((s) => s.setNodePlaneOpacity)
  const setShowSection = useOrbitalStore((s) => s.setShowSection)
  const setSectionAxis = useOrbitalStore((s) => s.setSectionAxis)
  const setSectionPosition = useOrbitalStore((s) => s.setSectionPosition)
  const setIsosurfaceThreshold = useOrbitalStore((s) => s.setIsosurfaceThreshold)

  return (
    <div className="flex flex-col gap-3 p-3 bg-lab-panel rounded-lg border border-lab-border">
      <div className="space-y-2">
        <label className="block text-xs font-mono text-lab-muted uppercase tracking-wider">
          分子选择
        </label>
        <select
          value={currentMoleculeId}
          onChange={(e) => setCurrentMolecule(e.target.value)}
          className="w-full h-8 px-2 rounded bg-lab-surface border border-lab-border text-sm text-lab-text font-mono appearance-none cursor-pointer focus:outline-none focus:border-lab-glow focus:shadow-glow-sm transition-all"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
          }}
        >
          {MOLECULES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.formula} — {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="h-px bg-lab-border" />

      <div className="space-y-2.5">
        <label className="block text-xs font-mono text-lab-muted uppercase tracking-wider">
          节点面控制
        </label>
        <div className="flex items-center justify-between">
          <span className="text-xs text-lab-text">显示节点面</span>
          <Toggle checked={showNodePlanes} onChange={setShowNodePlanes} />
        </div>
        {showNodePlanes && (
          <div className="space-y-1">
            <span className="text-xs text-lab-text/70">透明度</span>
            <Slider
              value={nodePlaneOpacity}
              min={0}
              max={1}
              step={0.05}
              onChange={setNodePlaneOpacity}
            />
          </div>
        )}
      </div>

      <div className="h-px bg-lab-border" />

      <div className="space-y-2.5">
        <label className="block text-xs font-mono text-lab-muted uppercase tracking-wider">
          截面控制
        </label>
        <div className="flex items-center justify-between">
          <span className="text-xs text-lab-text">显示截面</span>
          <Toggle checked={showSection} onChange={setShowSection} />
        </div>
        {showSection && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-lab-text/70 mr-1">轴</span>
              {(['x', 'y', 'z'] as const).map((axis) => (
                <button
                  key={axis}
                  onClick={() => setSectionAxis(axis)}
                  className={`w-7 h-6 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                    sectionAxis === axis
                      ? 'bg-lab-glow/20 text-lab-glow border border-lab-glow/50 shadow-glow-sm'
                      : 'bg-lab-surface text-lab-muted border border-lab-border hover:border-lab-glow/30'
                  }`}
                >
                  {axis.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <span className="text-xs text-lab-text/70">位置</span>
              <Slider
                value={sectionPosition}
                min={-2}
                max={2}
                step={0.05}
                onChange={setSectionPosition}
              />
            </div>
          </>
        )}
      </div>

      <div className="h-px bg-lab-border" />

      <div className="space-y-2.5">
        <label className="block text-xs font-mono text-lab-muted uppercase tracking-wider">
          等值面阈值
        </label>
        <Slider
          value={isosurfaceThreshold}
          min={0.1}
          max={0.8}
          step={0.01}
          onChange={setIsosurfaceThreshold}
        />
      </div>
    </div>
  )
}
