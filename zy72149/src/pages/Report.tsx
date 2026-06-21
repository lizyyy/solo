import { Download, FileText, CheckCircle, Clock, AlertTriangle, Music2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { exportToExcel, downloadReport, generateReportContent } from '../utils/export';
import { countDuplicateGroups } from '../utils/detection';
import TagBadge from '../components/common/TagBadge';

const Report = () => {
  const { materials, getFilteredMaterials, addToast } = useStore();

  const total = materials.length;
  const reviewed = materials.filter((m) => m.status === 'reviewed' || m.status === 'resolved').length;
  const pending = materials.filter((m) => m.status === 'pending').length;
  const hasException = materials.filter((m) => m.status === 'exception').length;

  const authExpired = materials.filter((m) =>
    m.exceptions.some((e) => e.type === 'auth_expired' && !e.resolved)
  ).length;
  const timecodeMismatch = materials.filter((m) =>
    m.exceptions.some((e) => e.type === 'timecode_mismatch' && !e.resolved)
  ).length;
  const duplicateTrack = countDuplicateGroups(materials);

  const emotionStats: Record<string, number> = {};
  materials.forEach((m) => {
    const tag = m.emotionTag || '未标注';
    emotionStats[tag] = (emotionStats[tag] || 0) + 1;
  });

  const progress = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  const handleExportExcel = () => {
    const filtered = getFilteredMaterials();
    exportToExcel(filtered);
    addToast('success', `已导出 ${filtered.length} 条记录`);
  };

  const handleExportReport = () => {
    const filtered = getFilteredMaterials();
    downloadReport(filtered);
    addToast('success', '报告已下载');
  };

  const statsCards = [
    {
      label: '总计素材',
      value: total,
      icon: Music2,
      color: 'bg-slate-500',
      bgColor: 'bg-slate-50',
    },
    {
      label: '已复核',
      value: reviewed,
      icon: CheckCircle,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
    },
    {
      label: '待复核',
      value: pending,
      icon: Clock,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50',
    },
    {
      label: '有异常',
      value: hasException,
      icon: AlertTriangle,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
    },
  ];

  const exceptionStats = [
    { label: '授权过期', value: authExpired, color: 'text-red-600', bgColor: 'bg-red-100' },
    { label: '时码错位', value: timecodeMismatch, color: 'text-amber-600', bgColor: 'bg-amber-100' },
    { label: '重复曲目', value: duplicateTrack, color: 'text-violet-600', bgColor: 'bg-violet-100' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">报告统计</h1>
          <p className="text-sm text-slate-500 mt-1">查看复核进度和数据统计</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            导出报告
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            导出明细
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {statsCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`${card.bgColor} rounded-xl p-4`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 ${card.color} rounded-lg text-white`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-800">{card.value}</p>
              <p className="text-sm text-slate-600">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="font-semibold text-slate-700 mb-4">复核进度</h2>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-slate-600">整体完成度</span>
          <span className="text-sm font-medium text-slate-800">{progress}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-orange-400 to-orange-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
          <span>已完成 {reviewed} / {total}</span>
          <span>还剩 {pending} 条待处理</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-700 mb-4">异常统计</h2>
          <div className="space-y-4">
            {exceptionStats.map((stat) => (
              <div key={stat.label} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${stat.bgColor}`} />
                  <span className="text-sm text-slate-600">{stat.label}</span>
                </div>
                <span className={`text-lg font-semibold ${stat.color}`}>{stat.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 p-3 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-700">
              💡 提示：异常素材建议优先处理，避免影响后续排练安排
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-700 mb-4">情绪标签分布</h2>
          <div className="space-y-3">
            {Object.entries(emotionStats).map(([tag, count]) => (
              <div key={tag} className="flex items-center gap-3">
                <TagBadge type="emotion" value={tag === '未标注' ? '' : tag} />
                <div className="flex-1">
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-orange-400 h-2 rounded-full transition-all"
                      style={{ width: `${(count / total) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm text-slate-600 w-12 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-700 mb-4">报告预览</h2>
        <pre className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600 whitespace-pre-wrap font-sans">
          {generateReportContent(getFilteredMaterials())}
        </pre>
      </div>
    </div>
  );
};

export default Report;
