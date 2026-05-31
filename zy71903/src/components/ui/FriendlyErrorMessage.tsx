import { X, Lightbulb } from 'lucide-react';
import { FriendlyError } from '../../types';

interface FriendlyErrorMessageProps {
  error: FriendlyError;
  onDismiss?: () => void;
}

export function FriendlyErrorMessage({ error, onDismiss }: FriendlyErrorMessageProps) {
  const classMap = {
    error: 'friendly-error-error',
    warning: 'friendly-error-warning',
    info: 'friendly-error-info',
  };

  return (
    <div
      className={`friendly-error ${classMap[error.level]} animate-bounce-in`}
      data-error-id={error.id}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium leading-5">{error.message}</p>
          {error.suggestion && (
            <p className="mt-1 text-sm opacity-80 flex items-start gap-1.5">
              <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error.suggestion}</span>
            </p>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 rounded hover:bg-black/5 transition-colors flex-shrink-0"
            aria-label="关闭提示"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

interface FriendlyErrorListProps {
  errors: FriendlyError[];
  onDismiss?: (id: string) => void;
}

export function FriendlyErrorList({ errors, onDismiss }: FriendlyErrorListProps) {
  if (errors.length === 0) return null;

  return (
    <div className="space-y-2">
      {errors.map((error, index) => (
        <div
          key={error.id}
          style={{ animationDelay: `${index * 80}ms` }}
          className="opacity-0"
        >
          <FriendlyErrorMessage
            error={error}
            onDismiss={onDismiss ? () => onDismiss(error.id) : undefined}
          />
        </div>
      ))}
    </div>
  );
}
