import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  colorClass: string;
  trend?: number;
}

export default function StatCard({ title, value, icon: Icon, colorClass, trend }: StatCardProps) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-card hover:shadow-card-hover transition-shadow duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted font-medium">{title}</span>
        <Icon className={`w-5 h-5 ${colorClass}`} strokeWidth={2} />
      </div>
      <div className="transition-transform duration-150 ease-out hover:scale-[1.03]">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
      </div>
      {trend !== undefined && (
        <div className="mt-2 flex items-center">
          {trend >= 0 ? (
            <span className="inline-flex items-center text-xs font-medium text-success">
              +{trend}
            </span>
          ) : (
            <span className="inline-flex items-center text-xs font-medium text-danger">
              {trend}
            </span>
          )}
          <span className="text-xs text-muted ml-1.5">较上周</span>
        </div>
      )}
    </div>
  );
}
