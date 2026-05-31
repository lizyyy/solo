import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: string;
  delay?: number;
  onClick?: () => void;
}

export default function StatCard({ icon, label, value, accent, delay, onClick }: StatCardProps) {
  return (
    <div
      className={[
        'bg-slate-card rounded-lg p-4 border transition-all duration-300 hover:border-slate-lighter',
        accent ? `border-l-4 ${accent}` : '',
        onClick ? 'cursor-pointer hover:bg-slate-hover' : '',
        'animate-fade-in-up',
      ].join(' ')}
      style={{ animationDelay: `${(delay || 0) * 100}ms` }}
      onClick={onClick}
    >
      <div className="opacity-60">{icon}</div>
      <div className="text-slate-400 text-xs mt-2">{label}</div>
      <div className="font-mono text-2xl font-semibold text-white mt-1">{value}</div>
    </div>
  );
}
