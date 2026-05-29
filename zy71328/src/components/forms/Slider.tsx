import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
}

export default function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit,
  className,
}: SliderProps) {
  const [inputValue, setInputValue] = useState<string>(value.toString());

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const percentage = ((value - min) / (max - min)) * 100;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    const numValue = Number(newValue);
    onChange(numValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    let numValue = Number(inputValue);
    if (isNaN(numValue)) {
      numValue = min;
    }
    numValue = Math.max(min, Math.min(max, numValue));
    numValue = Math.round(numValue / step) * step;
    onChange(numValue);
    setInputValue(numValue.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleInputBlur();
    }
  };

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <label className="text-sm text-text-secondary w-24 flex-shrink-0">
        {label}
      </label>
      <div className="flex-1 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-2 w-full rounded-full bg-bg-tertiary overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent-cyan to-accent-purple shadow-neon-sm"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSliderChange}
          className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-accent-cyan border-2 border-white shadow-neon pointer-events-none"
          style={{ left: `calc(${percentage}% - 10px)` }}
        />
      </div>
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          className="w-16 px-2 py-1 text-sm text-text-primary bg-bg-tertiary border border-border-default rounded-md text-center focus:outline-none focus:border-accent-cyan focus:shadow-neon-sm transition-all"
        />
        {unit && <span className="text-text-muted text-sm ml-1">{unit}</span>}
      </div>
    </div>
  );
}
