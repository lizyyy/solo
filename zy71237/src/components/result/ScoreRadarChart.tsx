import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { FinalScore } from '../../types';

interface ScoreRadarChartProps {
  score: FinalScore;
}

const gradeColors: Record<string, string> = {
  'S': '#D4AF37',
  'A': '#4A7C59',
  'B': '#CD7F32',
  'C': '#B5651D',
  'D': '#8B4513',
  'F': '#8B0000',
};

const gradeDescriptions: Record<string, string> = {
  'S': '完美修复，堪称博物馆级典范',
  'A': '优秀修复，作品状态大幅改善',
  'B': '良好修复，基本达到预期效果',
  'C': '一般修复，存在一些瑕疵',
  'D': '较差修复，作品状态有所恶化',
  'F': '修复失败，作品严重受损',
};

export function ScoreRadarChart({ score }: ScoreRadarChartProps) {
  const [animatedScore, setAnimatedScore] = useState({
    appearance: 0,
    structure: 0,
    materialCompatibility: 0,
    timeEfficiency: 0,
    riskControl: 0,
    total: 0,
  });

  useEffect(() => {
    const duration = 1500;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      setAnimatedScore({
        appearance: score.appearance * easeProgress,
        structure: score.structure * easeProgress,
        materialCompatibility: score.materialCompatibility * easeProgress,
        timeEfficiency: score.timeEfficiency * easeProgress,
        riskControl: score.riskControl * easeProgress,
        total: score.total * easeProgress,
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [score]);

  const chartData = [
    { subject: '外观修复', value: animatedScore.appearance, fullMark: 30 },
    { subject: '结构保存', value: animatedScore.structure, fullMark: 30 },
    { subject: '材料兼容', value: animatedScore.materialCompatibility, fullMark: 20 },
    { subject: '时间效率', value: animatedScore.timeEfficiency * 0.1, fullMark: 10 },
    { subject: '风险控制', value: animatedScore.riskControl * 0.1, fullMark: 10 },
  ];

  const color = gradeColors[score.grade];

  return (
    <div className="card-paper">
      <h3 className="text-xl font-serif font-bold text-museum-ink mb-4 flex items-center gap-2">
        <span className="w-1 h-6 rounded-full" style={{ backgroundColor: color }} />
        修复评估
      </h3>

      <div className="flex flex-col lg:flex-row gap-6 items-center">
        <div className="w-full lg:w-1/2 aspect-square max-w-sm">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="80%">
              <PolarGrid stroke="#CD7F32" strokeOpacity={0.3} />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: '#2C1810', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 30]}
                tick={{ fill: '#2C1810', fontSize: 10 }}
                tickCount={4}
                axisLine={false}
              />
              <Radar
                name="得分"
                dataKey="value"
                stroke={color}
                fill={color}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="w-full lg:w-1/2 text-center lg:text-left">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="mb-6"
          >
            <div
              className="inline-flex items-center justify-center w-32 h-32 rounded-full border-4 mb-4"
              style={{ borderColor: color, backgroundColor: `${color}15` }}
            >
              <div>
                <div className="text-5xl font-serif font-bold" style={{ color }}>
                  {score.grade}
                </div>
                <div className="text-xs text-museum-ink/60">综合评级</div>
              </div>
            </div>
          </motion.div>

          <div className="text-3xl font-bold text-museum-ink mb-2">
            {animatedScore.total.toFixed(1)}
            <span className="text-lg font-normal text-museum-ink/50"> / 100</span>
          </div>

          <p className="text-museum-ink/70 mb-6">{gradeDescriptions[score.grade]}</p>

          <div className="grid grid-cols-1 gap-3 text-sm">
            <ScoreItem label="外观修复" value={animatedScore.appearance} max={30} color={color} />
            <ScoreItem label="结构保存" value={animatedScore.structure} max={30} color={color} />
            <ScoreItem label="材料兼容" value={animatedScore.materialCompatibility} max={20} color={color} />
            <ScoreItem label="时间效率" value={animatedScore.timeEfficiency * 0.1} max={10} color={color} />
            <ScoreItem label="风险控制" value={animatedScore.riskControl * 0.1} max={10} color={color} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreItem({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const percentage = (value / max) * 100;

  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-museum-ink/70">{label}</span>
      <div className="flex-1 h-2 bg-museum-ink/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="w-16 text-right font-medium text-museum-ink">
        {value.toFixed(1)}/{max}
      </span>
    </div>
  );
}
