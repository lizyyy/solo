import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useStore } from '@/store/useStore';
import { CONFLICT_DETAILS, type ConflictType } from '@/types';

const COLORS = ['#e67e22', '#e74c3c', '#f39c12', '#27ae60'];

export default function ConflictPieChart() {
  const { getConflictStats, setFilterConditions } = useStore();
  const stats = getConflictStats();

  const data = [
    {
      name: CONFLICT_DETAILS.exercise_date_mismatch.label,
      value: stats.exercise_date_mismatch,
      type: 'exercise_date_mismatch',
    },
    {
      name: CONFLICT_DETAILS.withdrawn_still_in_list.label,
      value: stats.withdrawn_still_in_list,
      type: 'withdrawn_still_in_list',
    },
    {
      name: CONFLICT_DETAILS.insufficient_position.label,
      value: stats.insufficient_position,
      type: 'insufficient_position',
    },
    {
      name: '正常',
      value: stats.normal,
      type: 'normal',
    },
  ].filter((d) => d.value > 0);

  const handleClick = (entry: { type: string }) => {
    if (entry.type === 'normal') {
      setFilterConditions({ conflictTypes: undefined });
    } else {
      setFilterConditions({ conflictTypes: [entry.type as ConflictType] });
    }
  };

  if (data.length === 0) {
    return (
      <div className="card p-6 h-full flex items-center justify-center text-neutral-500">
        暂无数据
      </div>
    );
  }

  return (
    <div className="card p-4 h-full">
      <h4 className="text-sm font-medium text-neutral-700 mb-3">异常分布</h4>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
            onClick={handleClick}
            style={{ cursor: 'pointer' }}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${value} 条`, '数量']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-xs text-neutral-600">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
