import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';
import type { MarketState } from '@/types/game';

interface RateChartProps {
  marketHistory: MarketState[];
}

export function RateChart({ marketHistory }: RateChartProps) {
  const data = marketHistory.map((state) => ({
    round: `R${state.roundNumber}`,
    dr007: Number(state.dr007.toFixed(2)),
    t10y: Number(state.t10y.toFixed(2)),
    lagEffect: Number((state.rateLagEffect * 100).toFixed(0)),
  }));

  return (
    <div className="bg-navy-800/50 backdrop-blur-sm rounded-xl border border-navy-600 p-4">
      <h3 className="text-sm font-semibold text-gold-400 mb-4">利率走势</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2E4B96" opacity={0.3} />
            <XAxis 
              dataKey="round" 
              stroke="#7791C3" 
              fontSize={10} 
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#7791C3" 
              fontSize={10} 
              tickLine={false}
              axisLine={false}
              domain={[1, 4]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0A2463',
                border: '1px solid #3D5FA9',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#D4AF37' }}
            />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            <Line
              type="monotone"
              dataKey="dr007"
              name="DR007 (%)"
              stroke="#2ECC71"
              strokeWidth={2}
              dot={{ fill: '#2ECC71', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="t10y"
              name="10年期国债 (%)"
              stroke="#D4AF37"
              strokeWidth={2}
              dot={{ fill: '#D4AF37', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs text-navy-400 flex items-center gap-4">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-liquidity-good"></span>
          DR007: 银行间质押式回购利率
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gold-400"></span>
          10Y国债: 无风险收益率基准
        </span>
      </div>
    </div>
  );
}

export function LiquidityChart({ marketHistory }: RateChartProps) {
  const data = marketHistory.map((state) => ({
    round: `R${state.roundNumber}`,
    liquidity: state.liquidity,
    excessRatio: Number((state.excessReserveRatio * 100).toFixed(2)),
  }));

  return (
    <div className="bg-navy-800/50 backdrop-blur-sm rounded-xl border border-navy-600 p-4">
      <h3 className="text-sm font-semibold text-gold-400 mb-4">流动性变化</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="liquidityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2ECC71" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#2ECC71" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2E4B96" opacity={0.3} />
            <XAxis 
              dataKey="round" 
              stroke="#7791C3" 
              fontSize={10} 
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#7791C3" 
              fontSize={10} 
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0A2463',
                border: '1px solid #3D5FA9',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#D4AF37' }}
              formatter={(value: number) => [`${value.toLocaleString()} 亿`, '流动性']}
            />
            <Area
              type="monotone"
              dataKey="liquidity"
              stroke="#2ECC71"
              strokeWidth={2}
              fill="url(#liquidityGradient)"
              dot={{ fill: '#2ECC71', r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
