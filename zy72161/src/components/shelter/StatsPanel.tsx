import React from 'react';
import { Users, AlertTriangle, CheckCircle, MapPin, TrendingUp } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { useShelter } from '@/hooks/useShelter';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const trendData = [
  { day: '5/28', count: 280, over: 1 },
  { day: '5/29', count: 320, over: 1 },
  { day: '5/30', count: 380, over: 2 },
  { day: '5/31', count: 350, over: 1 },
  { day: '6/1', count: 420, over: 2 },
  { day: '6/2', count: 1340, over: 3 }
];

export const StatsPanel: React.FC = () => {
  const { stats } = useShelter();

  return (
    <div className="absolute left-4 top-4 z-20 w-72 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          title="已处理"
          value={stats.processed}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="待核实"
          value={stats.pending}
          icon={AlertTriangle}
          color="orange"
        />
        <StatCard
          title="需现场复看"
          value={stats.onsite}
          icon={MapPin}
          color="red"
        />
        <StatCard
          title="容量超限"
          value={stats.overCapacity}
          icon={Users}
          color="red"
        />
      </div>

      <div className="rounded-xl border border-gray-700/50 bg-gray-800/80 p-4 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-200">容量超限趋势</h3>
          <TrendingUp className="h-4 w-4 text-blue-400" />
        </div>
        <div className="h-28 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '6px',
                  color: '#F3F4F6',
                  fontSize: '12px'
                }}
                formatter={(value: number) => [`${value}人`, '反馈人数']}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#DC2626"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCount)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-gray-400">近7天反馈总数</span>
          <span className="font-mono font-medium text-gray-200">3,090人</span>
        </div>
      </div>

      <div className="rounded-xl border border-gray-700/50 bg-gray-800/80 p-4 backdrop-blur-md">
        <h3 className="mb-3 text-sm font-medium text-gray-200">跨时段统计</h3>
        <div className="space-y-2">
          {[
            { label: '早高峰(6-10)', count: 400, capacity: 500, color: 'bg-blue-500' },
            { label: '午间(10-14)', count: 300, capacity: 500, color: 'bg-yellow-500' },
            { label: '下午(14-18)', count: 680, capacity: 500, color: 'bg-red-500' },
            { label: '晚高峰(18-22)', count: 820, capacity: 500, color: 'bg-red-500' },
            { label: '夜间(22-6)', count: 290, capacity: 500, color: 'bg-purple-500' }
          ].map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{item.label}</span>
                <span className={item.count > item.capacity ? 'text-red-400 font-mono' : 'text-gray-300 font-mono'}>
                  {item.count} / {item.capacity}人
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-700">
                <div
                  className={`h-full ${item.color} transition-all duration-500`}
                  style={{ width: `${Math.min((item.count / item.capacity) * 100, 120)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
