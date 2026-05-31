import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { useAppStore } from '../../store/useAppStore';
import { getTrendData } from '../../utils/calculations';

export function TrendChart() {
  const { batches, deviations, students, voiceParts, selectedBatchId, setSelectedBatchId } = useAppStore();

  const trendData = getTrendData(batches, deviations, students, voiceParts);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-card border border-cream-200">
          <p className="text-sm font-semibold text-primary mb-2">{data?.batchId}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {entry.value} 音分
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const handleClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload?.batchId) {
      setSelectedBatchId(data.activePayload[0].payload.batchId);
    }
  };

  return (
    <div className="card p-5 mb-6 animate-slide-up animate-stagger-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-lg font-semibold text-primary flex items-center gap-2">
          <span className="w-1 h-5 bg-accent rounded-full" />
          音准趋势变化
        </h3>
        <div className="flex items-center gap-4 text-xs text-primary-500">
          <span>单位：音分（cents）</span>
          <span className="text-primary-400">点击数据点切换批次</span>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={trendData}
            onClick={handleClick}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              {voiceParts.map((vp) => (
                <linearGradient key={vp.id} id={`gradient-${vp.name}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={vp.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={vp.color} stopOpacity={0} />
                </linearGradient>
              ))}
              <linearGradient id="gradient-average" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d4a855" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#d4a855" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e0cf" />
            <XAxis 
              dataKey="date" 
              tick={{ fill: '#588686', fontSize: 12 }}
              axisLine={{ stroke: '#d4c8b0' }}
            />
            <YAxis 
              tick={{ fill: '#588686', fontSize: 12 }}
              axisLine={{ stroke: '#d4c8b0' }}
              domain={[0, 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              formatter={(value) => <span className="text-primary-600">{value}</span>}
            />
            
            {voiceParts.map((vp) => (
              <Area
                key={vp.id}
                type="monotone"
                dataKey={vp.name}
                name={vp.displayName}
                stroke={vp.color}
                fill={`url(#gradient-${vp.name})`}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
            ))}
            
            <Line
              type="monotone"
              dataKey="average"
              name="总体平均"
              stroke="#d4a855"
              strokeWidth={3}
              dot={{ r: 5, fill: '#d4a855', stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 7, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 pt-3 border-t border-cream-200 flex items-center justify-between text-xs text-primary-500">
        <div className="flex items-center gap-4">
          <span>
            <span className="font-medium text-primary-600">基准线：</span>
            30音分以内为正常范围
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedBatchId && (
            <span className="px-2 py-0.5 bg-accent/10 text-accent-700 rounded">
              当前选中批次: {trendData.find(d => d.batchId === selectedBatchId)?.date}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
