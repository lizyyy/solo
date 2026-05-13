import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { LeadFunnel as LeadFunnelType } from '../types';

interface LeadFunnelProps {
  funnel: LeadFunnelType | null;
  loading: boolean;
}

const LeadFunnel: React.FC<LeadFunnelProps> = ({ funnel, loading }) => {
  if (loading || !funnel) {
    return (
      <div className="section">
        <div className="loading">
          <div className="spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  const colors = ['#007bff', '#17a2b8', '#28a745', '#ffc107', '#6c757d'];

  const stageNames: Record<string, string> = {
    lead: '线索',
    qualified: '已确认',
    proposal: '方案中',
    negotiation: '协商中',
    closed: '已结案'
  };

  const data = funnel.funnel.map((f, index) => ({
    stage: stageNames[f.stage] || f.stage,
    count: f.count,
    percentage: f.percentage,
    color: colors[index % colors.length]
  }));

  return (
    <div className="section">
      <h2 className="section-title">线索漏斗</h2>
      <div className="funnel-chart">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="stage" width={60} />
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value} 件`,
                '数量'
              ]}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginTop: '20px' }}>
        {data.map((item, index) => (
          <div key={index} style={{ textAlign: 'center', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: item.color }}>{item.count}</div>
            <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>{item.stage}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LeadFunnel;
