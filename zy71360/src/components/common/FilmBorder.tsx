import type { ReactNode } from 'react';

interface FilmBorderProps {
  children: ReactNode;
  className?: string;
}

export function FilmBorder({ children, className = '' }: FilmBorderProps) {
  return (
    <div className={`relative film-border py-2 ${className}`}>
      <div className="pt-2 pb-2">
        {children}
      </div>
    </div>
  );
}
