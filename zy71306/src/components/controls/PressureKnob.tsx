import { useCalibrationStore } from '../../store/calibrationStore';
import Knob from '../common/Knob';

export default function PressureKnob() {
  const { stylusPressure, setStylusPressure, errors } = useCalibrationStore();

  const hasHighPressure = errors.some((e) => e.type === 'PRESSURE_TOO_HIGH');
  const hasLowPressure = errors.some((e) => e.type === 'PRESSURE_TOO_LOW');

  const color = hasHighPressure ? 'danger' : hasLowPressure ? 'warning' : 'default';

  return (
    <div className="flex flex-col items-center gap-2">
      <Knob
        value={stylusPressure}
        min={0.5}
        max={3.0}
        step={0.05}
        onChange={setStylusPressure}
        label="唱针压力"
        unit="g"
        size="lg"
        color={color}
      />
      <div className="text-xs text-walnut-400 text-center">
        <p>推荐: 1.5 - 2.0 g</p>
        <p className="text-walnut-500">上下拖动或滚轮调整</p>
      </div>
    </div>
  );
}
