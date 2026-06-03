import React from 'react';
import { 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  Legend,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import type { SafetyRadius } from '../../shared/types';
import { getWindRoseData } from '../utils/windUtils';

interface WindRoseChartProps {
  radiusTable: SafetyRadius[];
  height?: number;
}

export const WindRoseChart: React.FC<WindRoseChartProps> = ({ radiusTable, height = 400 }) => {
  const data = getWindRoseData(radiusTable, 'both');

  const chartData = data.map(d => ({
    direction: d.directionLabel,
    '2024新口径': d.newRadius,
    '2023旧口径': d.legacyRadius,
    fullMark: 350,
  }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
          <PolarGrid stroke="#d9e2ec" />
          <PolarAngleAxis 
            dataKey="direction" 
            tick={{ fill: '#486581', fontSize: 12, fontFamily: 'JetBrains Mono' }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 350]} 
            tick={{ fill: '#627d98', fontSize: 10 }}
            tickFormatter={(value) => `${value}m`}
          />
          <Radar
            name="2024新口径"
            dataKey="2024新口径"
            stroke="#1e3a5f"
            fill="#1e3a5f"
            fillOpacity={0.4}
            strokeWidth={2}
          />
          <Radar
            name="2023旧口径"
            dataKey="2023旧口径"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.3}
            strokeWidth={2}
            strokeDasharray="5 5"
          />
          <Legend 
            wrapperStyle={{ fontSize: '12px', fontFamily: 'Noto Sans SC' }}
          />
          <Tooltip 
            formatter={(value: number) => [`${value} 米`, '安全半径']}
            labelFormatter={(label) => `风向: ${label}`}
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #bcccdc',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
