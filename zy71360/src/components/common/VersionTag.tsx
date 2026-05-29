import { Film, RotateCcw } from 'lucide-react';

interface VersionTagProps {
  version: string;
  isRollback?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function VersionTag({ version, isRollback = false, size = 'md' }: VersionTagProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-2',
    lg: 'px-4 py-2 text-base gap-2',
  };

  return (
    <span
      className={`inline-flex items-center ${sizeClasses[size]} rounded bg-film-secondary font-mono text-film-text-primary border border-film-border`}
    >
      {isRollback ? (
        <RotateCcw className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} text-film-warning`} />
      ) : (
        <Film className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} text-film-primary`} />
      )}
      v{version}
      {isRollback && (
        <span className="text-film-warning text-xs ml-1">(回滚)</span>
      )}
    </span>
  );
}
