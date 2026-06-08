import { useState, Fragment } from 'react';
import { useStore } from '@/store';
import { Calculator, Settings, Play, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import type { TemperatureUnit, PowerUnit, AreaUnit, ThicknessUnit } from '@/types';

const TEMP_UNITS: TemperatureUnit[] = ['°C', '°F', 'K'];
const POWER_UNITS: PowerUnit[] = ['kW', 'W', 'BTU/h', 'RT'];
const AREA_UNITS: AreaUnit[] = ['m²', 'ft²'];
const THICKNESS_UNITS: ThicknessUnit[] = ['mm', 'cm', 'in'];

const RS_LABEL: Record<string, string> = { normal: '正常', pending: '待确认', old_caliber: '旧口径', extreme: '极端值' };
const RS_CLS: Record<string, string> = { normal: 'status-badge-normal', pending: 'status-badge-pending', old_caliber: 'status-badge-old', extreme: 'status-badge-extreme' };

export default function Calculate() {
  const currentBatch = useStore(s => s.currentBatch);
  const updateParameters = useStore(s => s.updateParameters);
  const updateThresholds = useStore(s => s.updateThresholds);
  const runCalculation = useStore(s => s.runCalculation);

  const [reason, setReason] = useState('');
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  if (!currentBatch) {
    return (
      <div className="flex items-center justify-center h-64 text-industrial-400 font-mono text-sm">
        请先选择或创建批次
      </div>
    );
  }

  const { parameters: p, thresholds: t, calculationResults } = currentBatch;

  const handleApply = () => {
    if (!reason.trim()) return;
    updateParameters(currentBatch.id, p, reason);
    updateThresholds(currentBatch.id, t, reason);
    setReason('');
  };

  const allConversions = calculationResults?.flatMap(r => r.unitConversions) ?? [];

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto">
      <div className="industrial-card">
        <div className="industrial-card-header flex items-center gap-2">
          <Calculator size={16} />
          物理参数配置
        </div>
        <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <fieldset className="border border-primary-200 p-3">
            <legend className="font-mono text-xs font-semibold text-primary-600 px-1">冰面参数</legend>
            <div className="space-y-2">
              <ParamInput label="冰面面积" value={p.iceArea} unit={p.iceAreaUnit} units={AREA_UNITS}
                onChange={(v, u) => updateParameters(currentBatch.id, { iceArea: v, iceAreaUnit: u as AreaUnit }, '')} />
              <ParamInput label="冰层厚度" value={p.iceThickness} unit={p.iceThicknessUnit} units={THICKNESS_UNITS}
                onChange={(v, u) => updateParameters(currentBatch.id, { iceThickness: v, iceThicknessUnit: u as ThicknessUnit }, '')} />
              <ParamInput label="冰面温度" value={p.iceTemperature} unit={p.iceTemperatureUnit} units={TEMP_UNITS}
                onChange={(v, u) => updateParameters(currentBatch.id, { iceTemperature: v, iceTemperatureUnit: u as TemperatureUnit }, '')} />
            </div>
          </fieldset>

          <fieldset className="border border-primary-200 p-3">
            <legend className="font-mono text-xs font-semibold text-primary-600 px-1">环境参数</legend>
            <div className="space-y-2">
              <ParamInput label="环境温度" value={p.ambientTemperature} unit={p.ambientTemperatureUnit} units={TEMP_UNITS}
                onChange={(v, u) => updateParameters(currentBatch.id, { ambientTemperature: v, ambientTemperatureUnit: u as TemperatureUnit }, '')} />
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-industrial-600 w-20 shrink-0">环境湿度</span>
                <input type="number" className="industrial-input flex-1" value={p.ambientHumidity}
                  onChange={e => updateParameters(currentBatch.id, { ambientHumidity: +e.target.value }, '')} />
                <span className="font-mono text-xs text-industrial-500">%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-industrial-600 w-20 shrink-0">人员数量</span>
                <input type="number" className="industrial-input flex-1" value={p.peopleCount}
                  onChange={e => updateParameters(currentBatch.id, { peopleCount: +e.target.value }, '')} />
                <span className="font-mono text-xs text-industrial-500">人</span>
              </div>
            </div>
          </fieldset>

          <fieldset className="border border-primary-200 p-3">
            <legend className="font-mono text-xs font-semibold text-primary-600 px-1">设备参数</legend>
            <div className="space-y-2">
              <ParamInput label="设备功率" value={p.equipmentPower} unit={p.equipmentPowerUnit} units={POWER_UNITS}
                onChange={(v, u) => updateParameters(currentBatch.id, { equipmentPower: v, equipmentPowerUnit: u as PowerUnit }, '')} />
              <ParamInput label="照明功率" value={p.lightingPower} unit={p.lightingPowerUnit} units={POWER_UNITS}
                onChange={(v, u) => updateParameters(currentBatch.id, { lightingPower: v, lightingPowerUnit: u as PowerUnit }, '')} />
            </div>
          </fieldset>
        </div>
      </div>

      <div className="industrial-card">
        <div className="industrial-card-header flex items-center gap-2">
          <Settings size={16} />
          阈值配置
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <ParamInput label="最大冷负荷" value={t.maxCoolingLoad} unit={t.maxCoolingLoadUnit} units={POWER_UNITS}
            onChange={(v, u) => updateThresholds(currentBatch.id, { maxCoolingLoad: v, maxCoolingLoadUnit: u as PowerUnit }, '')} />
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-industrial-600 w-20 shrink-0">预警比例</span>
            <input type="number" step="0.01" min="0" max="1" className="industrial-input flex-1" value={t.warningRatio}
              onChange={e => updateThresholds(currentBatch.id, { warningRatio: +e.target.value }, '')} />
            <span className="font-mono text-xs text-industrial-500">{(t.warningRatio * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-industrial-600 w-20 shrink-0">IQR倍数</span>
            <input type="number" step="0.1" min="0" className="industrial-input flex-1" value={t.extremeOutlierThreshold}
              onChange={e => updateThresholds(currentBatch.id, { extremeOutlierThreshold: +e.target.value }, '')} />
            <span className="font-mono text-xs text-industrial-500">×</span>
          </div>
        </div>
      </div>

      <div className="industrial-card p-4 flex items-center gap-3">
        <input type="text" className="industrial-input flex-1" placeholder="输入修改原因…" value={reason}
          onChange={e => setReason(e.target.value)} />
        <button className="industrial-btn-primary flex items-center gap-1" onClick={handleApply} disabled={!reason.trim()}>
          <ArrowRight size={14} />
          应用参数
        </button>
        <button className="industrial-btn-primary flex items-center gap-1"
          onClick={() => runCalculation(currentBatch.id)}>
          <Play size={14} />
          运行计算
        </button>
      </div>

      {calculationResults && calculationResults.length > 0 && (
        <div className="industrial-card">
          <div className="industrial-card-header">计算结果（{calculationResults.length} 条）</div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="industrial-table">
              <thead>
                <tr>
                  <th>时间</th><th>温度</th><th>总负荷</th><th>冰负荷</th><th>对流</th><th>辐射</th><th>湿负荷</th><th>人员</th><th>设备</th><th>照明</th><th>状态</th><th></th>
                </tr>
              </thead>
              <tbody>
                {calculationResults.map(r => {
                  const rec = currentBatch.records.find(x => x.id === r.recordId);
                  const isOpen = expandedStep === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr>
                        <td>{rec ? new Date(rec.timestamp).toLocaleString('zh-CN') : '-'}</td>
                        <td>{rec?.temperature ?? '-'}</td>
                        <td className="font-semibold">{r.totalLoad.toFixed(2)}</td>
                        <td>{r.iceLoad.toFixed(2)}</td>
                        <td>{r.convectionLoad.toFixed(2)}</td>
                        <td>{r.radiationLoad.toFixed(2)}</td>
                        <td>{r.moistureLoad.toFixed(2)}</td>
                        <td>{r.personnelLoad.toFixed(2)}</td>
                        <td>{r.equipmentLoad.toFixed(2)}</td>
                        <td>{r.lightingLoad.toFixed(2)}</td>
                        <td>{rec ? <span className={`status-badge ${RS_CLS[rec.recordStatus] ?? 'status-badge-normal'}`}>{RS_LABEL[rec.recordStatus] ?? rec.recordStatus}</span> : '-'}</td>
                        <td>
                          <button className="industrial-btn px-2 py-1" onClick={() => setExpandedStep(isOpen ? null : r.id)}>
                            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={12} className="bg-industrial-50 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {r.calculationSteps.map(step => (
                                <div key={step.id} className="formula-box">
                                  <div className="font-semibold text-primary-700 mb-1">{step.name}</div>
                                  <div className="text-industrial-600 mb-1">{step.formula}</div>
                                  <div className="text-xs text-industrial-500">
                                    {Object.entries(step.inputs).map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(4) : v}`).join(', ')}
                                  </div>
                                  <div className="mt-1 text-primary-700 font-semibold">
                                    = {step.result.toFixed(4)} {step.unit}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {allConversions.length > 0 && (
        <div className="industrial-card">
          <div className="industrial-card-header">单位换算追踪</div>
          <div className="p-4 space-y-2">
            {allConversions.map((c, i) => (
              <div key={c.id + i} className="formula-box flex items-center gap-3">
                <span className="text-industrial-600">{c.fromValue.toFixed(4)} {c.fromUnit}</span>
                <ArrowRight size={14} className="text-primary-500" />
                <span className="text-primary-700 font-semibold">{c.toValue.toFixed(4)} {c.toUnit}</span>
                <span className="ml-auto text-xs text-industrial-400">{c.formula}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ParamInput({ label, value, unit, units, onChange }: {
  label: string;
  value: number;
  unit: string;
  units: string[];
  onChange: (value: number, unit: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs text-industrial-600 w-20 shrink-0">{label}</span>
      <input type="number" className="industrial-input flex-1" value={value}
        onChange={e => onChange(+e.target.value, unit)} />
      <select className="industrial-select w-20" value={unit}
        onChange={e => onChange(value, e.target.value)}>
        {units.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
    </div>
  );
}
