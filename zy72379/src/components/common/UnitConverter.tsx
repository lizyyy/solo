import React, { useState } from 'react';
import { ArrowRight, Info, History, ChevronDown, ChevronUp } from 'lucide-react';
import type { UnitConversion, CaliberHistory } from '@/types';
import { getUnitDisplayName, getCaliberHistoryForUnit } from '@/utils/unitConverter';

interface UnitConverterDisplayProps {
  conversion: UnitConversion;
  showHistory?: boolean;
}

export const UnitConverterDisplay: React.FC<UnitConverterDisplayProps> = ({ conversion, showHistory = true }) => {
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const history = getCaliberHistoryForUnit(conversion.fromUnit, conversion.toUnit);

  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-lg overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">单位换算</span>
            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-mono rounded">
              {conversion.caliberVersion}
            </span>
          </div>
          {showHistory && history.length > 1 && (
            <button
              onClick={() => setShowHistoryPanel(!showHistoryPanel)}
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-primary-600 transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              <span>历史口径</span>
              {showHistoryPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 bg-white border border-neutral-200 rounded-lg p-3">
            <div className="text-xs text-neutral-500 mb-1">原始值</div>
            <div className="font-mono text-lg font-bold text-neutral-900">
              {conversion.description.split('=')[0].trim()}
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-primary-500 flex-shrink-0" />
          <div className="flex-1 bg-success-50 border border-success-200 rounded-lg p-3">
            <div className="text-xs text-success-600 mb-1">换算后</div>
            <div className="font-mono text-lg font-bold text-success-700">
              {conversion.description.split('=')[1].trim()}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 bg-primary-50 rounded-lg">
          <Info className="w-4 h-4 text-primary-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-primary-700">
            <div className="font-medium mb-1">口径说明</div>
            <div className="text-primary-600">{conversion.historyReference}</div>
            <div className="text-primary-500 mt-1">
              生效日期：{conversion.effectiveDate} · 换算系数：{conversion.conversionFactor}
            </div>
          </div>
        </div>
      </div>

      {showHistoryPanel && history.length > 1 && (
        <div className="border-t border-neutral-200 bg-white">
          <div className="p-4">
            <h4 className="text-sm font-semibold text-neutral-800 mb-3">历史口径对比</h4>
            <div className="space-y-2">
              {history.map((item: CaliberHistory, index: number) => (
                <div
                  key={item.version}
                  className={`p-3 rounded-lg border ${
                    item.version === conversion.caliberVersion
                      ? 'bg-primary-50 border-primary-300'
                      : 'bg-neutral-50 border-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-medium">
                      {item.version}
                      {item.version === conversion.caliberVersion && (
                        <span className="ml-2 text-xs text-primary-600">（当前使用）</span>
                      )}
                      {item.description.includes('废弃') && (
                        <span className="ml-2 text-xs text-danger-600">（已废弃）</span>
                      )}
                    </span>
                    <span className="text-xs text-neutral-500">{item.effectiveDate}</span>
                  </div>
                  <div className="text-xs text-neutral-600">
                    {getUnitDisplayName(item.fromUnit)} → {getUnitDisplayName(item.toUnit)}：
                    系数 {item.conversionFactor}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">{item.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface CaliberSelectorProps {
  fromUnit: string;
  toUnit: string;
  selectedVersion: string;
  onSelect: (version: string, factor: number) => void;
}

export const CaliberSelector: React.FC<CaliberSelectorProps> = ({ fromUnit, toUnit, selectedVersion, onSelect }) => {
  const history = getCaliberHistoryForUnit(fromUnit, toUnit);

  if (history.length === 0) {
    return (
      <div className="text-sm text-danger-600 p-3 bg-danger-50 rounded-lg">
        未找到 {fromUnit} → {toUnit} 的换算口径
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-neutral-700">选择换算口径</label>
      <div className="space-y-2">
        {history.map((item) => (
          <label
            key={item.version}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedVersion === item.version
                ? 'bg-primary-50 border-primary-300'
                : 'bg-white border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            <input
              type="radio"
              name="caliber"
              value={item.version}
              checked={selectedVersion === item.version}
              onChange={() => onSelect(item.version, item.conversionFactor)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium">{item.version}</span>
                <span className="text-xs text-neutral-500">{item.effectiveDate} 生效</span>
                {item.description.includes('废弃') && (
                  <span className="text-xs text-danger-600">（已废弃）</span>
                )}
              </div>
              <div className="text-sm text-neutral-600 mt-1">
                换算系数：{item.conversionFactor}
              </div>
              <div className="text-xs text-neutral-500 mt-1">{item.description}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};
