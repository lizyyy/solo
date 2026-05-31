import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: number;
  color: string;
  subtitle?: string;
}

export default function StatCard({ title, value, icon: Icon, trend, color, subtitle }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-slate-800/50 border border-slate-700/50 p-5 transition-all duration-300 hover:border-slate-600 hover:bg-slate-800">
      <div
        className="absolute top-0 right-0 w-32 h-32 opacity-10 blur-3xl"
        style={{ backgroundColor: color, transform: 'translate(30%, -30%)' }}
      />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-400 text-sm font-medium">{title}</p>
            <p className="mt-2 text-3xl font-bold text-white font-mono">
              {value}
            </p>
            {subtitle && (
              <p className="mt-1 text-slate-500 text-xs">{subtitle}</p>
            )}
          </div>
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon className="w-6 h-6" style={{ color }} />
          </div>
        </div>
        {trend !== undefined && (
          <div className="mt-3 flex items-center gap-1">
            {trend >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span
              className={`text-sm font-medium ${
                trend >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {trend >= 0 ? '+' : ''}{trend}%
            </span>
            <span className="text-slate-500 text-sm">较昨日</span>
          </div>
        )}
      </div>
    </div>
  );
}
