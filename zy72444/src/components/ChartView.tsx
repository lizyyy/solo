import { useState } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { AttendanceRecord, Batch } from '@/types';
import { getTicketTypeLabel } from '@/utils';

interface ChartViewProps {
  batch: Batch;
  records: AttendanceRecord[];
  onSelectRecord: (record: AttendanceRecord) => void;
}

export default function ChartView({ batch, records, onSelectRecord }: ChartViewProps) {
  const [activeTab, setActiveTab] = useState<'type' | 'daily'>('type');

  const typeData = [
    { name: '赠票', value: batch.freeTicketCount, color: '#0ea5e9' },
    { name: '售票', value: batch.paidTicketCount, color: '#10b981' },
  ];

  const byRemark = records.reduce((acc, r) => {
    const key = r.remark || '无备注';
    if (!acc[key]) acc[key] = { name: key, free: 0, paid: 0 };
    acc[key][r.type]++;
    return acc;
  }, {} as Record<string, { name: string; free: number; paid: number }>);

  const remarkData = Object.values(byRemark).slice(0, 8);

  return (
    <div className="glass rounded-2xl border border-white/50 overflow-hidden">
      <div className="p-4 border-b border-primary-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-primary-900">图表数据视图</h3>
            <p className="text-sm text-primary-500 mt-0.5">
              点击数据点可查看对应的签到记录
            </p>
          </div>
          <div className="flex gap-1 bg-primary-100/50 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('type')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === 'type'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-primary-500 hover:text-primary-700'
              }`}
            >
              类型占比
            </button>
            <button
              onClick={() => setActiveTab('daily')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === 'daily'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-primary-500 hover:text-primary-700'
              }`}
            >
              备注分布
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 h-[400px]">
        {activeTab === 'type' ? (
          <div className="h-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={140}
                  paddingAngle={4}
                  dataKey="value"
                  onClick={(data) => {
                    const typeRecords = records.filter(
                      (r) => getTicketTypeLabel(r.type) === data.name
                    );
                    if (typeRecords.length > 0) {
                      onSelectRecord(typeRecords[0]);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  formatter={(value: number) => [`${value} 人`, '数量']}
                />
                <Legend
                  formatter={(value) => (
                    <span className="text-primary-700 font-medium">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={remarkData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#64748b', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Legend />
              <Bar
                dataKey="free"
                name="赠票"
                fill="#0ea5e9"
                radius={[4, 4, 0, 0]}
                style={{ cursor: 'pointer' }}
              />
              <Bar
                dataKey="paid"
                name="售票"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                style={{ cursor: 'pointer' }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
