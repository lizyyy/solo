import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { ScoreCard } from '../components/review/ScoreCard';
import { ErrorTraceability } from '../components/review/ErrorTraceability';
import { ImageComparison } from '../components/review/ImageComparison';
import { Plane, Radio, Waves, Eye, ArrowLeft, FileText } from 'lucide-react';
import { useEffect } from 'react';

export function ReviewPage() {
  const navigate = useNavigate();
  const { result, resetGame, getCurrentScene } = useGameStore();
  const scene = getCurrentScene();

  useEffect(() => {
    if (!result) {
      navigate('/');
    }
  }, [result, navigate]);

  if (!result) return null;

  const totalGrade = result.scores.totalScore >= 90 ? 'A' : 
                     result.scores.totalScore >= 80 ? 'B' :
                     result.scores.totalScore >= 70 ? 'C' :
                     result.scores.totalScore >= 60 ? 'D' : 'F';

  const gradeColors: Record<string, string> = {
    A: 'text-green-400 border-green-400',
    B: 'text-blue-400 border-blue-400',
    C: 'text-yellow-400 border-yellow-400',
    D: 'text-orange-400 border-orange-400',
    F: 'text-red-400 border-red-400'
  };

  const scoreItems = [
    {
      title: '航迹准确度',
      icon: <Plane className="w-5 h-5 text-blue-400" />,
      score: result.scores.trackAccuracy,
      colorClass: 'bg-blue-500/20'
    },
    {
      title: '采样充足度',
      icon: <Radio className="w-5 h-5 text-yellow-400" />,
      score: result.scores.samplingAdequacy,
      colorClass: 'bg-yellow-500/20'
    },
    {
      title: '噪声控制',
      icon: <Waves className="w-5 h-5 text-red-400" />,
      score: result.scores.noiseControl,
      colorClass: 'bg-red-500/20'
    },
    {
      title: '成像清晰度',
      icon: <Eye className="w-5 h-5 text-green-400" />,
      score: result.scores.imageClarity,
      colorClass: 'bg-green-500/20'
    }
  ];

  const handleRetry = () => {
    resetGame();
    navigate('/');
  };

  const handleExport = () => {
    navigate('/report');
  };

  return (
    <div className="min-h-screen p-6">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-space-700/50 border border-space-600 text-space-200 hover:border-space-500 hover:text-space-100 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              返回重试
            </button>
            <div>
              <h1 className="font-orbitron text-2xl font-bold text-tech-400 text-glow">
                成像复盘分析
              </h1>
              <p className="text-space-300 text-sm mt-1">
                场景: {scene?.name} | {new Date(result.timestamp).toLocaleString('zh-CN')}
              </p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-tech-500/20 border border-tech-400 text-tech-400 hover:bg-tech-500/30 hover:shadow-lg hover:shadow-tech-500/20 transition-all"
          >
            <FileText className="w-4 h-4" />
            导出报告
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 space-y-4">
          <div className="card-bg rounded-lg p-6 border border-tech-500/30">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-orbitron text-lg text-space-100 mb-2">综合评分</h2>
                <div className="text-sm text-space-400 mb-4">
                  总分计算公式: 航迹×30% + 采样×30% + 噪声×20% + 清晰度×20%
                </div>
                <div className="bg-space-700/50 rounded-lg p-3 text-xs font-mono">
                  <div className="text-space-300 mb-1">计算过程:</div>
                  <div>
                    {result.scores.trackAccuracy.value.toFixed(1)} × 0.3 + {' '}
                    {result.scores.samplingAdequacy.value.toFixed(1)} × 0.3 + {' '}
                    {result.scores.noiseControl.value.toFixed(1)} × 0.2 + {' '}
                    {result.scores.imageClarity.value.toFixed(1)} × 0.2
                  </div>
                  <div className="text-tech-400 mt-1">
                    = {(result.scores.trackAccuracy.value * 0.3).toFixed(2)} + {' '}
                    {(result.scores.samplingAdequacy.value * 0.3).toFixed(2)} + {' '}
                    {(result.scores.noiseControl.value * 0.2).toFixed(2)} + {' '}
                    {(result.scores.imageClarity.value * 0.2).toFixed(2)}
                  </div>
                  <div className="text-tech-400 font-bold mt-1">
                    = {result.scores.totalScore.toFixed(2)}
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <div className={`text-7xl font-bold font-orbitron ${gradeColors[totalGrade]}`}>
                  {totalGrade}
                </div>
                <div className="text-3xl font-mono text-tech-400 mt-2">
                  {result.scores.totalScore.toFixed(1)}
                </div>
                <div className="text-xs text-space-400 mt-1">总分</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {scoreItems.map((item, idx) => (
              <ScoreCard
                key={idx}
                title={item.title}
                icon={item.icon}
                score={item.score}
                colorClass={item.colorClass}
              />
            ))}
          </div>

          <ErrorTraceability errors={result.errors} />
        </div>

        <div className="col-span-4 space-y-4">
          <ImageComparison result={result} />
          
          <div className="card-bg rounded-lg p-4 border border-tech-500/30">
            <h3 className="font-orbitron text-tech-400 text-sm font-semibold mb-3">参数记录</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-space-400">航迹偏移</span>
                <span className="text-space-200 font-mono">
                  ({result.params.flightPath.offsetX.toFixed(1)}, {result.params.flightPath.offsetY.toFixed(1)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-space-400">航迹弯曲度</span>
                <span className="text-space-200 font-mono">{result.params.flightPath.curvature.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-space-400">采样间隔</span>
                <span className="text-space-200 font-mono">{result.params.sampling.interval} ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-space-400">采样点数</span>
                <span className="text-space-200 font-mono">{result.params.sampling.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-space-400">噪声水平</span>
                <span className="text-space-200 font-mono">{result.params.noise.level}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-space-400">噪声类型</span>
                <span className="text-space-200 font-mono">
                  {result.params.noise.type === 'gaussian' ? '高斯噪声' : 
                   result.params.noise.type === 'speckle' ? '斑点噪声' : '脉冲噪声'}
                </span>
              </div>
            </div>
          </div>

          <div className="card-bg rounded-lg p-4 border border-tech-500/30">
            <h3 className="font-orbitron text-tech-400 text-sm font-semibold mb-3">理想参数参考</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-space-400">理想航迹</span>
                <span className="text-green-400 font-mono">(0, 0)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-space-400">理想采样间隔</span>
                <span className="text-green-400 font-mono">{scene?.idealParams.samplingInterval} ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-space-400">噪声阈值</span>
                <span className="text-green-400 font-mono">{scene?.idealParams.noiseThreshold}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
