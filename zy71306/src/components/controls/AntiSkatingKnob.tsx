import { useCalibrationStore } from '../../store/calibrationStore';
import Knob from '../common/Knob';
import { RotateCcw, AlertTriangle } from 'lucide-react';

export default function AntiSkatingKnob() {
  const { antiSkating, setAntiSkating, antiSkatingDirection, setAntiSkatingDirection } =
    useCalibrationStore();

  const hasDirectionError = antiSkatingDirection === 'reverse';

  return (
    <div className="flex flex-col items-center gap-2">
      <Knob
        value={antiSkating}
        min={0}
        max={3}
        step={0.1}
        onChange={setAntiSkating}
        label="抗滑力"
        size="md"
        color={hasDirectionError ? 'danger' : 'default'}
      />

      <button
        onClick={() =>
          setAntiSkatingDirection(antiSkatingDirection === 'normal' ? 'reverse' : 'normal')
        }
        className={`
          flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium
          transition-all duration-200
          ${hasDirectionError
            ? 'bg-danger-600 text-white shadow-lg shadow-danger-500/30'
            : 'bg-walnut-700 text-brass-300 hover:bg-walnut-600'}
        `}
      >
        {hasDirectionError ? (
          <>
            <AlertTriangle size={12} />
            方向错误
          </>
        ) : (
          <>
            <RotateCcw size={12} />
            正常方向
          </>
        )}
      </button>

      <div className="text-xs text-walnut-400 text-center">
        <p>点击按钮切换方向</p>
      </div>
    </div>
  );
}
