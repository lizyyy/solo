import { ChevronDown, ChevronRight, AlertTriangle, Info, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { getFlowRegimeLabel, getFlowRegimeBgClass, formatRe } from '@/utils/calculator';

export default function ResultDisplay() {
  const { result, pipeDiameter, velocity, density, viscosity, calculationTime } = useFlowStore();
  const [showConversion, setShowConversion] = useState(true);
  const [showFormula, setShowFormula] = useState(true);
  const [expandedAnomaly, setExpandedAnomaly] = useState<number | null>(null);

  if (!result || !result.canCalculate) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
        <h2 className="text-lg font-bold text-zinc-800 mb-4" style={{ fontFamily: '"LXGW WenKai", "Noto Sans SC", serif' }}>
          计算结果
        </h2>
        <div className="text-center py-12 text-zinc-400">
          <div className="text-5xl mb-4 opacity-50">∿</div>
          <p className="text-sm">请输入参数后点击「计算雷诺数」</p>
        </div>
      </div>
    );
  }

  const { reynoldsNumber, flowRegime, isCritical, conversionSteps, anomalies } = result;

  const dStep = conversionSteps.find(s => s.parameter === 'pipeDiameter');
  const vStep = conversionSteps.find(s => s.parameter === 'velocity');
  const rhoStep = conversionSteps.find(s => s.parameter === 'density');
  const muStep = conversionSteps.find(s => s.parameter === 'viscosity');

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-800" style={{ fontFamily: '"LXGW WenKai", "Noto Sans SC", serif' }}>
            计算结果
          </h2>
          {calculationTime && (
            <span className="text-xs text-zinc-400">计算时间：{calculationTime}</span>
          )}
        </div>

        <div className="text-center py-6 bg-gradient-to-br from-zinc-50 to-teal-50 rounded-xl border border-teal-100">
          <div className="text-sm text-teal-600 mb-2">雷诺数 Re</div>
          <div className="text-5xl font-bold text-teal-800 font-mono tracking-tight" style={{ fontFamily: '"LXGW WenKai", monospace' }}>
            {reynoldsNumber !== null ? formatRe(reynoldsNumber) : '—'}
          </div>
          <div className={`mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-medium ${flowRegime ? getFlowRegimeBgClass(flowRegime) : ''}`}>
            {isCritical && <AlertTriangle className="w-4 h-4 animate-pulse" />}
            {flowRegime ? getFlowRegimeLabel(flowRegime) : ''}
            {isCritical && <span className="text-xs opacity-80">· 临界过渡区</span>}
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => setShowFormula(!showFormula)}
            className="w-full flex items-center justify-between text-sm text-zinc-700 hover:text-teal-700 transition-colors py-2"
          >
            <span className="font-medium">计算过程</span>
            {showFormula ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {showFormula && (
            <div className="bg-zinc-50 rounded-xl p-4 space-y-3 text-sm font-mono border border-zinc-100">
              <div className="text-teal-700 font-medium">Re = ρ · v · d / μ</div>
              <div className="space-y-1 text-zinc-600">
                <div>= {rhoStep?.toValue ?? '?'} × {vStep?.toValue ?? '?'} × {dStep?.toValue.toExponential(2) ?? '?'} ÷ {muStep?.toValue ?? '?'}</div>
                <div>= {(rhoStep?.toValue ?? 0) * (vStep?.toValue ?? 0) * (dStep?.toValue ?? 0)} ÷ {muStep?.toValue ?? '?'}</div>
                <div className="text-teal-700 font-semibold pt-2 border-t border-zinc-200 mt-2">
                  = {reynoldsNumber !== null ? formatRe(reynoldsNumber) : '—'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button
            onClick={() => setShowConversion(!showConversion)}
            className="w-full flex items-center justify-between text-sm text-zinc-700 hover:text-teal-700 transition-colors py-2"
          >
            <span className="font-medium">单位换算过程</span>
            {showConversion ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {showConversion && (
            <div className="bg-zinc-50 rounded-xl p-4 space-y-2 border border-zinc-100">
              {conversionSteps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <span className="text-teal-600 font-mono w-20">{step.parameterLabel}</span>
                  <span className="text-zinc-500">→</span>
                  <span className="text-zinc-700 font-mono flex-1">{step.formula}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {anomalies.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6 space-y-4">
          <h3 className="text-sm font-bold text-orange-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            异常标注
          </h3>
          <div className="space-y-2">
            {anomalies.map((anomaly, idx) => (
              <div
                key={idx}
                className={`rounded-xl border transition-all ${
                  anomaly.severity === 'error'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-orange-50 border-orange-200'
                }`}
              >
                <button
                  onClick={() => setExpandedAnomaly(expandedAnomaly === idx ? null : idx)}
                  className="w-full p-3 flex items-start justify-between text-left"
                >
                  <div className="flex items-start gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 ${
                      anomaly.severity === 'error' ? 'bg-red-200 text-red-800' : 'bg-orange-200 text-orange-800'
                    }`}>
                      {anomaly.fieldLabel}
                    </span>
                    <span className="text-sm text-zinc-700">{anomaly.message}</span>
                  </div>
                  {expandedAnomaly === idx ? <ChevronDown className="w-4 h-4 text-zinc-400 mt-1" /> : <ChevronRight className="w-4 h-4 text-zinc-400 mt-1" />}
                </button>
                {expandedAnomaly === idx && (
                  <div className="px-3 pb-3 pt-0 space-y-2 border-t border-orange-100 mx-3">
                    <div className="pt-2 flex items-start gap-2 text-sm">
                      <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-zinc-500 font-medium">修正建议：</span>
                        <span className="text-zinc-700 ml-1">{anomaly.suggestion}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Info className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-zinc-500 font-medium">定位字段：</span>
                        <span className="text-zinc-700 ml-1 font-mono">{anomaly.field}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 space-y-4">
        <h3 className="text-sm font-bold text-zinc-700" style={{ fontFamily: '"LXGW WenKai", "Noto Sans SC", serif' }}>
          雷诺数数轴
        </h3>
        <div className="relative pt-6 pb-4 px-2">
          <svg viewBox="0 0 800 100" className="w-full h-24">
            <defs>
              <linearGradient id="laminarGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#2ECC71" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#2ECC71" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="transGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#F39C12" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#F39C12" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="turbGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#E74C3C" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#E74C3C" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            <rect x="0" y="30" width="200" height="25" rx="4" fill="url(#laminarGrad)" />
            <rect x="200" y="30" width="100" height="25" rx="4" fill="url(#transGrad)" />
            <rect x="300" y="30" width="500" height="25" rx="4" fill="url(#turbGrad)" />

            <line x1="0" y1="55" x2="800" y2="55" stroke="#52525B" strokeWidth="1.5" />
            {[0, 100, 200, 250, 300, 400, 500, 600, 700, 800].map(x => (
              <line key={x} x1={x} y1="50" x2={x} y2="60" stroke="#52525B" strokeWidth="1" />
            ))}

            <text x="100" y="22" textAnchor="middle" className="text-xs" fill="#065f46" fontWeight="600">层流</text>
            <text x="250" y="22" textAnchor="middle" className="text-xs" fill="#92400e" fontWeight="600">过渡</text>
            <text x="550" y="22" textAnchor="middle" className="text-xs" fill="#991b1b" fontWeight="600">紊流</text>

            <text x="200" y="78" textAnchor="middle" className="text-[10px]" fill="#71717a">2000</text>
            <text x="300" y="78" textAnchor="middle" className="text-[10px]" fill="#71717a">4000</text>
            <text x="0" y="78" textAnchor="middle" className="text-[10px]" fill="#71717a">0</text>
            <text x="800" y="78" textAnchor="middle" className="text-[10px]" fill="#71717a">∞</text>

            {reynoldsNumber !== null && (() => {
              const maxDisplay = Math.max(reynoldsNumber * 1.2, 8000);
              let xPos: number;
              if (reynoldsNumber <= 2000) {
                xPos = (reynoldsNumber / 2000) * 200;
              } else if (reynoldsNumber <= 4000) {
                xPos = 200 + ((reynoldsNumber - 2000) / 2000) * 100;
              } else if (reynoldsNumber <= maxDisplay) {
                xPos = 300 + ((reynoldsNumber - 4000) / (maxDisplay - 4000)) * 500;
              } else {
                xPos = 790;
              }
              xPos = Math.min(xPos, 790);
              return (
                <g>
                  <polygon
                    points={`${xPos},42 ${xPos - 6},28 ${xPos + 6},28`}
                    fill={isCritical ? '#F39C12' : '#0D7377'}
                    className={isCritical ? 'animate-bounce' : ''}
                    style={{ animationDuration: '2s' }}
                  />
                  <circle cx={xPos} cy="42" r="4" fill="white" stroke={isCritical ? '#F39C12' : '#0D7377'} strokeWidth="2" />
                  <text x={xPos} y="98" textAnchor="middle" className="text-[11px]" fill="#0D7377" fontWeight="700">
                    Re = {formatRe(reynoldsNumber)}
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
            <div className="text-emerald-700 font-semibold">Re &lt; 2000</div>
            <div className="text-emerald-600 text-[11px] mt-0.5">层流：流体分层流动，互不混合</div>
          </div>
          <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
            <div className="text-amber-700 font-semibold">2000 ≤ Re ≤ 4000</div>
            <div className="text-amber-600 text-[11px] mt-0.5">过渡区：流态不稳定</div>
          </div>
          <div className="p-2 bg-red-50 rounded-lg border border-red-100">
            <div className="text-red-700 font-semibold">Re &gt; 4000</div>
            <div className="text-red-600 text-[11px] mt-0.5">紊流：流体混合剧烈</div>
          </div>
        </div>
      </div>
    </div>
  );
}
