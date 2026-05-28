import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import type { ReviewScores, MarketSnapshot } from '@/types';
import { formatNumber, getRatingLabel, getRatingColor } from '@/utils/format';

interface ScoreCardProps {
  scores: ReviewScores;
  timeline: MarketSnapshot[];
  finalPnL: number;
}

const ScoreGauge: React.FC<{ score: number; label: string; color: string }> = ({ score, label, color }) => {
  const circumference = Math.PI * 120;
  const strokeDashoffset = circumference * (1 - score / 100);

  return (
    <div className="relative">
      <svg width="160" height="100" className="transform -rotate-90">
        <circle
          cx="80"
          cy="80"
          r="50"
          fill="none"
          stroke="rgba(26, 61, 42, 0.5)"
          strokeWidth="12"
          strokeDasharray={`${Math.PI * 120}`}
          strokeDashoffset="0"
          strokeLinecap="round"
        />
        <circle
          cx="80"
          cy="80"
          r="50"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${Math.PI * 120}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
        <div className={`text-3xl font-mono font-bold ${color}`}>{score}</div>
        <div className="text-xs text-bloomberg-muted">{label}</div>
      </div>
    </div>
  );
};

export const ScoreCard: React.FC<ScoreCardProps> = ({ scores, timeline, finalPnL }) => {
  const overallRating = getRatingLabel(scores.overall);
  const ratingColor = getRatingColor(scores.overall);

  const pnlData = timeline.map(s => ({
    round: `R${s.round}`,
    盈亏: s.totalPnL,
    价格: s.underlyingPrice,
  }));

  const greekData = timeline.map(s => ({
    round: `R${s.round}`,
    Delta: s.greeks.delta,
    Gamma: s.greeks.gamma * 100,
    Vega: s.greeks.vega / 10,
  }));

  const scoreData = [
    { name: '风险管理', score: scores.riskManagement, color: '#2ECC71' },
    { name: '成本控制', score: scores.costControl, color: '#4EA8DE' },
    { name: '决策时效', score: scores.decisionTiming, color: '#FFE066' },
    { name: '希腊稳定性', score: scores.greekStability, color: '#FF9F1C' },
    { name: '综合评分', score: scores.overall, color: ratingColor === 'text-yellow-400' ? '#FBBF24' : '#2ECC71' },
  ];

  const scoreColors: Record<string, string> = {
    riskManagement: '#2ECC71',
    costControl: '#4EA8DE',
    decisionTiming: '#FFE066',
    greekStability: '#FF9F1C',
  };

  return (
    <div className="space-y-6">
      <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold mb-1">综合评级</h3>
            <p className="text-sm text-bloomberg-muted">基于多维度评估的综合表现</p>
          </div>
          <div className={`text-7xl font-bold ${ratingColor} text-shadow-glow`}>
            {overallRating}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          <ScoreGauge score={scores.riskManagement} label="风险管理" color={scoreColors.riskManagement} />
          <ScoreGauge score={scores.costControl} label="成本控制" color={scoreColors.costControl} />
          <ScoreGauge score={scores.decisionTiming} label="决策时效" color={scoreColors.decisionTiming} />
          <ScoreGauge score={scores.greekStability} label="希腊稳定性" color={scoreColors.greekStability} />
          <ScoreGauge score={scores.overall} label="综合评分" color={ratingColor === 'text-yellow-400' ? '#FBBF24' : '#2ECC71'} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6">
          <h4 className="font-bold mb-4">盈亏趋势</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pnlData}>
                <defs>
                  <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={finalPnL >= 0 ? '#2ECC71' : '#E63946'} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={finalPnL >= 0 ? '#2ECC71' : '#E63946'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A3D2A" />
                <XAxis dataKey="round" stroke="#8BA99A" fontSize={12} />
                <YAxis stroke="#8BA99A" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F2819',
                    border: '1px solid #1A3D2A',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="盈亏"
                  stroke={finalPnL >= 0 ? '#2ECC71' : '#E63946'}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPnL)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6">
          <h4 className="font-bold mb-4">希腊值走势</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={greekData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A3D2A" />
                <XAxis dataKey="round" stroke="#8BA99A" fontSize={12} />
                <YAxis stroke="#8BA99A" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F2819',
                    border: '1px solid #1A3D2A',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line type="monotone" dataKey="Delta" stroke="#2ECC71" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Gamma" stroke="#FF9F1C" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Vega" stroke="#4EA8DE" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-trader-green rounded" />
              Delta
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-warning-orange rounded" />
              Gamma (×100)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-highlight-blue rounded" />
              Vega (÷10)
            </span>
          </div>
        </div>
      </div>

      <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6">
        <h4 className="font-bold mb-4">各项评分详情</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scoreData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1A3D2A" />
              <XAxis type="number" domain={[0, 100]} stroke="#8BA99A" fontSize={12} />
              <YAxis dataKey="name" type="category" stroke="#8BA99A" fontSize={12} width={80} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F2819',
                  border: '1px solid #1A3D2A',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="score" fill="#8884d8" radius={[0, 4, 4, 0]}>
                {scoreData.map((entry, index) => (
                  <rect key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6">
        <h4 className="font-bold mb-4">评分维度说明</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-trader-green/10 rounded-lg border-l-4 border-trader-green">
            <div className="font-bold text-trader-green mb-1">风险管理 (35%)</div>
            <p className="text-bloomberg-muted">基于希腊值在目标区间内的时间占比，以及是否触发保证金追缴</p>
          </div>
          <div className="p-3 bg-highlight-blue/10 rounded-lg border-l-4 border-highlight-blue">
            <div className="font-bold text-highlight-blue mb-1">成本控制 (20%)</div>
            <p className="text-bloomberg-muted">基于调仓费用占总盈亏的比例，频繁交易会扣分</p>
          </div>
          <div className="p-3 bg-highlight-yellow/10 rounded-lg border-l-4 border-highlight-yellow">
            <div className="font-bold text-highlight-yellow mb-1">决策时效 (20%)</div>
            <p className="text-bloomberg-muted">基于风险暴露后的响应速度，及时调仓会加分</p>
          </div>
          <div className="p-3 bg-warning-orange/10 rounded-lg border-l-4 border-warning-orange">
            <div className="font-bold text-warning-orange mb-1">希腊稳定性 (25%)</div>
            <p className="text-bloomberg-muted">基于整个周期内希腊值的波动幅度，越稳定得分越高</p>
          </div>
        </div>
      </div>
    </div>
  );
};
