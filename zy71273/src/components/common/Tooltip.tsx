import { ReactNode, useState } from 'react';
import { twMerge } from 'tailwind-merge';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  delay?: number;
}

export function Tooltip({ children, content, position = 'top', className = '', delay = 200 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  let timeout: ReturnType<typeof setTimeout>;

  const show = () => {
    timeout = setTimeout(() => setIsVisible(true), delay);
  };

  const hide = () => {
    clearTimeout(timeout);
    setIsVisible(false);
  };

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowPositions = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-white/90',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-white/90',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-white/90',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-white/90'
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      
      {isVisible && (
        <div
          className={twMerge(
            'absolute z-50 px-3 py-2 text-xs font-medium text-white bg-white/90 text-gray-900 rounded-lg shadow-xl whitespace-nowrap pointer-events-none',
            'animate-in fade-in-0 zoom-in-95 duration-200',
            positions[position],
            className
          )}
        >
          {content}
          <div
            className={twMerge(
              'absolute w-0 h-0 border-4 border-transparent',
              arrowPositions[position]
            )}
          />
        </div>
      )}
    </div>
  );
}
