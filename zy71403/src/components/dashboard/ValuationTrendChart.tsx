import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { useValuationStore } from '../../store/useValuationStore';
import { formatLargeNumber, formatDate } from '../../utils/formatters';
import { useShallow } from 'zustand/react/shallow';

interface ChartDataPoint {
  date: string;
  normalValue: number;
  sidePocketValue: number;
  totalValue: number;
}

export function ValuationTrendChart() {
  const { getTrendData, filters } = useValuationStore(useShallow((state) => ({
    getTrendData: state.getTrendData,
    filters: state.filters,
  })));
  const trendData = getTrendData();
  
  const data: ChartDataPoint[] = trendData.map(item => ({
    ...item,
    date: formatDate(item.date).slice(5),
  }));
  
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
          <p className="text-sm font-medium text-slate-700 mb-2">{label}</p>
          {payload.map((entry, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs mb-1">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-600">{entry.name}:</span>
              <span className="font-mono font-medium text-slate-800">
                ¥{formatLargeNumber(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };
  
  const hasFilters = filters.fundIds.length > 0;
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 opacity-0 animate-fade-in-up animate-delay-150 [animation-fill-mode:forwards]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-serif text-lg font-semibold text-slate-800">估值趋势</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            近{data.length}天估值变化 {hasFilters && '(已筛选)'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-sky-500" />
            <span className="text-slate-600">正常份额</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-slate-600">侧袋份额</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-slate-600">合计</span>
          </div>
        </div>
      </div>
      
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorSide" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 11, fill: '#64748B' }}
              axisLine={{ stroke: '#CBD5E1' }}
              tickLine={{ stroke: '#CBD5E1' }}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: '#64748B' }}
              axisLine={{ stroke: '#CBD5E1' }}
              tickLine={{ stroke: '#CBD5E1' }}
              tickFormatter={(value) => formatLargeNumber(value)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="normalValue"
              name="正常份额估值"
              stroke="#3B82F6"
              strokeWidth={2}
              fill="url(#colorNormal)"
              dot={false}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="sidePocketValue"
              name="侧袋份额估值"
              stroke="#F59E0B"
              strokeWidth={2}
              fill="url(#colorSide)"
              dot={false}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="totalValue"
              name="合计估值"
              stroke="#10B981"
              strokeWidth={2.5}
              fill="none"
              dot={false}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
