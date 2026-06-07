import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  color?: 'amber' | 'emerald' | 'rose' | 'slate';
}

const colorClasses = {
  amber: 'from-amber-50 to-orange-50 text-amber-900 border-amber-100',
  emerald: 'from-emerald-50 to-teal-50 text-emerald-900 border-emerald-100',
  rose: 'from-rose-50 to-pink-50 text-rose-900 border-rose-100',
  slate: 'from-slate-50 to-gray-50 text-slate-900 border-slate-100',
};

const iconColorClasses = {
  amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  rose: 'bg-rose-100 text-rose-700',
  slate: 'bg-slate-100 text-slate-700',
};

export function StatCard({ title, value, icon: Icon, trend, trendUp, color = 'slate' }: StatCardProps) {
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-5 border shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {trend && (
            <p className={`text-xs mt-2 font-medium ${trendUp ? 'text-emerald-600' : 'text-slate-500'}`}>
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconColorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
