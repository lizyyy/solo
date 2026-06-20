import { CheckCircle2, XCircle, Hash, Clock, Scale } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number;
  total?: number;
  variant: 'total' | 'normal' | 'abnormal' | 'unit' | 'pending';
  delay?: number;
}

const iconMap = {
  total: Hash,
  normal: CheckCircle2,
  abnormal: XCircle,
  unit: Scale,
  pending: Clock,
};

const colorMap = {
  total: 'text-academic-600 bg-academic-50 border-academic-200',
  normal: 'text-status-normal bg-status-normal/5 border-status-normal/20',
  abnormal: 'text-status-abnormal bg-status-abnormal/5 border-status-abnormal/20',
  unit: 'text-status-unit bg-status-unit/5 border-status-unit/20',
  pending: 'text-status-pending bg-status-pending/5 border-status-pending/20',
};

export default function StatCard({ label, value, total, variant, delay = 0 }: StatCardProps) {
  const Icon = iconMap[variant];
  const color = colorMap[variant];
  const percentage = total ? ((value / total) * 100).toFixed(1) : null;

  return (
    <div
      className={`card-academic p-5 border ${color} animate-fade-in-up stagger-${delay}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {percentage !== null && (
          <span className="text-[11px] font-medium text-academic-500 bg-academic-50 px-2 py-0.5 rounded-full">
            {percentage}%
          </span>
        )}
      </div>
      <p className="text-3xl font-display font-bold text-academic-800 mb-1 tabular-nums">
        {value}
      </p>
      <p className="text-sm text-academic-500">{label}</p>
    </div>
  );
}
