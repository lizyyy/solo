import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';

interface ChartItem {
  id: string;
  coordType: string;
  needsReview: boolean;
  distance: number | null;
  recordId: string;
}

interface Props {
  data: ChartItem[];
  onClickBar: (recordId: string) => void;
}

const COORD_COLORS: Record<string, string> = {
  latlng: '#3b82f6',
  metric: '#16a34a',
  mixed: '#f59e0b',
};

export default function ViewChart({ data, onClickBar }: Props) {
  const chartData = data.map((d) => ({
    name: d.id.slice(0, 8),
    distance: d.distance ?? 0,
    coordType: d.coordType,
    needsReview: d.needsReview,
    recordId: d.recordId,
  }));

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <h3 style={{ marginBottom: 12, fontSize: 16, color: '#1a1a2e' }}>图表回放</h3>
      <div style={{ height: 350 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} onClick={(e) => {
            if (e?.activePayload?.[0]?.payload?.recordId) {
              onClickBar(e.activePayload[0].payload.recordId);
            }
          }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
                    <div>编号: {d.name}</div>
                    <div>坐标类型: {d.coordType === 'mixed' ? '混用' : d.coordType === 'latlng' ? '经纬度' : '米制'}</div>
                    <div>距离: {d.distance}</div>
                    {d.needsReview && <div style={{ color: '#d97706' }}>待复核</div>}
                  </div>
                );
              }}
            />
            <Legend />
            <Bar dataKey="distance" name="测距 (m)">
              {chartData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.needsReview ? '#fbbf24' : (COORD_COLORS[entry.coordType] || '#888')}
                  cursor="pointer"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
        点击柱子可溯源到测距仪记录；黄色 = 坐标混用待复核
      </div>
    </div>
  );
}
