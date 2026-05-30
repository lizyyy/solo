import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Radio, History, MapPin } from 'lucide-react';
import { Lighthouse, BearingData } from '../../types';
import BearingInput from './BearingInput';
import { formatDateTime } from '../../utils/formatters';
import { formatBearingDMS, formatBearingDecimal } from '../../utils/bearingConversion';

interface LighthouseCardProps {
  lighthouse: Lighthouse;
  bearing: BearingData | null;
  expectedUnit?: 'dms' | 'decimal';
  onSaveBearing: (data: {
    unit: 'dms' | 'decimal';
    degrees: number;
    minutes: number;
    seconds: number;
    decimalDegrees: number;
    hasUnitError: boolean;
  }) => void;
  disabled?: boolean;
}

export const LighthouseCard: React.FC<LighthouseCardProps> = ({
  lighthouse,
  bearing,
  expectedUnit,
  onSaveBearing,
  disabled = false
}) => {
  const [isExpanded, setIsExpanded] = useState(!bearing);
  const [showHistory, setShowHistory] = useState(false);

  const hasError = bearing?.hasUnitError;

  return (
    <div
      className={`rounded-xl border-2 transition-all overflow-hidden ${
        hasError
          ? 'border-orange-500 bg-orange-500/10'
          : bearing
            ? 'border-slate-600 bg-slate-800/50'
            : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
      }`}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shadow-lg"
              style={{ backgroundColor: lighthouse.color }}
            >
              <Radio size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{lighthouse.name}</span>
                {hasError && (
                  <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full animate-pulse">
                    ⚠️ 单位错误
                  </span>
                )}
                {bearing && !hasError && (
                  <span className="px-2 py-0.5 bg-green-500/80 text-white text-xs rounded-full">
                    ✓ 已输入
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                <MapPin size={10} className="inline mr-1" />
                {lighthouse.position.lat.toFixed(4)}°N, {lighthouse.position.lng.toFixed(4)}°E
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {bearing && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowHistory(!showHistory); }}
                className="p-2 rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
                title="查看修改历史"
              >
                <History size={16} />
              </button>
            )}
            {isExpanded ? (
              <ChevronUp size={20} className="text-slate-400" />
            ) : (
              <ChevronDown size={20} className="text-slate-400" />
            )}
          </div>
        </div>

        {bearing && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-slate-400">信号：</span>
                  <span className="text-slate-200 font-mono">{lighthouse.signal}</span>
                </div>
                <div>
                  <span className="text-slate-400">方位角：</span>
                  <span
                    className={`font-mono font-semibold ${hasError ? 'text-orange-400' : ''}`}
                    style={{ color: hasError ? undefined : lighthouse.color }}
                  >
                    {bearing.unit === 'dms'
                      ? formatBearingDMS({ degrees: bearing.degrees, minutes: bearing.minutes, seconds: bearing.seconds })
                      : formatBearingDecimal(bearing.decimalDegrees)}
                  </span>
                </div>
              </div>
              <div className="text-xs text-slate-500">
                来源：{bearing.source}
              </div>
            </div>
          </div>
        )}
      </div>

      {showHistory && bearing && bearing.modifyHistory.length > 0 && (
        <div className="px-4 pb-3 border-t border-slate-700 bg-slate-900/50">
          <div className="text-xs text-slate-400 font-semibold pt-3 mb-2">修改历史（{bearing.modifyHistory.length}次）</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {bearing.modifyHistory.map((h, i) => (
              <div key={i} className="text-xs text-slate-400 font-mono flex justify-between">
                <span>{formatDateTime(new Date(h.timestamp))}</span>
                <span className="text-slate-200">
                  {h.oldValue.toFixed(2)}° → {h.newValue.toFixed(2)}°
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-700">
          <BearingInput
            lighthouseId={lighthouse.id}
            lighthouseName={lighthouse.name}
            color={lighthouse.color}
            expectedUnit={expectedUnit}
            initialValue={bearing ? {
              unit: bearing.unit,
              degrees: bearing.degrees,
              minutes: bearing.minutes,
              seconds: bearing.seconds,
              decimalDegrees: bearing.decimalDegrees,
              hasUnitError: bearing.hasUnitError
            } : undefined}
            onSave={onSaveBearing}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
};

export default LighthouseCard;
