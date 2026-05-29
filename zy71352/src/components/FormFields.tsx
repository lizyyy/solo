import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '../lib/utils';
import { History } from 'lucide-react';

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  showHistory?: boolean;
  onHistoryClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  error,
  hint,
  required,
  showHistory,
  onHistoryClick,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1 text-sm font-medium text-stone-700">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
        {showHistory && (
          <button
            type="button"
            onClick={onHistoryClick}
            className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
            title="查看历史变更"
          >
            <History className="w-4 h-4" />
          </button>
        )}
      </div>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-stone-400">{hint}</p>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string | boolean;
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      className={cn(
      'w-full px-3 py-2 rounded-lg border text-sm transition-colors',
      'bg-white focus:outline-none focus:ring-2',
      error
        ? 'border-red-300 focus:ring-red-200 focus:border-red-400'
        : 'border-stone-300 focus:ring-slate-200 focus:border-slate-400',
      className
    )}
      {...props}
    />
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export function Textarea({ className, error, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
      'w-full px-3 py-2 rounded-lg border text-sm transition-colors resize-none',
      'bg-white focus:outline-none focus:ring-2',
      error
        ? 'border-red-300 focus:ring-red-200 focus:border-red-400'
        : 'border-stone-300 focus:ring-slate-200 focus:border-slate-400',
      className
    )}
      {...props}
    />
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export function Select({ className, error, options, ...props }: SelectProps) {
  return (
    <select
      className={cn(
      'w-full px-3 py-2 rounded-lg border text-sm transition-colors',
      'bg-white focus:outline-none focus:ring-2',
      error
        ? 'border-red-300 focus:ring-red-200 focus:border-red-400'
        : 'border-stone-300 focus:ring-slate-200 focus:border-slate-400',
      className
    )}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
