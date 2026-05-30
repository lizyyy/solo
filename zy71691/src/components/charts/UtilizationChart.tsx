import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useYardStore } from '@/store/useYardStore';
import { Info } from 'lucide-react';

export function UtilizationChart() {
  const { getStatistics, containerSlots } = useYardStore();
  const [showExplanation, setShowExplanation] = useState(false);
  const stats = getStatistics();

  const bayData = Array.from({ length: 6 }, (_, bay) => {
    const baySlots = containerSlots.filter((s) => s.bay === bay);
    const occupied = baySlots.filter((s) => s.status === 'occupied').length;
    return {
      name: `区 ${bay + 1}`,
      已占用: occupied,
      空闲: baySlots.length - occupied,
      利用率: baySlots.length > 0 ? Math.round((occupied / baySlots.length) * 100) : 0,
    };
  });

  const typeData = stats.containerTypeBreakdown.map((item) => ({
    name: item.type === 'dry' ? '干货箱' : item.type === 'reefer' ? '冷藏箱' : '危险品箱',
    value: item.count,
  }));

  const COLORS = ['#0F4C81', '#3498DB', '#E74C3C'];

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">堆场利用率 (按区域)</h3>
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        {showExplanation && (
          <div className="mb-4 p-3 bg-blue-900/30 rounded-lg text-xs text-slate-300">
            <p className="font-medium text-blue-400 mb-1">数据来源说明:</p>
            <p>• 利用率 = 已占用箱位数 / 总箱位数 × 100%</p>
            <p>• 数据来源: 箱位模型_20240115.xlsx (共 {stats.totalSlots} 个箱位)</p>
            <p>• 最后更新: 实时计算</p>
          </div>
        )}

        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={bayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
            <YAxis stroke="#9CA3AF" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value: number, name: string) => [
                `${value} 个`,
                name === '利用率' ? '利用率 %' : name,
              ]}
            />
            <Bar dataKey="已占用" fill="#0F4C81" radius={[4, 4, 0, 0]} />
            <Bar dataKey="空闲" fill="#374151" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4">
        <h3 className="text-white font-medium mb-4">箱型分布</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={typeData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {typeData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            <Legend
              formatter={(value) => <span className="text-slate-300 text-sm">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
