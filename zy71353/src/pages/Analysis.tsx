import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Palette, History, Eye, EyeOff, Save, AlertTriangle,
  TrendingUp, Droplets, Zap, ArrowLeft
} from 'lucide-react';
import { ColorBar } from '@/components/color/ColorBar';
import { IssueTable } from '@/components/issues/IssueTable';
import { DataGapAlert } from '@/components/common/DataGapAlert';
import { StatCard } from '@/components/common/StatCard';
import { useWorkStore } from '@/store/useWorkStore';
import { useColorAnalysis } from '@/hooks/useColorAnalysis';
import { ColorIssue } from '@/types';

const TAGS = ['配色和谐','色彩鲜明','层次分明','需要调整饱和度','对比度不足',
  '色彩单一','建议增加主色','画面偏灰','色彩过饱和','整体优秀'];

export default function AnalysisPage() {
  const { workId } = useParams<{ workId: string }>();
  const navigate = useNavigate();
  const { currentWork, currentVersion, currentAnalysis, currentComment,
    loadWork, saveComment, isLoading } = useWorkStore();
  const { filterColors } = useColorAnalysis();

  const [showMarkers, setShowMarkers] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<ColorIssue | null>(null);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { if (workId) loadWork(workId); }, [workId, loadWork]);

  useEffect(() => {
    if (currentComment) {
      setScore(currentComment.overallScore);
      setComment(currentComment.content);
      setSelectedTags(currentComment.structuredTags || []);
    }
  }, [currentComment]);

  const handleIssueClick = (issue: ColorIssue) => {
    setSelectedIssue(issue);
    setShowMarkers(true);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag)
      ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSave = async () => {
    if (!currentVersion) return;
    setIsSaving(true);
    try {
      await saveComment(currentVersion.id, {
        overallScore: score, content: comment, structuredTags: selectedTags
      });
    } finally { setIsSaving(false); }
  };

  const metrics = currentAnalysis?.metrics;
  const gaps = currentVersion?.dataGaps;

  const getMetricColor = (type: string, val?: number) => {
    if (val === undefined) return 'default';
    if (type === 'entropy') return val >= 2 ? 'success' : val >= 1.5 ? 'warning' : 'danger';
    if (type === 'gray') return val <= 40 ? 'success' : val <= 50 ? 'warning' : 'danger';
    if (type === 'overSat') return val <= 25 ? 'success' : val <= 30 ? 'warning' : 'danger';
    return 'default';
  };

  if (isLoading && !currentWork) {
    return <div className="p-6 flex items-center justify-center min-h-96 text-slate-500">加载中...</div>;
  }

  if (!currentWork || !currentVersion || !currentAnalysis) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-slate-700 font-medium">作品不存在或加载失败</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-slate-500 hover:text-slate-700 mb-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> 返回
          </button>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{currentWork.title}</h1>
          <p className="text-slate-600">色彩质量分析报告</p>
        </div>
        <button onClick={() => navigate(`/history/${workId}`)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors">
          <History className="w-4 h-4" /> 查看历史版本
        </button>
      </div>

      {gaps && (gaps.incomplete || gaps.warnings.length > 0) && (
        <div className="mb-6"><DataGapAlert gaps={gaps} onForceImport={() => {}} onDismiss={() => {}} /></div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div><span className="text-slate-500">版本号：</span>
            <span className="font-medium text-slate-900">v{currentVersion.versionNumber}</span></div>
          <div><span className="text-slate-500">导入时间：</span>
            <span className="font-medium text-slate-900">{new Date(currentVersion.importedAt).toLocaleString('zh-CN')}</span></div>
          <div><span className="text-slate-500">排除像素：</span>
            <span className="font-medium text-slate-900">{currentVersion.excludedPixelCount.toLocaleString()} 个 ({((currentVersion.excludedPixelCount / currentVersion.totalPixelCount) * 100).toFixed(1)}%)</span></div>
          <div><span className="text-slate-500">导入者：</span>
            <span className="font-medium text-slate-900">{currentVersion.importedBy}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">作品图片</h2>
            <button onClick={() => setShowMarkers(!showMarkers)}
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors">
              {showMarkers ? <><Eye className="w-4 h-4" /> 隐藏标记</> : <><EyeOff className="w-4 h-4" /> 显示标记</>}
            </button>
          </div>
          <div className="relative bg-slate-50 rounded-lg overflow-hidden">
            <img src={currentVersion.imageDataUrl} alt={currentWork.title}
              className="w-full h-auto max-h-96 object-contain" />
            {showMarkers && currentAnalysis.issues.map(issue => (
              <div key={issue.id} onClick={() => handleIssueClick(issue)}
                className={`absolute cursor-pointer border-2 rounded transition-all ${
                  selectedIssue?.id === issue.id ? 'border-red-500 bg-red-500/30 ring-2 ring-red-300' : 'border-amber-500 bg-amber-500/20 hover:bg-amber-500/30'
                }`}
                style={{ left: `${issue.pos_x}px`, top: `${issue.pos_y}px`, width: `${issue.width}px`, height: `${issue.height}px`, transform: 'translate(-50%, -50%)' }}
                title={issue.description} />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">主色分布</h2>
            <ColorBar colors={currentAnalysis.dominantColors} height="lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <StatCard title="颜色熵" value={metrics?.colorEntropy.toFixed(2) || '0'} subtitle="色彩丰富度"
              icon={<Palette className="w-5 h-5 text-indigo-600" />} color={getMetricColor('entropy', metrics?.colorEntropy)} />
            <StatCard title="灰度占比" value={`${metrics?.grayPercentage.toFixed(1) || 0}%`} subtitle="低饱和度颜色"
              icon={<Droplets className="w-5 h-5 text-slate-600" />} color={getMetricColor('gray', metrics?.grayPercentage)} />
            <StatCard title="过饱和占比" value={`${metrics?.overSaturatedPercentage.toFixed(1) || 0}%`} subtitle="高饱和度颜色"
              icon={<Zap className="w-5 h-5 text-amber-600" />} color={getMetricColor('overSat', metrics?.overSaturatedPercentage)} />
            <StatCard title="平均饱和度" value={metrics?.averageSaturation.toFixed(1) || '0'} subtitle="整体鲜艳度"
              icon={<TrendingUp className="w-5 h-5 text-emerald-600" />} color="default" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">问题明细</h2>
        <IssueTable issues={currentAnalysis.issues} onIssueClick={handleIssueClick} selectedIssueId={selectedIssue?.id} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">教师点评</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">综合评分 <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-4">
              <input type="range" min="0" max="100" value={score} onChange={e => setScore(Number(e.target.value))}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
              <input type="number" min="0" max="100" value={score}
                onChange={e => setScore(Math.min(100, Math.max(0, Number(e.target.value))))}
                className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-center font-bold text-lg" />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">结构化标签</label>
            <div className="flex flex-wrap gap-2">
              {TAGS.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    selectedTags.includes(tag) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-300'
                  }`}>{tag}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">点评内容</label>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="请输入对学生作品的详细点评..."
            rows={4} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={handleSave} disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" /> {isSaving ? '保存中...' : '保存点评'}
          </button>
        </div>
      </div>
    </div>
  );
}
