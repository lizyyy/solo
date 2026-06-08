import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import type { Route, DetectionIssue } from '../types';

interface RouteChartProps {
  routes: Route[];
  issues: DetectionIssue[];
}

export function RouteChart({ routes, issues }: RouteChartProps) {
  const chartData = routes.map(route => {
    const issue = issues.find(i => i.routeId === route.id && i.status !== 'resolved');
    return {
      name: route.name,
      recordedLength: route.length,
      calculatedLength: route.calculatedLength || route.length,
      hasIssue: !!issue,
      isSupplementary: route.isSupplementary,
      issueDescription: issue?.description,
    };
  });

  const getBarColor = (entry: { isSupplementary: boolean; hasIssue: boolean }) => {
    if (entry.hasIssue) return '#F53F3F';
    if (entry.isSupplementary) return '#FF7D00';
    return '#165DFF';
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-industrial-100">
          <p className="font-semibold text-industrial-600 mb-2">{data.name}</p>
          <p className="text-sm text-industrial-400">记录长度: <span className="font-mono font-semibold text-primary-600">{data.recordedLength}m</span></p>
          {data.calculatedLength !== data.recordedLength && (
            <p className="text-sm text-industrial-400">实测长度: <span className="font-mono font-semibold text-warning-500">{data.calculatedLength}m</span></p>
          )}
          {data.isSupplementary && (
            <p className="text-xs mt-1 px-2 py-0.5 bg-warning-50 text-warning-600 rounded inline-block">补录路线</p>
          )}
          {data.hasIssue && (
            <p className="text-xs mt-2 text-error-500 bg-red-50 p-2 rounded">
              ⚠️ {data.issueDescription}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 px-4">
        <h3 className="text-lg font-semibold text-industrial-600">路线长度对比分析</h3>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-primary-500"></div>
            <span className="text-sm text-industrial-400">正常路线</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-warning-500"></div>
            <span className="text-sm text-industrial-400">补录路线</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-error-500"></div>
            <span className="text-sm text-industrial-400">问题路线</span>
          </div>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E6EB" />
          <XAxis 
            dataKey="name" 
            tick={{ fill: '#4E5969', fontSize: 12 }}
            axisLine={{ stroke: '#C9CDD4' }}
            angle={-30}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            label={{ value: '长度 (m)', angle: -90, position: 'insideLeft', fill: '#4E5969' }}
            tick={{ fill: '#4E5969', fontSize: 12 }}
            axisLine={{ stroke: '#C9CDD4' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            formatter={(value) => <span className="text-industrial-400">{value}</span>}
          />
          <ReferenceLine y={0} stroke="#C9CDD4" />
          
          <Bar dataKey="recordedLength" name="记录长度" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
            ))}
          </Bar>
          
          {chartData.some(d => d.calculatedLength !== d.recordedLength) && (
            <Bar dataKey="calculatedLength" name="实测长度" fill="#86909C" radius={[4, 4, 0, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 px-4">
        <h4 className="text-sm font-semibold text-industrial-500 mb-2">检测摘要</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-industrial-50 p-3 rounded-lg">
            <p className="text-2xl font-bold text-primary-600">{routes.length}</p>
            <p className="text-xs text-industrial-400">总路线数</p>
          </div>
          <div className="bg-warning-50 p-3 rounded-lg">
            <p className="text-2xl font-bold text-warning-600">
              {routes.filter(r => r.isSupplementary).length}
            </p>
            <p className="text-xs text-industrial-400">补录路线</p>
          </div>
          <div className="bg-red-50 p-3 rounded-lg">
            <p className="text-2xl font-bold text-error-500">
              {issues.filter(i => i.status !== 'resolved').length}
            </p>
            <p className="text-xs text-industrial-400">待处理问题</p>
          </div>
        </div>
      </div>
    </div>
  );
}
