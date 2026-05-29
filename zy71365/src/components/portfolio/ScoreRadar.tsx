import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import type { PortfolioScore } from '../../types';
import { getScoreColor } from '../../lib/utils';

interface ScoreRadarProps {
  score: PortfolioScore;
}

export default function ScoreRadar({ score }: ScoreRadarProps) {
  const data = [
    { dimension: '主题多样性', value: score.dimensions.themeDiversity, fullMark: 100 },
    { dimension: '媒介丰富度', value: score.dimensions.mediumRichness, fullMark: 100 },
    { dimension: '完成度均衡', value: score.dimensions.completionBalance, fullMark: 100 },
    { dimension: '版权合规', value: score.dimensions.copyrightCompliance, fullMark: 100 },
    { dimension: '方向匹配', value: score.dimensions.directionMatch, fullMark: 100 },
    { dimension: '质量水平', value: score.dimensions.qualityLevel, fullMark: 100 },
  ];

  const radarColor = score.overall >= 70 ? '#5A7247' : score.overall >= 55 ? '#d17a22' : '#B84A3E';

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-display text-lg font-semibold text-cream-200">多维度评分</h3>
          <p className="text-xs text-cream-400/60 mt-1">六大维度综合评估</p>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-display font-bold ${getScoreColor(score.overall)}`}>
            {score.overall}
          </div>
          <div className="text-xs text-cream-400/60">综合评分</div>
        </div>
      </div>

      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#3d3d3d" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: '#b8b8b8', fontSize: 11, fontFamily: 'Inter' }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: '#5c5c5c', fontSize: 10 }}
              axisLine={false}
              tickCount={5}
            />
            <Radar
              name="评分"
              dataKey="value"
              stroke={radarColor}
              fill={radarColor}
              fillOpacity={0.25}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5">
        {Object.entries(score.dimensions).map(([key, value]) => (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-cream-400/80">
                {key === 'themeDiversity' && '主题多样性'}
                {key === 'mediumRichness' && '媒介丰富度'}
                {key === 'completionBalance' && '完成度均衡'}
                {key === 'copyrightCompliance' && '版权合规'}
                {key === 'directionMatch' && '方向匹配'}
                {key === 'qualityLevel' && '质量水平'}
              </span>
              <span className={`text-xs font-semibold ${getScoreColor(value)}`}>{value}</span>
            </div>
            <div className="h-1.5 bg-charcoal-700/60 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getScoreColor(value).replace('text-', 'bg-')}`}
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
