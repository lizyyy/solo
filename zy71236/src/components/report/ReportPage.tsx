import { useState, useEffect } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { ReportData } from '../../types/synth';
import { Button } from '../ui/Button';
import { LedDisplay } from '../ui/LedDisplay';
import { downloadReport, downloadSession } from '../../utils/export';
import {
  Download,
  FileText,
  Save,
  ArrowLeft,
  Music,
  TrendingUp,
  AlertTriangle,
  Target,
  Zap,
} from 'lucide-react';

interface ScoreRadarProps {
  report: ReportData;
}

function ScoreRadar({ report }: ScoreRadarProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const data = [
    {
      dimension: '音色丰富度',
      score: report.score.dimensions.richness,
      fullMark: 25,
      color: '#00F0FF',
    },
    {
      dimension: '参数合理性',
      score: report.score.dimensions.reasonableness,
      fullMark: 25,
      color: '#FF00AA',
    },
    {
      dimension: '操作流畅度',
      score: report.score.dimensions.fluency,
      fullMark: 20,
      color: '#FFA500',
    },
    {
      dimension: '探索广度',
      score: report.score.dimensions.exploration,
      fullMark: 20,
      color: '#22c55e',
    },
    {
      dimension: '风险控制',
      score: report.score.dimensions.riskControl,
      fullMark: 10,
      color: '#eab308',
    },
  ];

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-6">
      <h3 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
        <Target className="text-cyan-400" size={20} />
        多维度评分
      </h3>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 25]}
              tick={{ fill: '#6B7280', fontSize: 10 }}
              stroke="#4B5563"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#E5E7EB',
              }}
              formatter={(value: number, name: string, props: { payload: { fullMark: number } }) => [
                `${value} / ${props.payload.fullMark}`,
                name,
              ]}
            />
            <Radar
              name="得分"
              dataKey="score"
              stroke="#00F0FF"
              fill="#00F0FF"
              fillOpacity={animated ? 0.3 : 0}
              strokeWidth={2}
              style={{
                transition: 'fill-opacity 1s ease-out',
                filter: 'drop-shadow(0 0 8px #00F0FF)',
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-5 gap-2 mt-4">
        {data.map((item) => (
          <div key={item.dimension} className="text-center">
            <div
              className="text-2xl font-bold font-mono"
              style={{ color: item.color }}
            >
              {item.score}
            </div>
            <div className="text-xs text-gray-500">/ {item.fullMark}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AnalysisSectionProps {
  report: ReportData;
}

function AnalysisSection({ report }: AnalysisSectionProps) {
  const stats = report.score.stats;

  const operationData = [
    { name: '振荡器', count: stats.paramsTouched.filter((p) => p.startsWith('oscillator')).length, total: 3 },
    { name: '滤波器', count: stats.paramsTouched.filter((p) => p.startsWith('filter')).length, total: 4 },
    { name: '包络', count: stats.paramsTouched.filter((p) => p.startsWith('envelope')).length, total: 4 },
    { name: 'LFO', count: stats.paramsTouched.filter((p) => p.startsWith('lfo')).length, total: 4 },
    { name: '主控', count: stats.paramsTouched.filter((p) => p.startsWith('master')).length, total: 1 },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
          <Music className="text-pink-400" size={20} />
          音色描述
        </h3>
        <p className="text-gray-300 leading-relaxed">{report.soundDescription}</p>
      </div>

      <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
          <TrendingUp className="text-green-400" size={20} />
          操作统计
        </h3>

        <div className="h-40 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={operationData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" domain={[0, 4]} stroke="#6B7280" />
              <YAxis dataKey="name" type="category" width={60} stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#E5E7EB',
                }}
                formatter={(value: number, name: string, props: { payload: { total: number } }) => [
                  `${value} / ${props.payload.total}`,
                  '已调节参数',
                ]}
              />
              <Bar dataKey="count" fill="#00F0FF" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">总操作次数</div>
            <div className="text-2xl font-bold text-cyan-400 font-mono">
              {stats.totalOperations}
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">探索参数占比</div>
            <div className="text-2xl font-bold text-green-400 font-mono">
              {Math.round((stats.paramsTouched.length / 13) * 100)}%
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">使用波形</div>
            <div className="text-lg font-bold text-pink-400 font-mono">
              {stats.waveformsUsed.join(', ')}
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">保存预设</div>
            <div className="text-2xl font-bold text-purple-400 font-mono">
              {report.presetsSaved}
            </div>
          </div>
        </div>
      </div>

      {report.warnings.length > 0 && (
        <div className="bg-gray-900/50 rounded-xl border border-orange-500/30 p-6">
          <h3 className="text-lg font-bold text-orange-400 mb-4 flex items-center gap-2">
            <AlertTriangle size={20} />
            风险事件记录
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {report.warnings.map((w, i) => (
              <div
                key={i}
                className={`
                  p-3 rounded-lg border text-sm
                  ${w.severity === 'high' ? 'border-red-500/30 bg-red-500/5' : ''}
                  ${w.severity === 'medium' ? 'border-orange-500/30 bg-orange-500/5' : ''}
                  ${w.severity === 'low' ? 'border-yellow-500/30 bg-yellow-500/5' : ''}
                `}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`
                      text-xs px-2 py-0.5 rounded uppercase font-bold tracking-wider
                      ${w.severity === 'high' ? 'bg-red-500/20 text-red-400' : ''}
                      ${w.severity === 'medium' ? 'bg-orange-500/20 text-orange-400' : ''}
                      ${w.severity === 'low' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                    `}
                  >
                    {w.severity}
                  </span>
                  <span className="text-xs text-gray-500 font-mono">{w.param}</span>
                </div>
                <div className="text-gray-300">{w.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-900/50 rounded-xl border border-cyan-500/30 p-6">
        <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
          <Zap size={20} />
          改进建议
        </h3>
        <div className="space-y-2">
          {report.recommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-3 text-gray-300">
              <span className="text-cyan-400 font-mono text-sm mt-0.5">{i + 1}.</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ReportPageProps {
  report: ReportData;
  onBack: () => void;
}

export function ReportPage({ report, onBack }: ReportPageProps) {
  const [showTotal, setShowTotal] = useState(0);
  const [exportFormat, setExportFormat] = useState<'txt' | 'json'>('txt');

  useEffect(() => {
    const duration = 2000;
    const startTime = Date.now();
    const target = report.score.total;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShowTotal(Math.round(eased * target));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [report.score.total]);

  const handleDownloadReport = () => {
    downloadReport(report, exportFormat);
  };

  const handleDownloadSession = () => {
    downloadSession({
      id: report.sessionId,
      createdAt: report.createdAt,
      updatedAt: Date.now(),
      params: report.finalParams,
      history: report.history,
      presets: [],
      currentScore: report.score,
    });
  };

  const gradeLabels = [
    { min: 90, grade: 'S', color: 'text-yellow-400', label: '大师级' },
    { min: 80, grade: 'A', color: 'text-cyan-400', label: '专业级' },
    { min: 70, grade: 'B', color: 'text-green-400', label: '熟练级' },
    { min: 60, grade: 'C', color: 'text-orange-400', label: '入门级' },
    { min: 0, grade: 'D', color: 'text-red-400', label: '新手级' },
  ];

  const currentGrade = gradeLabels.find((g) => showTotal >= g.min)!;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft size={16} />
            返回实验室
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">会话ID:</span>
            <span className="text-xs font-mono text-gray-400">{report.sessionId}</span>
          </div>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 tracking-wider">
            <span className="text-cyan-400">声音合成</span>
            <span className="text-gray-400"> · </span>
            <span className="text-pink-400">分析报告</span>
          </h1>

          <div className="flex items-center justify-center gap-8 mt-8">
            <div className="text-center">
              <div className="relative">
                <div
                  className={`text-8xl font-bold font-mono ${currentGrade.color}`}
                  style={{ textShadow: `0 0 30px currentColor` }}
                >
                  {showTotal}
                </div>
                <div className="absolute -right-4 top-0">
                  <span
                    className={`text-4xl font-bold ${currentGrade.color}`}
                    style={{ textShadow: `0 0 20px currentColor` }}
                  >
                    {currentGrade.grade}
                  </span>
                </div>
              </div>
              <div className={`text-lg font-medium mt-2 ${currentGrade.color}`}>
                {currentGrade.label}
              </div>
              <div className="text-xs text-gray-500 mt-1">满分 100</div>
            </div>

            <div className="h-32 w-px bg-gray-700" />

            <div className="grid grid-cols-3 gap-4">
              <LedDisplay
                value={report.score.dimensions.richness}
                label="音色丰富度"
                variant="cyan"
                size="md"
              />
              <LedDisplay
                value={report.score.dimensions.reasonableness}
                label="参数合理性"
                variant="magenta"
                size="md"
              />
              <LedDisplay
                value={report.score.dimensions.fluency}
                label="操作流畅度"
                variant="orange"
                size="md"
              />
              <LedDisplay
                value={report.score.dimensions.exploration}
                label="探索广度"
                variant="green"
                size="md"
              />
              <LedDisplay
                value={report.score.dimensions.riskControl}
                label="风险控制"
                variant="orange"
                size="md"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ScoreRadar report={report} />
          <AnalysisSection report={report} />
        </div>

        <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
            <Download className="text-purple-400" size={20} />
            导出报告
          </h3>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">格式:</span>
              <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                <Button
                  size="sm"
                  variant={exportFormat === 'txt' ? 'primary' : 'ghost'}
                  active={exportFormat === 'txt'}
                  onClick={() => setExportFormat('txt')}
                  className="flex items-center gap-1"
                >
                  <FileText size={14} />
                  TXT
                </Button>
                <Button
                  size="sm"
                  variant={exportFormat === 'json' ? 'primary' : 'ghost'}
                  active={exportFormat === 'json'}
                  onClick={() => setExportFormat('json')}
                  className="flex items-center gap-1"
                >
                  <FileText size={14} />
                  JSON
                </Button>
              </div>
            </div>

            <Button variant="primary" onClick={handleDownloadReport} className="flex items-center gap-2">
              <Download size={16} />
              下载报告
            </Button>

            <Button
              variant="secondary"
              onClick={handleDownloadSession}
              className="flex items-center gap-2"
            >
              <Save size={16} />
              保存会话
            </Button>

            <div className="flex-1 text-right text-sm text-gray-500">
              💡 保存会话后，后续可以导入继续同一条记录
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
