import { useState, useCallback } from 'react'
import { Play, Trash2, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { useClassroomStore } from '@/store'
import { PRESET_FUNCTIONS } from '@/types'
import { validateExpression } from '@/utils/gradient'

export default function ControlPanel() {
  const { project, setSurface, setVectorField, addPath, removePath } = useClassroomStore()
  const [exprInput, setExprInput] = useState(project.surface.expression)
  const [startX, setStartX] = useState('0')
  const [startY, setStartY] = useState('0')
  const [stepSize, setStepSize] = useState('0.1')
  const [maxSteps, setMaxSteps] = useState('200')
  const [showPresets, setShowPresets] = useState(false)
  const [exprError, setExprError] = useState(false)

  const handleApplyExpression = useCallback(() => {
    if (validateExpression(exprInput)) {
      setSurface({ expression: exprInput })
      setExprError(false)
    } else {
      setExprError(true)
    }
  }, [exprInput, setSurface])

  const handlePresetSelect = useCallback(
    (expr: string) => {
      setExprInput(expr)
      setSurface({ expression: expr })
      setExprError(false)
      setShowPresets(false)
    },
    [setSurface]
  )

  const handleAddPath = useCallback(() => {
    const x = parseFloat(startX)
    const y = parseFloat(startY)
    const ss = parseFloat(stepSize)
    const ms = parseInt(maxSteps)
    if (isNaN(x) || isNaN(y) || isNaN(ss) || isNaN(ms)) return
    if (ss <= 0 || ms <= 0) return
    addPath([x, y], ss, ms)
  }, [startX, startY, stepSize, maxSteps, addPath])

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="bg-[#0d1225]/60 backdrop-blur-md rounded-xl border border-white/5 p-4">
        <h3 className="text-[#4fc3f7] font-semibold mb-3 text-xs uppercase tracking-wider">曲面函数</h3>
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              value={exprInput}
              onChange={(e) => { setExprInput(e.target.value); setExprError(false) }}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyExpression()}
              placeholder="z = f(x, y)"
              className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-white text-xs font-mono outline-none transition-all
                ${exprError ? 'border-[#ef5350]' : 'border-white/10 focus:border-[#4fc3f7]/50'}
              `}
            />
            <button
              onClick={handleApplyExpression}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4fc3f7] hover:text-white text-xs"
            >
              应用
            </button>
          </div>
          {exprError && (
            <p className="text-[#ef5350] text-xs">表达式无效，请检查语法</p>
          )}
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex items-center gap-1 text-white/40 hover:text-white/70 text-xs transition-colors"
          >
            {showPresets ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            预设函数
          </button>
          {showPresets && (
            <div className="grid grid-cols-1 gap-1 mt-1">
              {PRESET_FUNCTIONS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetSelect(preset.value)}
                  className="text-left px-2 py-1.5 rounded text-xs font-mono text-white/60 hover:text-[#4fc3f7] hover:bg-white/5 transition-all"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#0d1225]/60 backdrop-blur-md rounded-xl border border-white/5 p-4">
        <h3 className="text-[#4fc3f7] font-semibold mb-3 text-xs uppercase tracking-wider">范围与精度</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/40 text-xs block mb-1">X 范围</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={project.surface.xRange[0]}
                  onChange={(e) => setSurface({ xRange: [parseFloat(e.target.value) || 0, project.surface.xRange[1]] })}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs outline-none focus:border-[#4fc3f7]/50"
                />
                <input
                  type="number"
                  value={project.surface.xRange[1]}
                  onChange={(e) => setSurface({ xRange: [project.surface.xRange[0], parseFloat(e.target.value) || 0] })}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs outline-none focus:border-[#4fc3f7]/50"
                />
              </div>
            </div>
            <div>
              <label className="text-white/40 text-xs block mb-1">Y 范围</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={project.surface.yRange[0]}
                  onChange={(e) => setSurface({ yRange: [parseFloat(e.target.value) || 0, project.surface.yRange[1]] })}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs outline-none focus:border-[#4fc3f7]/50"
                />
                <input
                  type="number"
                  value={project.surface.yRange[1]}
                  onChange={(e) => setSurface({ yRange: [project.surface.yRange[0], parseFloat(e.target.value) || 0] })}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs outline-none focus:border-[#4fc3f7]/50"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="text-white/40 text-xs flex justify-between mb-1">
              <span>网格密度</span>
              <span className="text-[#4fc3f7]">{project.surface.resolution}</span>
            </label>
            <input
              type="range"
              min={10}
              max={80}
              step={5}
              value={project.surface.resolution}
              onChange={(e) => setSurface({ resolution: parseInt(e.target.value) })}
              className="w-full accent-[#4fc3f7]"
            />
          </div>
        </div>
      </div>

      <div className="bg-[#0d1225]/60 backdrop-blur-md rounded-xl border border-white/5 p-4">
        <h3 className="text-[#4fc3f7] font-semibold mb-3 text-xs uppercase tracking-wider">向量场</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-xs">显示箭头</span>
            <button
              onClick={() => setVectorField({ showArrows: !project.vectorField.showArrows })}
              className={`w-10 h-5 rounded-full transition-all ${project.vectorField.showArrows ? 'bg-[#4fc3f7]' : 'bg-white/20'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${project.vectorField.showArrows ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div>
            <label className="text-white/40 text-xs flex justify-between mb-1">
              <span>箭头缩放</span>
              <span className="text-[#4fc3f7]">{project.vectorField.arrowScale.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={project.vectorField.arrowScale}
              onChange={(e) => setVectorField({ arrowScale: parseFloat(e.target.value) })}
              className="w-full accent-[#4fc3f7]"
            />
          </div>
          <div>
            <label className="text-white/40 text-xs flex justify-between mb-1">
              <span>箭头密度</span>
              <span className="text-[#4fc3f7]">{project.vectorField.density}</span>
            </label>
            <input
              type="range"
              min={4}
              max={20}
              step={2}
              value={project.vectorField.density}
              onChange={(e) => setVectorField({ density: parseInt(e.target.value) })}
              className="w-full accent-[#4fc3f7]"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-xs">按模值着色</span>
            <button
              onClick={() => setVectorField({ colorByMagnitude: !project.vectorField.colorByMagnitude })}
              className={`w-10 h-5 rounded-full transition-all ${project.vectorField.colorByMagnitude ? 'bg-[#4fc3f7]' : 'bg-white/20'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${project.vectorField.colorByMagnitude ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#0d1225]/60 backdrop-blur-md rounded-xl border border-white/5 p-4">
        <h3 className="text-[#4fc3f7] font-semibold mb-3 text-xs uppercase tracking-wider">滑雪路径</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/40 text-xs block mb-1">起点 X</label>
              <input
                type="number"
                step={0.1}
                value={startX}
                onChange={(e) => setStartX(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs outline-none focus:border-[#4fc3f7]/50"
              />
            </div>
            <div>
              <label className="text-white/40 text-xs block mb-1">起点 Y</label>
              <input
                type="number"
                step={0.1}
                value={startY}
                onChange={(e) => setStartY(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs outline-none focus:border-[#4fc3f7]/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/40 text-xs block mb-1">步长</label>
              <input
                type="number"
                step={0.01}
                min={0.001}
                value={stepSize}
                onChange={(e) => setStepSize(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs outline-none focus:border-[#4fc3f7]/50"
              />
            </div>
            <div>
              <label className="text-white/40 text-xs block mb-1">最大步数</label>
              <input
                type="number"
                step={50}
                min={10}
                value={maxSteps}
                onChange={(e) => setMaxSteps(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs outline-none focus:border-[#4fc3f7]/50"
              />
            </div>
          </div>
          <button
            onClick={handleAddPath}
            className="w-full flex items-center justify-center gap-2 bg-[#4fc3f7]/20 hover:bg-[#4fc3f7]/30 text-[#4fc3f7] rounded-lg py-2 text-xs font-medium transition-all"
          >
            <Play size={14} />
            生成路径
          </button>
        </div>
      </div>

      {project.paths.length > 0 && (
        <div className="bg-[#0d1225]/60 backdrop-blur-md rounded-xl border border-white/5 p-4">
          <h3 className="text-[#4fc3f7] font-semibold mb-3 text-xs uppercase tracking-wider">已有路径</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {project.paths.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-[#66bb6a]" />
                  <span className="text-white/70 text-xs">
                    路径{i + 1} ({p.startPoint[0].toFixed(1)}, {p.startPoint[1].toFixed(1)})
                  </span>
                  <span className="text-white/30 text-xs">
                    {p.points.length}点
                  </span>
                </div>
                <button
                  onClick={() => removePath(p.id)}
                  className="text-white/30 hover:text-[#ef5350] transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
