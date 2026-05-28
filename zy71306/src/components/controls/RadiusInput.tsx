import { useCalibrationStore } from '../../store/calibrationStore';
import { AlertTriangle } from 'lucide-react';

export default function RadiusInput() {
  const { recordRadius, setRecordRadius, recordRadiusUnit, setRecordRadiusUnit, errors } =
    useCalibrationStore();

  const hasUnitError = errors.some((e) => e.type === 'RADIUS_UNIT_ERROR');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-brass-300">唱片半径</label>
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          max={30}
          step={0.1}
          value={recordRadius}
          onChange={(e) => setRecordRadius(Number(e.target.value))}
          className={`
            flex-1 px-3 py-2 rounded
            bg-walnut-800 border-2
            text-brass-300 font-mono text-lg
            focus:outline-none focus:ring-2
            transition-all duration-200
            ${hasUnitError
              ? 'border-amber-500 focus:ring-amber-500/50'
              : 'border-walnut-600 focus:ring-brass-500/50 focus:border-brass-500'}
          `}
        />

        <div className="flex rounded overflow-hidden border-2 border-walnut-600">
          <button
            onClick={() => setRecordRadiusUnit('cm')}
            className={`
              px-4 py-2 font-medium transition-all duration-200
              ${recordRadiusUnit === 'cm'
                ? 'bg-brass-500 text-walnut-900'
                : 'bg-walnut-700 text-walnut-300 hover:bg-walnut-600'}
            `}
          >
            cm
          </button>
          <button
            onClick={() => setRecordRadiusUnit('inch')}
            className={`
              px-4 py-2 font-medium transition-all duration-200
              ${recordRadiusUnit === 'inch'
                ? 'bg-brass-500 text-walnut-900'
                : 'bg-walnut-700 text-walnut-300 hover:bg-walnut-600'}
            `}
          >
            in
          </button>
        </div>
      </div>

      <div className="text-xs text-walnut-500">
        <p>12英寸唱片: 约15cm (6英寸半径)</p>
        <p>7英寸唱片: 约8.9cm (3.5英寸半径)</p>
      </div>

      {hasUnitError && (
        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-400">
            数值异常，可能是单位混淆！12英寸唱片的半径应为约6英寸，是否误将厘米数值当作英寸输入？
          </p>
        </div>
      )}
    </div>
  );
}
