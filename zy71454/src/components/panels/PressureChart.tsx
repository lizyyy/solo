import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { PianoKeyData } from '../../types';

interface PressureChartProps {
  keyData: PianoKeyData;
}

export default function PressureChart({ keyData }: PressureChartProps) {
  const chartData = useMemo(() => {
    return keyData.pressureCurve.map((value, index) => ({
      time: (index / 19 * 100).toFixed(0) + '%',
      pressure: value,
    }));
  }, [keyData.pressureCurve]);

  const getStatusColor = () => {
    switch (keyData.status) {
      case 'normal': return '#22c55e';
      case 'warning': return '#eab308';
      case 'error': return '#ef4444';
    }
  };

  return (
    <div className="bg-zinc-800/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-zinc-300">压力曲线</h4>
        <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: getStatusColor() + '20', color: getStatusColor() }}>
          {keyData.status === 'normal' ? '正常' : keyData.status === 'warning' ? '警告' : '异常'}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="pressureGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff6b35" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ff6b35" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} domain={['dataMin - 10', 'dataMax + 10']} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1e', border: '1px solid #333', borderRadius: '8px', color: '#fff' }}
            labelStyle={{ color: '#888' }}
            formatter={(value: number) => [`${value}g`, '压力']}
          />
          <Area type="monotone" dataKey="pressure" stroke="#ff6b35" strokeWidth={2} fill="url(#pressureGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
