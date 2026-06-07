import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TrainingLog } from '@/types';

interface LogChartProps {
  trainingLog: TrainingLog;
}

export function LogChart({ trainingLog }: LogChartProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600">批次ID: <code className="bg-slate-100 px-1.5 py-0.5 text-xs">{trainingLog.batchId}</code></p>
          <p className="text-xs text-slate-500 mt-1">导入时间: {trainingLog.importTime}</p>
        </div>
        {trainingLog.isDuplicate && (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            ⚠️ 重复训练
          </span>
        )}
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trainingLog.curveData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="epoch" label={{ value: 'Epoch', position: 'insideBottom', offset: -5 }} fontSize={12} />
            <YAxis yAxisId="left" label={{ value: 'Loss', angle: -90, position: 'insideLeft' }} fontSize={12} />
            <YAxis yAxisId="right" orientation="right" label={{ value: 'Accuracy', angle: 90, position: 'insideRight' }} fontSize={12} />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', fontSize: '12px' }}
              formatter={(value: number, name: string) => [value.toFixed(4), name]}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line yAxisId="left" type="monotone" dataKey="loss" stroke="#dc2626" strokeWidth={2} dot={false} name="Loss" />
            <Line yAxisId="right" type="monotone" dataKey="accuracy" stroke="#059669" strokeWidth={2} dot={false} name="Accuracy" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
