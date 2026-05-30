import type { ComponentType } from '@/types';
import { cn } from '@/lib/utils';

interface CircuitIconProps {
  type: ComponentType;
  className?: string;
}

export function CircuitIcon({ type, className }: CircuitIconProps) {
  switch (type) {
    case 'power':
      return (
        <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="currentColor">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
    case 'switch':
      return (
        <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="12" x2="10" y2="12" />
          <line x1="14" y1="12" x2="20" y2="12" />
          <circle cx="10" cy="12" r="1.5" fill="currentColor" />
          <circle cx="14" cy="12" r="1.5" fill="currentColor" />
          <line x1="10" y1="12" x2="16" y2="6" strokeWidth="2.5" />
        </svg>
      );
    case 'bulb':
      return (
        <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="currentColor">
          <path d="M9 21h6v-2H9v2zm3-19c-3.31 0-6 2.69-6 6 0 2.38 1.19 4.47 3 5.74V17h6v-3.26c1.81-1.27 3-3.36 3-5.74 0-3.31-2.69-6-6-6z" />
        </svg>
      );
    case 'resistor':
      return (
        <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
          <polyline points="6,12 8,8 10,16 12,8 14,16 16,8 18,12" fill="none" strokeWidth="2.5" />
        </svg>
      );
    case 'bar':
      return (
        <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="currentColor">
          <path d="M1 21h22v2H1v-2zm2-3h18v2H3v-2zm2-3h14v2H5v-2zm2-3h10v2H7v-2zm2-3h6v2H9V7zm2-3h2v2h-2V4z" />
        </svg>
      );
    default:
      return null;
  }
}

export function VoltageIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-4 h-4', className)} fill="currentColor">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

export function CurrentIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-4 h-4', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M5 9l7-7 7 7M5 15l7 7 7-7" />
    </svg>
  );
}

export function WarningIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function SuccessIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22,4 12,14.01 9,11.01" />
    </svg>
  );
}

export function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  );
}

export function ScoreIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="currentColor">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </svg>
  );
}

export function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function ZapIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="currentColor">
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" />
    </svg>
  );
}

export function FlameIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="currentColor">
      <path d="M12 23c-4.97 0-9-3.58-9-8 0-2.52 1.17-5.06 3.5-7.6C9.83 4.83 12 2 12 2s2.17 2.83 5.5 5.4C19.83 9.94 21 12.48 21 15c0 4.42-4.03 8-9 8zm0-4c1.65 0 3-1.35 3-3 0-2-3-4-3-4s-3 2-3 4c0 1.65 1.35 3 3 3z" />
    </svg>
  );
}

export function GitBranchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="6" cy="3" r="3" />
      <circle cx="18" cy="6" r="3" />
      <path d="M18 9v1a4 4 0 0 1-4 4H8" />
    </svg>
  );
}

export function JumpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="currentColor">
      <polygon points="5,3 19,12 5,21 5,3" />
    </svg>
  );
}

export function PauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="currentColor">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

export function SkipBackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="19,20 9,12 19,4 19,20" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </svg>
  );
}

export function SkipForwardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="5,4 15,12 5,20 5,4" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  );
}

export function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7,10 12,15 17,10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

export function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}

export function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  );
}

export function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function RotateCcwIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="1,4 1,10 7,10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

export function CircuitBoardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <line x1="7" y1="7" x2="7" y2="7.01" />
      <line x1="7" y1="12" x2="7" y2="12.01" />
      <line x1="7" y1="17" x2="7" y2="17.01" />
      <line x1="12" y1="7" x2="12" y2="7.01" />
      <line x1="12" y1="12" x2="12" y2="12.01" />
      <line x1="12" y1="17" x2="12" y2="17.01" />
      <line x1="17" y1="7" x2="17" y2="7.01" />
      <line x1="17" y1="12" x2="17" y2="12.01" />
      <line x1="17" y1="17" x2="17" y2="17.01" />
      <line x1="7.5" y1="7.5" x2="11.5" y2="11.5" />
      <line x1="12.5" y1="12.5" x2="16.5" y2="16.5" />
      <line x1="7.5" y1="12.5" x2="11.5" y2="7.5" />
    </svg>
  );
}

export function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22,4 12,14.01 9,11.01" />
    </svg>
  );
}

export function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
