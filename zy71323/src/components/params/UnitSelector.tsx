import { Ruler, Gauge, Layers } from 'lucide-react';
import { useEstimationStore } from '@/store/useEstimationStore';
import { convertMetersToFeet, convertFeetToMeters, convertMetersPerSecondToKnots, convertKnotsToMetersPerSecond, convertSquareMetersToSquareFeet, convertSquareFeetToSquareMeters } from '@/engine/unitConverter';

export default function UnitSelector() {
  const { params, setParams, validation } = useEstimationStore();

  const isAllMetric = params.tidalRangeUnit === 'm' && params.flowVelocityUnit === 'm/s' && params.impellerAreaUnit === 'm²';
  const isAllImperial = params.tidalRangeUnit === 'ft' && params.flowVelocityUnit === 'knots' && params.impellerAreaUnit === 'ft²';

  const hasUnitWarning = validation.warnings.some(w => w.code === 'UNIT_MIXED');

  const handleSystemToggle = (system: 'metric' | 'imperial') => {
    const updates: Partial<typeof params> = {};

    if (system === 'metric') {
      updates.tidalRangeUnit = 'm';
      updates.flowVelocityUnit = 'm/s';
      updates.impellerAreaUnit = 'm²';

      if (params.tidalRangeUnit === 'ft') {
        updates.tidalRange = convertFeetToMeters(params.tidalRange);
      }
      if (params.flowVelocityUnit === 'knots') {
        updates.flowVelocity = convertKnotsToMetersPerSecond(params.flowVelocity);
      }
      if (params.impellerAreaUnit === 'ft²') {
        updates.impellerArea = convertSquareFeetToSquareMeters(params.impellerArea);
      }
    } else {
      updates.tidalRangeUnit = 'ft';
      updates.flowVelocityUnit = 'knots';
      updates.impellerAreaUnit = 'ft²';

      if (params.tidalRangeUnit === 'm') {
        updates.tidalRange = convertMetersToFeet(params.tidalRange);
      }
      if (params.flowVelocityUnit === 'm/s') {
        updates.flowVelocity = convertMetersPerSecondToKnots(params.flowVelocity);
      }
      if (params.impellerAreaUnit === 'm²') {
        updates.impellerArea = convertSquareMetersToSquareFeet(params.impellerArea);
      }
    }

    setParams(updates);
  };

  return (
    <div className="bg-ocean-700/50 rounded-xl p-4 border border-ocean-600">
      <div className="flex items-center gap-2 mb-3">
        <Ruler className="w-4 h-4 text-tech-400" />
        <h3 className="text-sm font-medium text-ocean-100">单位系统</h3>
      </div>

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => handleSystemToggle('metric')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            isAllMetric
              ? 'bg-tech-500 text-ocean-900'
              : 'bg-ocean-600 text-ocean-200 hover:bg-ocean-500'
          }`}
        >
          公制
        </button>
        <button
          onClick={() => handleSystemToggle('imperial')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            isAllImperial
              ? 'bg-tech-500 text-ocean-900'
              : 'bg-ocean-600 text-ocean-200 hover:bg-ocean-500'
          }`}
        >
          英制
        </button>
      </div>

      {hasUnitWarning && (
        <div className="flex items-start gap-2 p-2 bg-alert-500/10 border border-alert-500/30 rounded-lg">
          <Gauge className="w-4 h-4 text-alert-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-alert-500">检测到单位混用，建议统一单位系统</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-ocean-400" />
          <span className="text-ocean-300">{params.tidalRangeUnit}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-ocean-400" />
          <span className="text-ocean-300">{params.flowVelocityUnit}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Ruler className="w-3.5 h-3.5 text-ocean-400" />
          <span className="text-ocean-300">{params.impellerAreaUnit}</span>
        </div>
      </div>
    </div>
  );
}
