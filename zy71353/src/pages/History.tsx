import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, Eye, GitCompare, CheckCircle,
  TrendingUp, TrendingDown, Minus, Plus, Palette,
  AlertTriangle, XCircle
} from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { useWorkStore } from '@/store/useWorkStore';
import { useWorkHistory } from '@/hooks/useWorkHistory';
import { WorkVersion, VersionDiff } from '@/types';
import { db } from '@/db';

export default function HistoryPage() {
  const { workId } = useParams<{ workId: string }>();
  const navigate = useNavigate();
  const { currentWork, loadWork, loadVersion, isLoading } = useWorkStore();
  const { versions, loadVersions, compareVersions, getVersionLabel,
    getVersionStatusBadge, isLoading: historyLoading } = useWorkHistory();

  const [selected1, setSelected1] = useState('');
  const [selected2, setSelected2] = useState('');
  const [comparison, setComparison] = useState<VersionDiff | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    if (workId) { loadWork(workId); loadVersions(workId); }
  }, [workId, loadWork, loadVersions]);

  useEffect(() => {
    const loadScores = async () => {
      const s: Record<string, number> = {};
      for (const v of versions) {
        const c = await db.teacherComments.where('versionId').equals(v.id).first();
        s[v.id] = c?.overallScore || 0;
      }
      setScores(s);
    };
    if (versions.length) loadScores();
  }, [versions]);

  const handleCompare = async () => {
    if (!selected1 || !selected2) return;
    const diff = await compareVersions(selected1, selected2);
    setComparison(diff);
    setShowCompare(true);
  };

  const handleView = (id: string) => { loadVersion(id); navigate(`/analysis/${workId}`); };

  const toggleSelect = (id: string) => {
    if (selected1 === id) { setSelected1(selected2); setSelected2(''); }
    else if (selected2 === id) { setSelected2(''); }
    else if (!selected1) { setSelected1(id); }
    else if (!selected2) { setSelected2(id); }
    else { setSelected1(id); setSelected2(''); }
    setShowCompare(false);
  };

  const getChangeColor = (c: string) =>
    c === 'added' ? 'bg-emerald-100 text-emerald-700' :
    c === 'removed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
  const getBarColor = (c: string) =>
    c === 'added' ? 'bg-emerald-500' : c === 'removed' ? 'bg-red-500' : 'bg-amber-500';

  const renderTimeline = (v: WorkVersion, i: number) => {
    const status = getVersionStatusBadge(v);
    const isSelected = selected1 === v.id || selected2 === v.id;
    const score = scores[v.id] || 0;

    return (
      <div key={v.id} className="relative">
        {i < versions.length - 1 && <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-slate-200" />}
        <div className={`relative flex gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
          isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'
        }`} onClick={() => toggleSelect(v.id)}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
            isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {isSelected ? <CheckCircle className="w-6 h-6" /> : <Clock className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h3 className="font-semibold text-slate-900">{getVersionLabel(v)}</h3>
                <p className="text-sm text-slate-500">{new Date(v.importedAt).toLocaleString('zh-CN')}</p>
              </div>
              <span className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: status.color + '20', color: status.color }}>
                {status.text}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <img src={v.imageDataUrl} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
              <div className="flex-1 space-y-1">
                <div><span className="text-sm text-slate-500">评分：</span>
                  <span className={`font-bold ${score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {score > 0 ? `${score}分` : '未评分'}
                  </span>
                </div>
                <div><span className="text-sm text-slate-500">尺寸：</span>
                  <span className="text-sm text-slate-700">{v.width} × {v.height}</span>
                </div>
                <div><span className="text-sm text-slate-500">导入者：</span>
                  <span className="text-sm text-slate-700">{v.importedBy}</span>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleView(v.id); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm transition-colors">
                <Eye className="w-4 h-4" /> 查看详情
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCompare = () => {
    if (!comparison) return null;
    const { scoreChange, issueChanges, colorChanges, commentChange, version1, version2 } = comparison;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">版本对比结果</h3>
          <button onClick={() => setShowCompare(false)} className="text-sm text-slate-500 hover:text-slate-700">关闭</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="评分变化" value={scoreChange > 0 ? `+${scoreChange}` : scoreChange}
            subtitle={`v${version1.versionNumber} → v${version2.versionNumber}`}
            icon={scoreChange >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
            color={scoreChange >= 0 ? 'success' : scoreChange < 0 ? 'danger' : 'default'} />
          <StatCard title="新增问题" value={issueChanges.added.length} subtitle="新出现的问题"
            icon={<Plus className="w-5 h-5 text-amber-600" />}
            color={issueChanges.added.length > 0 ? 'warning' : 'success'} />
          <StatCard title="已修复问题" value={issueChanges.removed.length} subtitle="已解决的问题"
            icon={<CheckCircle className="w-5 h-5 text-emerald-600" />} color="success" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Palette className="w-5 h-5 text-indigo-600" /> 颜色变化
          </h4>
          {colorChanges.length === 0 ? (
            <div className="flex items-center gap-2 text-slate-500"><Minus className="w-4 h-4" /> 颜色分布无显著变化</div>
          ) : (
            <div className="space-y-3">
              {colorChanges.slice(0, 8).map(c => (
                <div key={c.hex} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded border border-slate-200" style={{ backgroundColor: c.hex }} />
                  <span className="font-mono text-sm text-slate-700 w-20">{c.hex.toUpperCase()}</span>
                  <span className={`text-sm px-2 py-0.5 rounded ${getChangeColor(c.change)}`}>
                    {c.change === 'added' ? '新增' : c.change === 'removed' ? '移除' : '调整'}
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-xs text-slate-500">{c.oldPercentage.toFixed(1)}%</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${getBarColor(c.change)}`}
                        style={{ width: `${Math.max(c.oldPercentage, c.newPercentage)}%` }} />
                    </div>
                    <span className="text-xs text-slate-500">{c.newPercentage.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-amber-600" /> 新增问题
            </h4>
            {issueChanges.added.length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-600"><CheckCircle className="w-4 h-4" /> 无新增问题</div>
            ) : (
              <div className="space-y-2">
                {issueChanges.added.map(i => (
                  <div key={i.id} className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
                    <div className="w-5 h-5 rounded border border-slate-200" style={{ backgroundColor: i.colorHex }} />
                    <span className="text-sm text-slate-700">{i.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" /> 已修复问题
            </h4>
            {issueChanges.removed.length === 0 ? (
              <div className="flex items-center gap-2 text-slate-500"><Minus className="w-4 h-4" /> 暂无已修复问题</div>
            ) : (
              <div className="space-y-2">
                {issueChanges.removed.map(i => (
                  <div key={i.id} className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg">
                    <div className="w-5 h-5 rounded border border-slate-200" style={{ backgroundColor: i.colorHex }} />
                    <span className="text-sm text-slate-700">{i.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {commentChange && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h4 className="font-semibold text-slate-900 mb-3">最新点评</h4>
            <p className="text-slate-600">{commentChange}</p>
          </div>
        )}
      </div>
    );
  };

  if (isLoading || historyLoading) {
    return <div className="p-6 flex items-center justify-center min-h-96 text-slate-500">加载中...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-slate-500 hover:text-slate-700 mb-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> 返回
        </button>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">{currentWork?.title || '作品'} · 版本历史</h1>
        <p className="text-slate-600">查看和对比不同版本的分析结果</p>
      </div>

      {currentWork && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">作品信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
            <div><span className="text-slate-500">作品标题</span><p className="font-medium text-slate-900 mt-1">{currentWork.title}</p></div>
            <div><span className="text-slate-500">主题</span><p className="font-medium text-slate-900 mt-1">{currentWork.theme || '未设置'}</p></div>
            <div><span className="text-slate-500">版本总数</span><p className="font-medium text-slate-900 mt-1">{versions.length} 个版本</p></div>
            <div><span className="text-slate-500">创建时间</span><p className="font-medium text-slate-900 mt-1">{new Date(currentWork.createdAt).toLocaleDateString('zh-CN')}</p></div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">已选择 {[selected1, selected2].filter(Boolean).length}/2 个版本</span>
          {selected1 && selected2 && (
            <button onClick={handleCompare} disabled={historyLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50">
              <GitCompare className="w-4 h-4" /> 开始对比
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">点击版本卡片选择要对比的两个版本</p>
      </div>

      {showCompare && comparison && (
        <div className="mb-6 bg-slate-50 rounded-xl p-6 border border-slate-200">{renderCompare()}</div>
      )}

      <div className="space-y-4">
        {versions.map((v, i) => renderTimeline(v, i))}
      </div>

      {versions.length === 0 && (
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-slate-700 font-medium">暂无版本记录</p>
        </div>
      )}
    </div>
  );
}
