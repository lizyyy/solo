import { FileText, Image, BarChart3 } from 'lucide-react';
import type { RecordType, SourceType, EvidenceType, AnomalyType } from '../types';

interface TypeIconProps {
  type: RecordType;
  className?: string;
}

export const TypeIcon = ({ type, className = 'w-4 h-4' }: TypeIconProps) => {
  const icons: Record<RecordType, React.ReactNode> = {
    note: <FileText className={className} />,
    result: <Image className={className} />,
    data: <BarChart3 className={className} />,
  };
  return <>{icons[type]}</>;
};

interface SourceIconProps {
  source: SourceType;
  className?: string;
}

export const SourceIcon = ({ source, className = 'w-4 h-4' }: SourceIconProps) => {
  const icons: Record<SourceType, React.ReactNode> = {
    teammate: <span className={`${className} flex items-center justify-center text-xs font-bold`}>队</span>,
    model: <span className={`${className} flex items-center justify-center text-xs font-bold`}>模</span>,
    manual: <span className={`${className} flex items-center justify-center text-xs font-bold`}>人</span>,
  };
  return <>{icons[source]}</>;
};

interface EvidenceIconProps {
  type: EvidenceType;
  className?: string;
}

export const EvidenceIcon = ({ type, className = 'w-4 h-4' }: EvidenceIconProps) => {
  const icons: Record<EvidenceType, React.ReactNode> = {
    note: <FileText className={className} />,
    confirmation: <span className={`${className} flex items-center justify-center text-xs font-bold text-green-400`}>✓</span>,
    model: <span className={`${className} flex items-center justify-center text-xs font-bold text-blue-400`}>AI</span>,
  };
  return <>{icons[type]}</>;
};

interface AnomalyIconProps {
  type: AnomalyType;
  className?: string;
}

export const AnomalyIcon = ({ type, className = 'w-4 h-4' }: AnomalyIconProps) => {
  const icons: Record<AnomalyType, React.ReactNode> = {
    drift: <span className={`${className} flex items-center justify-center text-xs`}>📉</span>,
    unit_mismatch: <span className={`${className} flex items-center justify-center text-xs`}>📏</span>,
    constraint_override: <span className={`${className} flex items-center justify-center text-xs`}>🔓</span>,
    late_attachment: <span className={`${className} flex items-center justify-center text-xs`}>⏰</span>,
    duplicate: <span className={`${className} flex items-center justify-center text-xs`}>📋</span>,
  };
  return <>{icons[type]}</>;
};
