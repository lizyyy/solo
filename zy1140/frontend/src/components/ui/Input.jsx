import { cn } from '../utils/cn';

export const Input = ({
  label,
  error,
  helperText,
  className,
  ...props
}) => (
  <div className="space-y-1">
    {label && (
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
    )}
    <input
      className={cn(
        'w-full px-3 py-2 border rounded-lg text-sm',
        'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
        'border-gray-300 dark:border-gray-600',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        error && 'border-red-500 focus:ring-red-500',
        className
      )}
      {...props}
    />
    {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    {helperText && !error && <p className="text-sm text-gray-500">{helperText}</p>}
  </div>
);

export const Textarea = ({
  label,
  error,
  helperText,
  className,
  rows = 3,
  ...props
}) => (
  <div className="space-y-1">
    {label && (
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
    )}
    <textarea
      rows={rows}
      className={cn(
        'w-full px-3 py-2 border rounded-lg text-sm resize-y',
        'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
        'border-gray-300 dark:border-gray-600',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        error && 'border-red-500 focus:ring-red-500',
        className
      )}
      {...props}
    />
    {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    {helperText && !error && <p className="text-sm text-gray-500">{helperText}</p>}
  </div>
);

export const Select = ({
  label,
  options,
  value,
  onChange,
  error,
  className,
  ...props
}) => (
  <div className="space-y-1">
    {label && (
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
    )}
    <select
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      className={cn(
        'w-full px-3 py-2 border rounded-lg text-sm',
        'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
        'border-gray-300 dark:border-gray-600',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        error && 'border-red-500 focus:ring-red-500',
        className
      )}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
  </div>
);
