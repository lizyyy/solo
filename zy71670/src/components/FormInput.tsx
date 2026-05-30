import React from 'react';

interface FormInputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  options?: { value: string; label: string }[];
  unit?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  options,
  unit,
}) => {
  const inputClass = `input-base ${error ? 'border-danger-500 focus:ring-danger-500' : ''}`;

  return (
    <div className="mb-3">
      <label className="label-base">{label}</label>
      <div className="flex items-center gap-2">
        {options ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={inputClass}
          />
        )}
        {unit && <span className="text-sm text-gray-500 w-12">{unit}</span>}
      </div>
      {error && <p className="text-xs text-danger-600 mt-1">{error}</p>}
    </div>
  );
};
