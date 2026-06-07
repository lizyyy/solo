import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useRecordStore } from '../../store/useRecordStore';
import type { RecordStatus } from '../../types';

const COLORS: Record<RecordStatus | string, string> = {
  pending: '#f59e0b',
  normal: '#16a34a',
  abnormal: '#dc2626',
  false_positive: '#6b7280'
};

const STATUS_LABELS: Record<RecordStatus | string, string> = {
  pending: '待处理',
  normal: '正常',
  abnormal: '异常',
  false_positive: '误命中'
};

export const ExceptionChart = () => {
  const navigate = useNavigate();
  const statistics = useRecordStore(state => state.getStatistics());
  const setFilters = useRecordStore(state => state.setFilters);

  const pieData = [
    { name: '待处理', value: statistics.pending, status: 'pending' },
    { name: '正常', value: statistics.normal, status: 'normal' },
    { name: '异常', value: statistics.abnormal, status: 'abnormal' },
    { name: '误命中', value: statistics.falsePositive, status: 'false_positive' }
  ].filter(d => d.value > 0);

  const barData = [
    { name: '待处理', count: statistics.pending, status: 'pending' },
    { name: '正常', count: statistics.normal, status: 'normal' },
    { name: '异常', count: statistics.abnormal, status: 'abnormal' },
    { name: '误命中', count: statistics.falsePositive, status: 'false_positive' }
  ];

  const handlePieClick = (data: { status: string }) => {
    setFilters({ status: data.status as RecordStatus });
    navigate('/exceptions');
  };

  const handleBarClick = (data: { status: string }) => {
    setFilters({ status: data.status as RecordStatus });
    navigate('/exceptions');
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="bg-white p-5 rounded-sm border border-gray-200 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">异常分布占比</h3>
        <p className="text-xs text-gray-500 mb-3">点击区块可跳转至对应列表</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                onClick={(_, index) => handlePieClick(pieData[index])}
                style={{ cursor: 'pointer' }}
              >
                {pieData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[entry.status]}
                    className="hover:opacity-80 transition-opacity"
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [`${value} 条`, name]}
                contentStyle={{ borderRadius: '2px', border: '1px solid #e5e7eb' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-5 rounded-sm border border-gray-200 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">各状态数量统计</h3>
        <p className="text-xs text-gray-500 mb-3">点击柱形可跳转至对应列表</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => [`${value} 条`, '数量']}
                contentStyle={{ borderRadius: '2px', border: '1px solid #e5e7eb' }}
              />
              <Bar
                dataKey="count"
                radius={[2, 2, 0, 0]}
                onClick={(data) => handleBarClick(data as { status: RecordStatus })}
                style={{ cursor: 'pointer' }}
              >
                {barData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[entry.status]}
                    className="hover:opacity-80 transition-opacity"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
