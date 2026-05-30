import { useState } from 'react';
import { Info } from 'lucide-react';

interface ParameterSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  description?: string;
  disabled?: boolean;
}

export const ParameterSlider = ({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  description,
  disabled = false,
}: ParameterSliderProps) => {
  const [inputValue, setInputValue] = useState(value.toString());
  const [showDescription, setShowDescription] = useState(false);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onChange(newValue);
    setInputValue(newValue.toString());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    let newValue = parseFloat(inputValue);
    if (isNaN(newValue)) {
      newValue = value;
    }
    newValue = Math.max(min, Math.min(max, newValue));
    onChange(newValue);
    setInputValue(newValue.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    }
  };

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`mb-4 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <label className="text-sm font-medium text-gray-300">{label}</label>
          {description && (
            <button
              type="button"
              className="text-gray-500 hover:text-gray-300 transition-colors"
              onMouseEnter={() => setShowDescription(true)}
              onMouseLeave={() => setShowDescription(false)}
            >
              <Info size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="w-20 px-2 py-1 text-sm bg-slate-800/50 border border-slate-600 rounded text-right text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <span className="text-sm text-gray-400 w-8">{unit}</span>
        </div>
      </div>

      {description && showDescription && (
        <div className="mb-2 p-2 text-xs text-gray-400 bg-slate-800/80 rounded border border-slate-700">
          {description}
        </div>
      )}

      <div className="relative h-2">
        <div className="absolute inset-0 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-green-400 rounded-full transition-all duration-100"
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
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex justify-between mt-1 text-xs text-gray-500">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};
