import { useState } from 'react'
import { Upload, CheckCircle, AlertTriangle } from 'lucide-react'
import { useCraneStore } from '@/store'
import type { AngleUnit, LengthUnit, VelocityUnit, TimeUnit, Direction, SourceType } from '@/types'

const unitOptions = {
  angle: ['deg', 'rad'] as AngleUnit[],
  length: ['m', 'cm'] as LengthUnit[],
  velocity: ['m/s', 'cm/s'] as VelocityUnit[],
  time: ['s', 'ms'] as TimeUnit[],
}

const directions: Direction[] = ['+', '-']
const sources: SourceType[] = ['sensor_log', 'sensor_log_legacy', 'experiment_table', 'manual']
const sourceLabels: Record<SourceType, string> = {
  sensor_log: '传感器日志',
  sensor_log_legacy: '传感器日志(旧)',
  experiment_table: '实验表',
  manual: '手动录入',
}

export default function SensorInput() {
  const addRecord = useCraneStore(s => s.addRecord)
  const [source, setSource] = useState<SourceType>('sensor_log')
  const [ropeLength, setRopeLength] = useState('30')
  const [ropeLengthUnit, setRopeLengthUnit] = useState<LengthUnit>('m')
  const [swingAngle, setSwingAngle] = useState('')
  const [swingAngleUnit, setSwingAngleUnit] = useState<AngleUnit>('deg')
  const [linearVelocity, setLinearVelocity] = useState('0.3')
  const [velocityUnit, setVelocityUnit] = useState<VelocityUnit>('m/s')
  const [sampleInterval, setSampleInterval] = useState('0.5')
  const [sampleIntervalUnit, setSampleIntervalUnit] = useState<TimeUnit>('s')
  const [direction, setDirection] = useState<Direction>('+')
  const [observationDuration, setObservationDuration] = useState('30')
  const [previousSwingAngle, setPreviousSwingAngle] = useState('')
  const [caliberTag, setCaliberTag] = useState('current')
  const [rawData, setRawData] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warn'; msg: string } | null>(null)

  function handleSubmit() {
    if (!swingAngle || !ropeLength) {
      setFeedback({ type: 'warn', msg: '请至少填写绳长和摆角' })
      return
    }
    try {
      addRecord({
        source,
        rawData: rawData || `${new Date().toISOString()} | rope=${ropeLength}${ropeLengthUnit} | angle=${swingAngle}${swingAngleUnit}`,
        ropeLength: parseFloat(ropeLength),
        ropeLengthUnit,
        swingAngle: parseFloat(swingAngle),
        swingAngleUnit,
        linearVelocity: parseFloat(linearVelocity) || 0,
        velocityUnit,
        timestamp: Date.now(),
        sampleInterval: parseFloat(sampleInterval) || 0.5,
        sampleIntervalUnit,
        direction,
        caliberTag,
        observationDuration: parseFloat(observationDuration) || 30,
        previousSwingAngle: previousSwingAngle ? parseFloat(previousSwingAngle) : undefined,
      })
      setFeedback({ type: 'success', msg: '记录已添加，校验与计算完成' })
      setSwingAngle('')
      setPreviousSwingAngle('')
      setRawData('')
      setTimeout(() => setFeedback(null), 3000)
    } catch (e) {
      setFeedback({ type: 'warn', msg: `录入失败: ${(e as Error).message}` })
    }
  }

  return (
    <div className="harbor-panel p-4 space-y-4">
      <h3 className="font-display text-base font-bold text-harbor-amber flex items-center gap-2">
        <Upload className="w-4 h-4" />
        传感器日志录入
      </h3>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">数据来源</label>
            <select
              className="harbor-input w-full"
              value={source}
              onChange={e => setSource(e.target.value as SourceType)}
            >
              {sources.map(s => (
                <option key={s} value={s}>{sourceLabels[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">口径标记</label>
            <input
              className="harbor-input w-full"
              value={caliberTag}
              onChange={e => setCaliberTag(e.target.value)}
              placeholder="current"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">绳长</label>
            <div className="flex gap-1">
              <input className="harbor-input flex-1" type="number" step="any" value={ropeLength}
                onChange={e => setRopeLength(e.target.value)} />
              <select className="harbor-input w-16" value={ropeLengthUnit}
                onChange={e => setRopeLengthUnit(e.target.value as LengthUnit)}>
                {unitOptions.length.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">摆角</label>
            <div className="flex gap-1">
              <input className="harbor-input flex-1" type="number" step="any" value={swingAngle}
                onChange={e => setSwingAngle(e.target.value)} placeholder="1.8" />
              <select className="harbor-input w-16" value={swingAngleUnit}
                onChange={e => setSwingAngleUnit(e.target.value as AngleUnit)}>
                {unitOptions.angle.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">前次摆角(可选)</label>
            <input className="harbor-input w-full" type="number" step="any" value={previousSwingAngle}
              onChange={e => setPreviousSwingAngle(e.target.value)} placeholder="用于算阻尼比" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">线速度</label>
            <div className="flex gap-1">
              <input className="harbor-input flex-1" type="number" step="any" value={linearVelocity}
                onChange={e => setLinearVelocity(e.target.value)} />
              <select className="harbor-input w-16" value={velocityUnit}
                onChange={e => setVelocityUnit(e.target.value as VelocityUnit)}>
                {unitOptions.velocity.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">采样间隔</label>
            <div className="flex gap-1">
              <input className="harbor-input flex-1" type="number" step="any" value={sampleInterval}
                onChange={e => setSampleInterval(e.target.value)} />
              <select className="harbor-input w-16" value={sampleIntervalUnit}
                onChange={e => setSampleIntervalUnit(e.target.value as TimeUnit)}>
                {unitOptions.time.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">方向</label>
            <div className="flex gap-2 mt-1">
              {directions.map(d => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`flex-1 py-2 rounded font-mono text-lg font-bold transition-colors
                    ${direction === d
                      ? 'bg-harbor-amber text-harbor-bg'
                      : 'bg-harbor-bg border border-harbor-border text-gray-400 hover:text-gray-200'
                    }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">观测时长(s)</label>
            <input className="harbor-input w-full" type="number" step="any" value={observationDuration}
              onChange={e => setObservationDuration(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">原始日志(可选)</label>
            <input className="harbor-input w-full" value={rawData}
              onChange={e => setRawData(e.target.value)} placeholder="粘贴传感器原文" />
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded
          ${feedback.type === 'success' ? 'bg-harbor-green/10 text-harbor-green' : 'bg-harbor-yellow/10 text-harbor-yellow'}`}>
          {feedback.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertTriangle className="w-4 h-4 shrink-0" />
          }
          {feedback.msg}
        </div>
      )}

      <button onClick={handleSubmit} className="harbor-btn w-full text-sm">
        录入并计算
      </button>
    </div>
  )
}
