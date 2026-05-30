import { AlertTriangle, RefreshCw, Code, Eye, EyeOff } from 'lucide-react';
import type { RiskItem } from '@/types';
import { RISK_TYPE_LABELS } from '@/types';
import { RiskCard } from './RiskCard';

interface RiskPanelProps {
  risks: RiskItem[];
  autoDetect: boolean;
  showRawData: boolean;
  onDetect: () => void;
  onToggleAutoDetect: () => void;
  onToggleShowRawData: () => void;
  onClear: () => void;
}

export function RiskPanel({
  risks,
  autoDetect,
  showRawData,
  onDetect,
  onToggleAutoDetect,
  onToggleShowRawData,
  onClear,
}: RiskPanelProps) {
  const riskByType: Record<string, RiskItem[]> = {
    section_occlusion: [],
    band_mismatch: [],
    hotspot_missing: [],
  };

  risks.forEach((r) => {
    riskByType[r.type].push(r);
  });

  const riskTypes: Array<keyof typeof riskByType> = [
    'section_occlusion',
    'band_mismatch',
    'hotspot_missing',
  ];

  return (
    <div className="card-panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-bronze-500" />
          <h3 className="font-serif text-lg text-bronze-400">风险检测</h3>
          <span
            className={`
              px-2 py-0.5 rounded text-xs font-mono
              ${risks.length > 0 ? 'bg-acoustic-high/20 text-acoustic-high' : 'bg-acoustic-mid/20 text-acoustic-mid'}
            `}
          >
            {risks.length} 项
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleAutoDetect}
            className={`
              flex items-center gap-1 px-2 py-1 rounded text-xs font-mono transition-colors
              ${autoDetect ? 'text-bronze-400 bg-bronze-500/10' : 'text-gray-500 hover:text-gray-300'}
            `}
          >
            <RefreshCw size={12} className={autoDetect ? 'animate-spin' : ''} />
            自动检测
          </button>
          <button
            onClick={onToggleShowRawData}
            className={`
              flex items-center gap-1 px-2 py-1 rounded text-xs font-mono transition-colors
              ${showRawData ? 'text-bronze-400' : 'text-gray-500 hover:text-gray-300'}
            `}
          >
            {showRawData ? <Eye size={12} /> : <EyeOff size={12} />}
            原始数据
          </button>
          {!autoDetect && (
            <button onClick={onDetect} className="btn-primary text-xs py-1 px-3">
              检测
            </button>
          )}
          {risks.length > 0 && (
            <button
              onClick={onClear}
              className="btn-secondary text-xs py-1 px-3"
            >
              清除
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {riskTypes.map((type) => {
          const typeRisks = riskByType[type];
          const label = RISK_TYPE_LABELS[type];

          return (
            <div key={type}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-mono text-gray-400">{label}风险</h4>
                <span
                  className={`
                    text-xs font-mono px-2 py-0.5 rounded
                    ${typeRisks.length > 0 ? 'bg-acoustic-high/20 text-acoustic-high' : 'bg-charcoal-800 text-gray-500'}
                  `}
                >
                  {typeRisks.length > 0 ? `${typeRisks.length}项` : '正常'}
                </span>
              </div>
              {typeRisks.length > 0 ? (
                <div className="space-y-2">
                  {typeRisks.map((risk) => (
                    <RiskCard key={risk.id} risk={risk} showRawData={showRawData} />
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-charcoal-800/30 rounded-lg border border-charcoal-700/30">
                  <p className="text-xs text-gray-500 font-mono text-center">
                    未检测到{label}风险
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
