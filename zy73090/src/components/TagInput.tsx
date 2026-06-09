import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TagInput({ value, onChange, placeholder, className }: TagInputProps) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setInput('');
      return;
    }
    onChange([...value, trimmed]);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div
      className={cn(
        'flex min-h-[42px] w-full flex-wrap items-center gap-2 rounded-lg border border-bg-border bg-bg-card px-3 py-2 focus-within:border-brand-500/50 focus-within:ring-2 focus-within:ring-brand-500/20',
        className,
      )}
    >
      {value.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className="inline-flex animate-fade-in items-center gap-1 rounded-md bg-brand-600/25 px-2.5 py-1 text-xs font-medium text-brand-100 border border-brand-500/30"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(idx)}
            className="ml-0.5 rounded-sm opacity-70 transition-opacity hover:opacity-100 hover:bg-brand-500/30"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (input.trim()) addTag();
        }}
        placeholder={value.length === 0 ? placeholder : undefined}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
      />
    </div>
  );
}
