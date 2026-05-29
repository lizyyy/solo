import { useMemo, useState } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3, Clock, Zap, Battery } from 'lucide-react';
import { useEstimationStore } from '@/store/useEstimationStore';
import type { PeriodIntegrationResult } from '@/types';
import { cn } from '@/lib/utils';

type ChartType = 'power' | 'energy';

interface ChartDataPoint {
  time: string;
  hour: number;
  power: number;
  energy: number;
  valid: boolean;
}

function transformData(periodIntegration: PeriodIntegrationResult[]): ChartDataPoint[] {
  const dataPoints: ChartDataPoint[] = [];
  
  periodIntegration.forEach((segment) => {
    const [startStr, endStr] = segment.timeRange.split('-');
    const startHour = parseFloat(startStr);
    const endHour = parseFloat(endStr);
    const midHour = (startHour + endHour) / 2;
    
    dataPoints.push({
      time: `${Math.floor(startHour)}:00`,
      hour: startHour,
      power: 0,
      energy: 0,
      valid: segment.valid,
    });
    
    dataPoints.push({
      time: `${Math.floor(midHour)}:${Math.round((midHour % 1) * 60).toString().padStart(2, '0')}`,
      hour: midHour,
      power: segment.power,
      energy: segment.energy / (endHour - startHour),
      valid: segment.valid,
    });
    
    dataPoints.push({
      time: `${Math.floor(endHour)}:00`,
      hour: endHour,
      power: 0,
      energy: 0,
      valid: segment.valid,
    });
  });
  
  return dataPoints.sort((a, b) => a.hour - b.hour);
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-ocean-800/95 backdrop-blur-sm border border-ocean-600 rounded-lg p-3 shadow-xl animate-fade-in">
      <p className="text-xs text-ocean-300 mb-2 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {label}
      </p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-4 text-xs">
          <span className="text-ocean-200">{entry.name}</span>
          <span className="font-mono" style={{ color: entry.color }}>
            {entry.value.toFixed(2)}
            {entry.name.includes('功率') ? ' kW' : ' kWh'}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PeriodIntegrationChart() {
  const { result } = useEstimationStore();
  const [chartType, setChartType] = useState<ChartType>('power');

  const chartData = useMemo(() => {
    if (!result?.periodIntegration) return [];
    return transformData(result.periodIntegration);
  }, [result]);

  if (!result) {
    return (
      <div className="bg-ocean-700/50 backdrop-blur-sm rounded-xl border border-ocean-600 p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-tech-400" />
          <h3 className="text-base font-semibold text-white">周期积分曲线</h3>
        </div>
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <BarChart3 className="w-10 h-10 text-ocean-500 mx-auto mb-3 opacity-50" />
            <p className="text-ocean-400 text-sm">完成计算后显示24小时曲线</p>
          </div>
        </div>
      </div>
    );
  }

  const totalPower = result.periodIntegration.reduce((sum, s) => sum + s.power, 0);
  const totalEnergy = result.periodIntegration.reduce((sum, s) => sum + s.energy, 0);

  return (
    <div className="bg-ocean-700/50 backdrop-blur-sm rounded-xl border border-ocean-600 p-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-tech-400" />
          <h3 className="text-base font-semibold text-white">24小时周期积分曲线</h3>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-ocean-800/50 rounded-lg p-1">
            <button
              onClick={() => setChartType('power')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all',
                chartType === 'power'
                  ? 'bg-tech-500/20 text-tech-400'
                  : 'text-ocean-400 hover:text-ocean-200'
              )}
            >
              <Zap className="w-3.5 h-3.5" />
              功率
            </button>
            <button
              onClick={() => setChartType('energy')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all',
                chartType === 'energy'
                  ? 'bg-success-500/20 text-success-500'
                  : 'text-ocean-400 hover:text-ocean-200'
              )}
            >
              <Battery className="w-3.5 h-3.5" />
              能量
            </button>
          </div>
          
          <div className="hidden sm:flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-tech-400" />
              <span className="text-ocean-300">峰值功率:</span>
              <span className="text-tech-400 font-mono">{(totalPower / 4).toFixed(1)} kW</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Battery className="w-3.5 h-3.5 text-success-500" />
              <span className="text-ocean-300">总能量:</span>
              <span className="text-success-500 font-mono">{totalEnergy.toFixed(1)} kWh</span>
            </div>
          </div>
        </div>
      </div>

      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'power' ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#4a6b8c"
                tick={{ fill: '#8aa8c8', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1a3a5c' }}
              />
              <YAxis
                stroke="#4a6b8c"
                tick={{ fill: '#8aa8c8', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1a3a5c' }}
                tickFormatter={(value) => `${value.toFixed(0)}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="power"
                name="输出功率"
                stroke="#00d4ff"
                strokeWidth={2}
                fill="url(#powerGradient)"
                animationDuration={1200}
                animationBegin={200}
              />
            </AreaChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00c896" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00c896" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#4a6b8c"
                tick={{ fill: '#8aa8c8', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1a3a5c' }}
              />
              <YAxis
                stroke="#4a6b8c"
                tick={{ fill: '#8aa8c8', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1a3a5c' }}
                tickFormatter={(value) => `${value.toFixed(0)}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="energy"
                name="累积能量"
                stroke="#00c896"
                strokeWidth={2.5}
                dot={{ fill: '#00c896', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: '#00c896', stroke: '#020910', strokeWidth: 2 }}
                animationDuration={1200}
                animationBegin={200}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="flex sm:hidden items-center justify-around mt-4 pt-4 border-t border-ocean-600/50 text-xs">
        <div className="text-center">
          <p className="text-ocean-400">峰值功率</p>
          <p className="text-tech-400 font-mono text-sm">{(totalPower / 4).toFixed(1)} kW</p>
        </div>
        <div className="text-center">
          <p className="text-ocean-400">总能量</p>
          <p className="text-success-500 font-mono text-sm">{totalEnergy.toFixed(1)} kWh</p>
        </div>
      </div>
    </div>
  );
}
