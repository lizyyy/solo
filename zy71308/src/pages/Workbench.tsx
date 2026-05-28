import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '@/store/useStore'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Play,
  Send,
  Zap,
} from 'lucide-react'

export default function Workbench() {
  const {
    materials,
    validation,
    sweepResult,
    loading,
    fetchMaterials,
    runValidation,
    createRecord,
    runSweep,
  } = useStore()

  const [materialId, setMaterialId] = useState<number | ''>('')
  const [laserPower, setLaserPower] = useState('')
  const [moveSpeed, setMoveSpeed] = useState('')
  const [focalLength, setFocalLength] = useState('')
  const [lineWidth, setLineWidth] = useState('')
  const [operator, setOperator] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const [sweepVariable, setSweepVariable] = useState<'power' | 'speed' | 'focal_length'>('power')
  const [sweepMin, setSweepMin] = useState('')
  const [sweepMax, setSweepMax] = useState('')
  const [sweepStep, setSweepStep] = useState('')

  const [selectedSweepRow, setSelectedSweepRow] = useState<number | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchMaterials()
  }, [fetchMaterials])

  const debouncedValidate = useCallback(
    (data: Record<string, unknown>) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        runValidation(data)
      }, 400)
    },
    [runValidation],
  )

  useEffect(() => {
    const mat = materials.find((m) => m.id === materialId)
    if (!mat) return
    const power = Number(laserPower)
    const speed = Number(moveSpeed)
    const focal = Number(focalLength)
    const lw = Number(lineWidth)
    if (!power || !speed || !focal || !lw) return

    debouncedValidate({
      material_id: mat.id,
      laser_power: power,
      move_speed: speed,
      focal_length: focal,
      line_width: lw,
    })
  }, [materialId, laserPower, moveSpeed, focalLength, lineWidth, materials, debouncedValidate])

  const handleSubmit = async () => {
    const mat = materials.find((m) => m.id === materialId)
    if (!mat) return
    const result = await createRecord({
      material_id: mat.id,
      laser_power: Number(laserPower),
      move_speed: Number(moveSpeed),
      focal_length: Number(focalLength),
      line_width: Number(lineWidth),
      operator,
    })
    if (result) {
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 3000)
    }
  }

  const handleSweep = () => {
    const mat = materials.find((m) => m.id === materialId)
    if (!mat) return
    const power = Number(laserPower)
    const speed = Number(moveSpeed)
    const focal = Number(focalLength)
    runSweep({
      material_id: mat.id,
      sweep_variable: sweepVariable,
      range_min: Number(sweepMin),
      range_max: Number(sweepMax),
      step: Number(sweepStep),
      fixed_power: power,
      fixed_speed: speed,
      fixed_focal_length: focal,
      line_width: Number(lineWidth),
    })
  }

  const handleSweepRowClick = (point: { value: number }) => {
    setSelectedSweepRow(point.value)
    if (sweepVariable === 'power') setLaserPower(String(point.value))
    else if (sweepVariable === 'speed') setMoveSpeed(String(point.value))
    else if (sweepVariable === 'focal_length') setFocalLength(String(point.value))
  }

  const selectedMaterial = materials.find((m) => m.id === materialId)

  const renderThresholdBar = () => {
    if (!validation || !selectedMaterial) return null
    const { energy_density } = validation
    const { min_energy_density, max_energy_density } = selectedMaterial

    const rangeMin = min_energy_density * 0.5
    const rangeMax = max_energy_density * 1.5
    const totalRange = rangeMax - rangeMin
    if (totalRange <= 0) return null

    const leftPct = ((min_energy_density - rangeMin) / totalRange) * 100
    const widthPct = ((max_energy_density - min_energy_density) / totalRange) * 100
    const markerPct = Math.max(0, Math.min(100, ((energy_density - rangeMin) / totalRange) * 100))

    return (
      <div className="mt-4">
        <div className="relative h-6 bg-bg-input rounded-full overflow-visible">
          <div
            className="absolute top-0 h-full bg-laser-green/30 rounded-full"
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          />
          <div
            className="absolute top-0 h-full bg-laser-red/20 rounded-l-full"
            style={{ left: 0, width: `${leftPct}%` }}
          />
          <div
            className="absolute top-0 h-full bg-laser-red/20 rounded-r-full"
            style={{ left: `${leftPct + widthPct}%`, right: 0 }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-amber drop-shadow-lg"
            style={{ left: `${markerPct}%` }}
          >
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-amber" />
          </div>
        </div>
        <div className="flex justify-between text-xs text-txt-muted mt-1 font-mono">
          <span>{rangeMin.toFixed(2)}</span>
          <span className="text-laser-green">{min_energy_density.toFixed(2)}</span>
          <span className="text-laser-green">{max_energy_density.toFixed(2)}</span>
          <span>{rangeMax.toFixed(2)}</span>
        </div>
      </div>
    )
  }

  const riskBadgeClass = (level: string) => {
    switch (level) {
      case 'safe':
        return 'bg-laser-greenDim text-laser-green'
      case 'warning':
        return 'bg-amber-dim text-amber'
      case 'danger':
        return 'bg-laser-redDim text-laser-red'
      default:
        return 'bg-bg-input text-txt-muted'
    }
  }

  const riskLabel = (level: string) => {
    switch (level) {
      case 'safe':
        return '安全'
      case 'warning':
        return '警告'
      case 'danger':
        return '危险'
      default:
        return level
    }
  }

  const rowRiskClass = (level: string) => {
    switch (level) {
      case 'safe':
        return 'bg-laser-greenDim/50'
      case 'warning':
        return 'bg-amber-dim/50'
      case 'danger':
        return 'bg-laser-redDim/50'
      default:
        return ''
    }
  }

  const sweepVariableLabel: Record<string, string> = {
    power: '功率 (W)',
    speed: '速度 (mm/s)',
    focal_length: '焦距 (mm)',
  }

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-auto">
      <h1 className="text-lg font-semibold text-txt-primary flex items-center gap-2 shrink-0">
        <Zap className="w-5 h-5 text-amber" />
        激光雕刻能量密度工作台
      </h1>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-[300px] shrink-0 flex flex-col gap-4">
          <div className="rounded-lg bg-bg-card border border-border p-4 flex flex-col gap-3">
            <h2 className="text-sm font-medium text-txt-secondary">参数输入</h2>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-txt-muted">材料</label>
              <select
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value ? Number(e.target.value) : '')}
                className="bg-bg-input border border-border rounded px-3 py-2 text-txt-primary text-sm"
              >
                <option value="">选择材料</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-txt-muted">激光功率</label>
              <div className="relative">
                <input
                  type="number"
                  value={laserPower}
                  onChange={(e) => setLaserPower(e.target.value)}
                  className="w-full bg-bg-input border border-border rounded px-3 py-2 text-txt-primary text-sm pr-10"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-txt-muted">
                  W
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-txt-muted">移动速度</label>
              <div className="relative">
                <input
                  type="number"
                  value={moveSpeed}
                  onChange={(e) => setMoveSpeed(e.target.value)}
                  className="w-full bg-bg-input border border-border rounded px-3 py-2 text-txt-primary text-sm pr-14"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-txt-muted">
                  mm/s
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-txt-muted">焦距</label>
              <div className="relative">
                <input
                  type="number"
                  value={focalLength}
                  onChange={(e) => setFocalLength(e.target.value)}
                  className="w-full bg-bg-input border border-border rounded px-3 py-2 text-txt-primary text-sm pr-10"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-txt-muted">
                  mm
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-txt-muted">线宽</label>
              <div className="relative">
                <input
                  type="number"
                  value={lineWidth}
                  onChange={(e) => setLineWidth(e.target.value)}
                  className="w-full bg-bg-input border border-border rounded px-3 py-2 text-txt-primary text-sm pr-10"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-txt-muted">
                  mm
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-txt-muted">操作员</label>
              <input
                type="text"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="bg-bg-input border border-border rounded px-3 py-2 text-txt-primary text-sm"
                placeholder="姓名"
              />
            </div>

            <div className="flex gap-2 mt-1">
              <button
                onClick={() => {
                  const mat = materials.find((m) => m.id === materialId)
                  if (!mat) return
                  runValidation({
                    material_id: mat.id,
                    laser_power: Number(laserPower),
                    move_speed: Number(moveSpeed),
                    focal_length: Number(focalLength),
                    line_width: Number(lineWidth),
                  })
                }}
                className="flex-1 bg-amber text-bg-primary hover:bg-amber/90 rounded-lg px-4 py-2 text-sm font-medium flex items-center justify-center gap-1"
              >
                <Play className="w-4 h-4" />
                实时校验
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 bg-bg-input border border-border text-txt-primary hover:bg-bg-secondary rounded-lg px-4 py-2 text-sm font-medium flex items-center justify-center gap-1"
              >
                <Send className="w-4 h-4" />
                提交记录
              </button>
            </div>

            {submitSuccess && (
              <div className="bg-laser-greenDim text-laser-green rounded-lg px-3 py-2 text-sm text-center animate-fade-in">
                提交成功！
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="rounded-lg bg-bg-card border border-border p-4 flex flex-col items-center justify-center gap-3">
            <h2 className="text-sm font-medium text-txt-secondary self-start">计算结果</h2>
            {validation ? (
              <>
                <div className="text-center">
                  <div className="font-mono text-4xl font-bold text-txt-primary tracking-wide">
                    {validation.energy_density.toFixed(4)}
                  </div>
                  <div className="text-xs text-txt-muted mt-1">J/mm²</div>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-xs font-medium ${riskBadgeClass(validation.risk_level)}`}
                >
                  {riskLabel(validation.risk_level)}
                </div>
                {renderThresholdBar()}
              </>
            ) : (
              <div className="text-txt-muted text-sm py-8">请输入参数进行校验</div>
            )}
          </div>
        </div>

        <div className="w-[280px] shrink-0 flex flex-col gap-4">
          <div className="rounded-lg bg-bg-card border border-border p-4 flex flex-col gap-3 flex-1 overflow-auto">
            <h2 className="text-sm font-medium text-txt-secondary">风险提示</h2>
            {validation ? (
              <div className="flex flex-col gap-2">
                {validation.errors.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {validation.errors.map((msg, i) => (
                      <div
                        key={i}
                        className="bg-laser-redDim rounded-lg px-3 py-2 text-sm text-laser-red flex items-start gap-2"
                      >
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{msg}</span>
                      </div>
                    ))}
                  </div>
                )}
                {validation.warnings.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {validation.warnings.map((msg, i) => (
                      <div
                        key={i}
                        className="bg-amber-dim rounded-lg px-3 py-2 text-sm text-amber flex items-start gap-2"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{msg}</span>
                      </div>
                    ))}
                  </div>
                )}
                {validation.suggestions.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {validation.suggestions.map((msg, i) => (
                      <div
                        key={i}
                        className="bg-laser-blueDim rounded-lg px-3 py-2 text-sm text-laser-blue flex items-start gap-2"
                      >
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{msg}</span>
                      </div>
                    ))}
                  </div>
                )}
                {validation.errors.length === 0 &&
                  validation.warnings.length === 0 &&
                  validation.suggestions.length === 0 && (
                    <div className="bg-laser-greenDim rounded-lg px-3 py-2 text-sm text-laser-green flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span>参数校验通过</span>
                    </div>
                  )}
              </div>
            ) : (
              <div className="text-txt-muted text-sm">等待校验结果</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-bg-card border border-border p-4 shrink-0">
        <h2 className="text-sm font-medium text-txt-secondary mb-3">参数扫描</h2>
        <div className="flex items-end gap-3 mb-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-txt-muted">扫描变量</label>
            <select
              value={sweepVariable}
              onChange={(e) => setSweepVariable(e.target.value as 'power' | 'speed' | 'focal_length')}
              className="bg-bg-input border border-border rounded px-3 py-2 text-txt-primary text-sm"
            >
              <option value="power">功率</option>
              <option value="speed">速度</option>
              <option value="focal_length">焦距</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-txt-muted">最小值</label>
            <input
              type="number"
              value={sweepMin}
              onChange={(e) => setSweepMin(e.target.value)}
              className="bg-bg-input border border-border rounded px-3 py-2 text-txt-primary text-sm w-24"
              placeholder="Min"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-txt-muted">最大值</label>
            <input
              type="number"
              value={sweepMax}
              onChange={(e) => setSweepMax(e.target.value)}
              className="bg-bg-input border border-border rounded px-3 py-2 text-txt-primary text-sm w-24"
              placeholder="Max"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-txt-muted">步长</label>
            <input
              type="number"
              value={sweepStep}
              onChange={(e) => setSweepStep(e.target.value)}
              className="bg-bg-input border border-border rounded px-3 py-2 text-txt-primary text-sm w-24"
              placeholder="Step"
            />
          </div>
          <button
            onClick={handleSweep}
            disabled={loading}
            className="bg-amber text-bg-primary hover:bg-amber/90 rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1 disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            开始扫描
          </button>
        </div>

        {sweepResult && sweepResult.points.length > 0 && (
          <div className="overflow-auto max-h-48">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-txt-muted text-xs border-b border-border">
                  <th className="text-left py-2 px-3">
                    {sweepVariableLabel[sweepResult.variable] || sweepResult.variable}
                  </th>
                  <th className="text-left py-2 px-3">能量密度 (J/mm²)</th>
                  <th className="text-left py-2 px-3">风险等级</th>
                </tr>
              </thead>
              <tbody>
                {sweepResult.points.map((point, idx) => (
                  <tr
                    key={idx}
                    onClick={() => handleSweepRowClick(point)}
                    className={`cursor-pointer border-b border-border/50 hover:bg-bg-input/50 transition-colors ${
                      selectedSweepRow === point.value ? 'ring-1 ring-amber' : ''
                    } ${rowRiskClass(point.risk_level)}`}
                  >
                    <td className="py-2 px-3 font-mono text-txt-primary">{point.value}</td>
                    <td className="py-2 px-3 font-mono text-txt-primary">
                      {point.energy_density.toFixed(4)}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskBadgeClass(point.risk_level)}`}
                      >
                        {riskLabel(point.risk_level)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
