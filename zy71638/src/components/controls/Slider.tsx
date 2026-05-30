interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

export function Slider({ value, min, max, step = 0.01, onChange }: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className="relative w-full h-6">
      <div className="absolute inset-y-1/2 w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-400 rounded-full shadow-lg pointer-events-none transition-all"
        style={{ left: `calc(${percentage}% - 8px)` }}
      />
    </div>
  );
}
