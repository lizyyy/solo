import { useState } from 'react';
import { ArrowRight, RefreshCw, Info } from 'lucide-react';
import { convertUnit, canConvert, getAvailableConversions, getUnitCategory } from '../../utils/unitConverter';
import { UNIT_LABELS } from '../../types';
import type { Unit } from '../../types';

export const UnitConversionPanel = () => {
  const [value, setValue] = useState<string>('65');
  const [fromUnit, setFromUnit] = useState<Unit>('dBm');
  const [toUnit, setToUnit] = useState<Unit>('dB');
  const [result, setResult] = useState<{ toValue: number; formula: string } | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const handleConvert = () => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    setIsConverting(true);
    setTimeout(() => {
      const conversion = convertUnit(numValue, fromUnit, toUnit);
      setResult({ toValue: conversion.toValue, formula: conversion.formula });
      setIsConverting(false);
    }, 400);
  };

  const availableToUnits = getAvailableConversions(fromUnit).filter((u) => u !== fromUnit);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold">单位换算工具</h3>
            <p className="text-slate-300 text-sm mt-0.5">物理量单位智能换算</p>
          </div>
          <div className="px-3 py-1 bg-white/10 rounded-full text-xs text-slate-200">
            {getUnitCategory(fromUnit)}
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">原始数值</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-mono"
                placeholder="输入数值"
              />
              <select
                value={fromUnit}
                onChange={(e) => {
                  setFromUnit(e.target.value as Unit);
                  setResult(null);
                }}
                className="px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[100px]"
              >
                {(['dB', 'dBA', 'dBm', 'Hz', 'kHz', 'RPM', 'm/s', 'm', 'kg'] as Unit[]).map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500 mt-1">{UNIT_LABELS[fromUnit]}</p>
          </div>

          <div className="pb-1">
            <button
              onClick={handleConvert}
              disabled={isConverting || !canConvert(fromUnit, toUnit)}
              className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-600/20"
            >
              {isConverting ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowRight className="w-5 h-5" />
              )}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">目标单位</label>
            <div className="flex gap-2">
              <div className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-lg font-mono font-semibold text-blue-600">
                {result ? result.toValue.toFixed(2) : '—'}
              </div>
              <select
                value={toUnit}
                onChange={(e) => {
                  setToUnit(e.target.value as Unit);
                  setResult(null);
                }}
                className="px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[100px]"
              >
                {availableToUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500 mt-1">{UNIT_LABELS[toUnit]}</p>
          </div>
        </div>

        {result && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100 animate-in fade-in duration-300">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800">换算公式</p>
                <p className="text-sm text-blue-700 mt-1 font-mono">{result.formula}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { from: 'dBm', to: 'dB', example: '65dBm = 82.3dB', desc: '功率级→声压级' },
            { from: 'RPM', to: 'Hz', example: '4500RPM = 75Hz', desc: '转速→频率' },
            { from: 'm/s', to: 'km/h', example: '132m/s = 475km/h', desc: '速度换算' },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                const val = item.example.match(/(\d+\.?\d*)/)?.[0] || '0';
                setValue(val);
                setFromUnit(item.from as Unit);
                setToUnit(item.to as Unit);
                setResult(null);
              }}
              className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
            >
              <p className="text-xs text-slate-500">{item.desc}</p>
              <p className="text-sm font-mono font-semibold text-slate-700 group-hover:text-blue-600 mt-1">
                {item.example}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
