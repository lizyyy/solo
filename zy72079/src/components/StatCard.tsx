import { TrendingUp, CheckCircle, Clock, Database, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  type: 'total' | 'success' | 'pending' | 'legacy' | 'error';
}

const iconMap: Record<string, LucideIcon> = {
  total: TrendingUp,
  success: CheckCircle,
  pending: Clock,
  legacy: Database,
  error: AlertTriangle,
};

const colorMap: Record<string, string> = {
  total: 'text-primary-600',
  success: 'text-green-600',
  pending: 'text-amber-600',
  legacy: 'text-purple-600',
  error: 'text-red-600',
};

export function StatCard({ title, value, type }: StatCardProps) {
  const Icon = iconMap[type];
  const colorClass = colorMap[type];

  return (
    <div className="card p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${colorClass} font-display`}>{value}</p>
        </div>
        <div className={`p-3 rounded-full ${colorClass.replace('text', 'bg').replace('600', '100')}`}>
          <Icon className={`w-6 h-6 ${colorClass}`} />
        </div>
      </div>
    </div>
  );
}
