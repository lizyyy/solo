import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useGameStore } from '../../store/useGameStore';

export function CurveChart() {
  const { history, currentLevel } = useGameStore();

  if (!currentLevel || history.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 h-64 flex items-center justify-center">
        <p className="text-slate-400 text-sm">等待游戏数据...</p>
      </div>
    );
  }

  const chartData = history.map((state) => ({
    time: state.time,
    inflow: state.inflow,
    outflow: state.outflow,
    storage: (state.reservoirStorage / currentLevel.maxStorage) * 100,
  }));

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <h3 className="text-lg font-bold text-white mb-3">过程曲线</h3>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              label={{ value: '时间(h)', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 10 }}
            />
            <YAxis
              yAxisId="left"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              label={{ value: '流量(m³/s)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              domain={[0, 100]}
              label={{ value: '库容(%)', angle: 90, position: 'insideRight', fill: '#94a3b8', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff',
              }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              formatter={(value) => <span className="text-slate-300">{value}</span>}
            />
            
            <ReferenceLine
              yAxisId="left"
              y={currentLevel.warningDischarge}
              stroke="#f59e0b"
              strokeDasharray="3 3"
              label={{ value: '预警线', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }}
            />
            <ReferenceLine
              yAxisId="left"
              y={currentLevel.safeDischarge}
              stroke="#ef4444"
              strokeDasharray="3 3"
              label={{ value: '安全线', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }}
            />
            
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="inflow"
              name="来水"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="outflow"
              name="泄流"
              stroke="#06b6d4"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="storage"
              name="库容"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
