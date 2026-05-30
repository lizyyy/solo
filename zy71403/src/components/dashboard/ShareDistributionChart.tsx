import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { useValuationStore } from '../../store/useValuationStore';
import { formatShares } from '../../utils/formatters';
import { useShallow } from 'zustand/react/shallow';

const COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899'];

export function ShareDistributionChart() {
  const { getDistributionData, filters } = useValuationStore(useShallow((state) => ({
    getDistributionData: state.getDistributionData,
    filters: state.filters,
  })));
  const distributionData = getDistributionData();
  
  const chartData = distributionData.map(item => ({
    name: item.fundName.replace('私募基金', '').replace('私募证券投资基金', ''),
    value: item.totalShares,
    normalShares: item.normalShares,
    sidePocketShares: item.sidePocketShares,
  }));
  
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; normalShares: number; sidePocketShares: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
          <p className="text-sm font-medium text-slate-700 mb-2">{data.name}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <span className="text-slate-600">正常份额:</span>
              <span className="font-mono font-medium text-slate-800">
                {formatShares(data.normalShares)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-slate-600">侧袋份额:</span>
              <span className="font-mono font-medium text-slate-800">
                {formatShares(data.sidePocketShares)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs pt-1 border-t border-slate-100">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-600">合计:</span>
              <span className="font-mono font-semibold text-slate-800">
                {formatShares(data.value)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };
  
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  }) => {
    if (percent < 0.05) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };
  
  const hasFilters = filters.fundIds.length > 0;
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 opacity-0 animate-fade-in-up animate-delay-200 [animation-fill-mode:forwards]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-serif text-lg font-semibold text-slate-800">份额分布</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            各基金份额占比 {hasFilters && '(已筛选)'}
          </p>
        </div>
      </div>
      
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={100}
              innerRadius={50}
              fill="#8884d8"
              dataKey="value"
              paddingAngle={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
