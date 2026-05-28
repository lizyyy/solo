import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { ISSUE_TYPE_LABELS } from '@/constants/purposeCodes';

const trendData = [
  { date: '1/10', purpose_mismatch: 3, supplement_covers: 2, duplicate_remittance: 1 },
  { date: '1/11', purpose_mismatch: 5, supplement_covers: 3, duplicate_remittance: 2 },
  { date: '1/12', purpose_mismatch: 2, supplement_covers: 4, duplicate_remittance: 1 },
  { date: '1/13', purpose_mismatch: 6, supplement_covers: 2, duplicate_remittance: 3 },
  { date: '1/14', purpose_mismatch: 4, supplement_covers: 5, duplicate_remittance: 2 },
  { date: '1/15', purpose_mismatch: 3, supplement_covers: 3, duplicate_remittance: 4 },
  { date: '1/16', purpose_mismatch: 5, supplement_covers: 2, duplicate_remittance: 1 },
];

const supplementData = [
  { name: '合同补件', value: 12 },
  { name: '发票补件', value: 8 },
  { name: '用途修正', value: 5 },
  { name: '其他补件', value: 3 },
];

const duplicateData = [
  { name: '同合同重复', value: 6 },
  { name: '同发票重复', value: 3 },
  { name: '疑似重复提交', value: 4 },
  { name: '金额超限', value: 2 },
];

const COLORS = ['#0F3460', '#E94560', '#16C79A', '#F39C12', '#9B59B6'];

export const PurposeMismatchChart = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h4 className="text-sm font-semibold text-slate-700 mb-4">用途不匹配趋势（近7天）</h4>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => [
                value,
                ISSUE_TYPE_LABELS[name as keyof typeof ISSUE_TYPE_LABELS] || name,
              ]}
            />
            <Line
              type="monotone"
              dataKey="purpose_mismatch"
              stroke="#E94560"
              strokeWidth={2}
              dot={{ fill: '#E94560', strokeWidth: 2 }}
              name="用途代码不匹配"
            />
            <Line
              type="monotone"
              dataKey="supplement_covers"
              stroke="#F39C12"
              strokeWidth={2}
              dot={{ fill: '#F39C12', strokeWidth: 2 }}
              name="补件覆盖原件"
            />
            <Line
              type="monotone"
              dataKey="duplicate_remittance"
              stroke="#9B59B6"
              strokeWidth={2}
              dot={{ fill: '#9B59B6', strokeWidth: 2 }}
              name="重复汇款"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const SupplementCoverChart = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h4 className="text-sm font-semibold text-slate-700 mb-4">补件类型分布</h4>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={supplementData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12 }}
              stroke="#94a3b8"
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {supplementData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const DuplicateDistributionChart = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h4 className="text-sm font-semibold text-slate-700 mb-4">重复汇款类型分布</h4>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={duplicateData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {duplicateData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 mt-3 justify-center">
        {duplicateData.map((item, index) => (
          <div key={item.name} className="flex items-center gap-1.5 text-xs text-slate-600">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            {item.name}: {item.value}
          </div>
        ))}
      </div>
    </div>
  );
};
