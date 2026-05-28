import type { ReactNode } from 'react';

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export function Container({ children, className = '' }: ContainerProps) {
  return (
    <div className={`max-w-screen-2xl mx-auto px-6 py-6 ${className}`}>
      {children}
    </div>
  );
}
