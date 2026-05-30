import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useBearingValidation } from '../../hooks/useBearingValidation';
import { dmsToDecimal } from '../../utils/bearingConversion';

interface BearingInputProps {
  lighthouseId: string;
  lighthouseName: string;
  color: string;
  expectedUnit?: 'dms' | 'decimal';
  initialValue?: {
    unit: 'dms' | 'decimal';
    degrees?: number;
    minutes?: number;
    seconds?: number;
    decimalDegrees?: number;
    hasUnitError?: boolean;
  };
  onSave: (data: {
    unit: 'dms' | 'decimal';
    degrees: number;
    minutes: number;
    seconds: number;
    decimalDegrees: number;
    hasUnitError: boolean;
  }) => void;
  disabled?: boolean;
}

export const BearingInput: React.FC<BearingInputProps> = ({
  lighthouseId,
  lighthouseName,
  color,
  expectedUnit,
  initialValue,
  onSave,
  disabled = false
}) => {
  const bearing = useBearingValidation(initialValue?.unit || 'decimal');

  React.useEffect(() => {
    if (initialValue) {
      if (initialValue.unit === 'dms') {
        bearing.validateAndSetDms({
          degrees: initialValue.degrees || 0,
          minutes: initialValue.minutes || 0,
          seconds: initialValue.seconds || 0
        });
      } else {
        bearing.validateAndSetDecimal(initialValue.decimalDegrees || 0);
      }
      bearing.setUnit(initialValue.unit);
    }
  }, [initialValue]);

  const handleSave = () => {
    if (!bearing.isValid) return;

    const decimalValue = bearing.getDecimalValue();
    let hasUnitError = false;

    if (expectedUnit && expectedUnit !== bearing.unit) {
      hasUnitError = true;
    }

    if (bearing.unit === 'dms') {
      onSave({
        unit: 'dms',
        degrees: bearing.dms.degrees,
        minutes: bearing.dms.minutes,
        seconds: bearing.dms.seconds,
        decimalDegrees: decimalValue,
        hasUnitError
      });
    } else {
      onSave({
        unit: 'decimal',
        degrees: Math.floor(bearing.decimal),
        minutes: Math.floor((bearing.decimal - Math.floor(bearing.decimal)) * 60),
        seconds: Math.round(((bearing.decimal - Math.floor(bearing.decimal)) * 60 - Math.floor((bearing.decimal - Math.floor(bearing.decimal)) * 60)) * 60 * 100) / 100,
        decimalDegrees: bearing.decimal,
        hasUnitError
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => bearing.setUnit('decimal')}
          disabled={disabled}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            bearing.unit === 'decimal'
              ? 'bg-slate-700 text-white shadow-inner'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          十进制度
        </button>
        <button
          type="button"
          onClick={() => bearing.setUnit('dms')}
          disabled={disabled}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            bearing.unit === 'dms'
              ? 'bg-slate-700 text-white shadow-inner'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          度分秒
        </button>
      </div>

      {expectedUnit && (
        <div className="text-xs text-slate-400 flex items-center gap-1">
          <span>提示：题目要求单位为</span>
          <span className="text-yellow-400 font-semibold">
            {expectedUnit === 'dms' ? '度分秒 (DMS)' : '十进制度'}
          </span>
        </div>
      )}

      {bearing.unit === 'dms' ? (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">度 (°)</label>
            <input
              type="number"
              min="0"
              max="359"
              value={bearing.dms.degrees}
              onChange={(e) => bearing.validateAndSetDms({ degrees: parseInt(e.target.value) || 0 })}
              disabled={disabled}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-slate-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">分 (')</label>
            <input
              type="number"
              min="0"
              max="59"
              value={bearing.dms.minutes}
              onChange={(e) => bearing.validateAndSetDms({ minutes: parseInt(e.target.value) || 0 })}
              disabled={disabled}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-slate-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">秒 (")</label>
            <input
              type="number"
              min="0"
              max="59.99"
              step="0.1"
              value={bearing.dms.seconds}
              onChange={(e) => bearing.validateAndSetDms({ seconds: parseFloat(e.target.value) || 0 })}
              disabled={disabled}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-slate-400 transition-colors"
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-xs text-slate-400 mb-1">方位角 (°)</label>
          <input
            type="number"
            min="0"
            max="359.9999"
            step="0.0001"
            value={bearing.decimal}
            onChange={(e) => bearing.validateAndSetDecimal(parseFloat(e.target.value) || 0)}
            disabled={disabled}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-slate-400 transition-colors"
          />
        </div>
      )}

      {bearing.error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/30 px-3 py-2 rounded-lg border border-red-700/50">
          <AlertTriangle size={14} />
          <span>{bearing.error}</span>
        </div>
      )}

      {bearing.hasUnitError && (
        <div className="flex items-center gap-2 text-orange-400 text-sm bg-orange-900/30 px-3 py-2 rounded-lg border border-orange-700/50 animate-pulse">
          <AlertTriangle size={14} />
          <span>⚠️ 单位可能有误！注意题目要求的单位</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-700">
        <div className="text-sm">
          <span className="text-slate-400">当前值：</span>
          <span className="text-white font-mono ml-1">
            {bearing.unit === 'dms'
              ? `${bearing.dms.degrees}°${bearing.dms.minutes}'${bearing.dms.seconds.toFixed(1)}"`
              : `${bearing.decimal.toFixed(4)}°`}
          </span>
        </div>
        <div className="text-xs text-slate-500 font-mono">
          = {bearing.getDecimalValue().toFixed(4)}°
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!bearing.isValid || disabled}
        style={{ backgroundColor: bearing.isValid ? color : '#475569' }}
        className="w-full py-2.5 px-4 rounded-lg text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
      >
        {initialValue ? '更新方位角' : '确认方位角'}
      </button>
    </div>
  );
};

export default BearingInput;
