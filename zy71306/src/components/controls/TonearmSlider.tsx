import { useCalibrationStore } from '../../store/calibrationStore';

export default function TonearmSlider() {
  const { tonearmLength, setTonearmLength, errors } = useCalibrationStore();

  const hasMismatch = errors.some((e) => e.type === 'TONEARM_LENGTH_MISMATCH');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-brass-300">唱臂长度</label>
        <span
          className={`font-mono text-lg font-bold ${hasMismatch ? 'text-amber-500' : 'text-brass-400'}`}
        >
          {Math.round(tonearmLength)} mm
        </span>
      </div>

      <div className="relative">
        <input
          type="range"
          min={200}
          max={300}
          step={1}
          value={tonearmLength}
          onChange={(e) => setTonearmLength(Number(e.target.value))}
          className="w-full h-2 bg-walnut-800 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #D4AF37 0%, #D4AF37 ${((tonearmLength - 200) / 100) * 100}%, #3d2410 ${((tonearmLength - 200) / 100) * 100}%, #3d2410 100%)`,
          }}
        />
      </div>

      <div className="flex justify-between text-xs text-walnut-500">
        <span>200mm</span>
        <span className="text-brass-500">标准: 250mm</span>
        <span>300mm</span>
      </div>

      {hasMismatch && (
        <p className="text-xs text-amber-500 flex items-center gap-1">
          <span>⚠</span>
          超出常见范围 (220-280mm)
        </p>
      )}
    </div>
  );
}
