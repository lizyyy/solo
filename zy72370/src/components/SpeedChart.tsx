import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Legend,
} from 'recharts';
import { useAppStore } from '../store/useAppStore';

const COLORS = {
  smooth: '#27ae60',
  overwritten: '#e67e22',
  supplemented: '#8e44ad',
};

export default function SpeedChart() {
  const records = useAppStore((s) => s.records);
  const thresholdMax = records[0]?.thresholdMax || 6.0;

  const chartData = records.map((r) => ({
    name: r.typeLabel,
    measuredSpeed: r.measuredSpeed,
    averageSpeed: r.averageSpeed,
    threshold: thresholdMax,
    type: r.type,
    isOver: r.isOverThreshold,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#0f2744] border border-[#2d5a87] rounded-sm p-3 shadow-xl">
          <p className="text-sm font-bold text-white mb-2">{data.name}</p>
          <p className="text-xs text-gray-300">
            测量速度: <span className="text-white font-mono">{data.measuredSpeed} m/s</span>
          </p>
          <p className="text-xs text-gray-300">
            平均值: <span className="text-[#5dade2] font-mono">{data.averageSpeed} m/s</span>
          </p>
          <p className="text-xs text-gray-300">
            阈值上限: <span className="text-[#f39c12] font-mono">{data.threshold} m/s</span>
          </p>
          {data.isOver && (
            <p className="text-xs text-[#c0392b] mt-1 font-bold">⚠️ 超出阈值</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#0f2744] border border-[#2d5a87] rounded-sm p-6">
      <h3 className="text-lg font-bold text-white mb-6 flex items-center">
        <span className="w-1 h-5 bg-[#5dade2] mr-3"></span>
        速度数据对比图
      </h3>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2d5a87" opacity={0.3} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              axisLine={{ stroke: '#2d5a87' }}
            />
            <YAxis
              label={{
                value: '速度 (m/s)',
                angle: -90,
                position: 'insideLeft',
                fill: '#94a3b8',
                fontSize: 12,
              }}
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              axisLine={{ stroke: '#2d5a87' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{
                paddingTop: '20px',
              }}
              iconType="rect"
            />
            <ReferenceLine
              y={thresholdMax}
              stroke="#f39c12"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{
                value: `安全阈值 ${thresholdMax} m/s`,
                fill: '#f39c12',
                fontSize: 12,
                position: 'right',
              }}
            />
            <Bar
              dataKey="measuredSpeed"
              name="测量速度"
              radius={[4, 4, 0, 0]}
              barSize={40}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-measured-${index}`}
                  fill={COLORS[entry.type as keyof typeof COLORS]}
                  opacity={entry.isOver ? 1 : 0.8}
                />
              ))}
            </Bar>
            <Bar
              dataKey="averageSpeed"
              name="平均值"
              radius={[4, 4, 0, 0]}
              barSize={40}
              fill="#5dade2"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-sm bg-[#27ae60]" />
          <span className="text-gray-400">顺利记录 - 正常范围内</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-sm bg-[#e67e22]" />
          <span className="text-gray-400">超阈值被盖 - 超出安全线</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-sm bg-[#8e44ad]" />
          <span className="text-gray-400">旧口径补录 - 铭牌数据</span>
        </div>
      </div>
    </div>
  );
}
