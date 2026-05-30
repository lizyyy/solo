interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function Slider({ label, value, min, max, step, unit, onChange, disabled }: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-300 font-jetbrains">{label}</span>
        <span className="text-sm text-cyber-500 font-jetbrains font-bold">
          {value.toLocaleString()} {unit}
        </span>
      </div>
      <div className="relative h-2 bg-space-700 rounded-full overflow-hidden">
        <div
          className="absolute h-full bg-gradient-to-r from-cyber-600 to-cyber-400 rounded-full transition-all duration-150"
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>
      <div className="flex justify-between mt-1 text-xs text-gray-500">
        <span>{min.toLocaleString()}</span>
        <span>{max.toLocaleString()}</span>
      </div>
    </div>
  );
}
