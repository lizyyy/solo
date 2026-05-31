import { useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { TimelineTrack } from '@/components/TimelineTrack';
import { DetailPanel } from '@/components/DetailPanel';
import { AnomalyBadge } from '@/components/AnomalyBadge';
import { StatsCard } from '@/components/StatsCard';
import type { TimelineData } from '@/types';
import {
  FileText, Users, MapPin, AlertTriangle, ArrowLeft, Filter,
  Clock, Copy, Edit3, FileCheck, Download
} from 'lucide-react';

export const TimelinePage = () => {
  const navigate = useNavigate();
  const scrollRef1 = useRef<HTMLDivElement | null>(null);
  const scrollRef2 = useRef<HTMLDivElement | null>(null);
  const scrollRef3 = useRef<HTMLDivElement | null>(null);

  const {
    currentMaterialId, materialPacks, testRecords, unitEntries,
    terrainRules, anomalies, detailPanelOpen, setDetailPanelOpen
  } = useAppStore();

  const [filterSources, setFilterSources] = useState<string[]>([]);
  const [showOnlyAnomalies, setShowOnlyAnomalies] = useState(false);

  const currentPack = materialPacks.find(p => p.id === currentMaterialId);

  const handleSyncScroll = useCallback((scrollLeft: number) => {
    [scrollRef1, scrollRef2, scrollRef3].forEach(ref => {
      if (ref.current && ref.current.scrollLeft !== scrollLeft) {
        ref.current.scrollLeft = scrollLeft;
      }
    });
  }, []);

  const filteredRecords = testRecords.filter(r => {
    if (showOnlyAnomalies && r.anomalies.length === 0) return false;
    if (filterSources.length > 0 && !filterSources.includes(r.sourceType)) return false;
    return true;
  });

  const rounds = Array.from(new Set([
    ...filteredRecords.map(r => r.round),
    ...unitEntries.map(u => u.effectiveRound),
    ...terrainRules.map(t => t.effectiveRound),
  ])).sort((a, b) => a - b);

  const mergedData: TimelineData = {
    round: 0,
    testRecords: filteredRecords,
    unitEntries,
    terrainRules,
    anomalies,
  };

  const pendingAnomalies = anomalies.filter(a => a.status === 'pending');

  if (!currentMaterialId || !currentPack) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-20 h-20 mb-6 flex items-center justify-center border border-border-default bg-bg-tertiary">
          <FileText size={40} className="text-text-muted" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">请先选择材料包</h2>
        <p className="text-sm text-text-secondary mb-6">在导入页面加载或上传材料包后查看时间线</p>
        <button onClick={() => navigate('/')} className="btn btn-primary">
          <ArrowLeft size={16} className="inline mr-2" />
          前往导入页面
        </button>
      </div>
    );
  }

  const toggleSourceFilter = (source: string) => {
    setFilterSources(prev =>
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-xl font-semibold text-text-primary">
              三线时间线视图
            </h1>
          </div>
          <p className="text-sm text-text-secondary ml-9">
            {currentPack.name} · 共 {rounds.length} 个回合
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDetailPanelOpen(!detailPanelOpen)}
            className="btn"
          >
            <FileCheck size={14} className="inline mr-2" />
            {detailPanelOpen ? '关闭详情' : '打开详情'}
          </button>
          <button
            onClick={() => navigate('/export')}
            className="btn btn-primary"
          >
            <Download size={14} className="inline mr-2" />
            导出报告
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <StatsCard
          title="测试记录"
          value={filteredRecords.length}
          icon={<FileText size={20} />}
          colorClass="text-blue-400"
        />
        <StatsCard
          title="单位条目"
          value={unitEntries.length}
          icon={<Users size={20} />}
          colorClass="text-green-400"
        />
        <StatsCard
          title="地形规则"
          value={terrainRules.length}
          icon={<MapPin size={20} />}
          colorClass="text-amber-400"
        />
        <StatsCard
          title="待确认异常"
          value={pendingAnomalies.length}
          icon={<AlertTriangle size={20} />}
          colorClass="text-accent-warning-light"
        />
        <StatsCard
          title="已确认异常"
          value={anomalies.length - pendingAnomalies.length}
          icon={<FileCheck size={20} />}
          colorClass="text-green-400"
        />
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={16} />
            筛选器
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-text-secondary">来源类型:</label>
              {[
                { type: 'normal', label: '正常', icon: FileText },
                { type: 'late_attachment', label: '晚到', icon: Clock },
                { type: 'duplicate', label: '重复', icon: Copy },
                { type: 'manual_correction', label: '人工', icon: Edit3 },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => toggleSourceFilter(type)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs border transition-colors ${
                    filterSources.includes(type)
                      ? 'bg-accent-military border-accent-military text-white'
                      : 'bg-bg-tertiary border-border-default text-text-secondary hover:border-text-muted'
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-text-secondary">仅显示异常:</label>
              <button
                onClick={() => setShowOnlyAnomalies(!showOnlyAnomalies)}
                className={`px-2 py-1 text-xs border transition-colors ${
                  showOnlyAnomalies
                    ? 'bg-accent-warning border-accent-warning text-white'
                    : 'bg-bg-tertiary border-border-default text-text-secondary hover:border-text-muted'
                }`}
              >
                <AlertTriangle size={12} className="inline mr-1" />
                {showOnlyAnomalies ? '开启' : '关闭'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {pendingAnomalies.length > 0 && (
        <div className="p-4 bg-accent-warning/10 border border-accent-warning/50">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-accent-warning-light flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-accent-warning-light mb-2">
                有 {pendingAnomalies.length} 项异常待确认
              </h3>
              <div className="flex flex-wrap gap-2">
                {pendingAnomalies.slice(0, 5).map(a => (
                  <AnomalyBadge key={a.id} type={a.type} status={a.status} severity={a.severity} />
                ))}
                {pendingAnomalies.length > 5 && (
                  <span className="text-xs text-text-muted">
                    还有 {pendingAnomalies.length - 5} 项...
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <TimelineTrack
          data={mergedData}
          onSyncScroll={handleSyncScroll}
          scrollRef={scrollRef1}
          trackType="records"
        />
        <TimelineTrack
          data={mergedData}
          onSyncScroll={handleSyncScroll}
          scrollRef={scrollRef2}
          trackType="units"
        />
        <TimelineTrack
          data={mergedData}
          onSyncScroll={handleSyncScroll}
          scrollRef={scrollRef3}
          trackType="terrain"
        />
      </div>

      <div className="card">
        <div className="card-header">使用说明</div>
        <div className="card-body text-xs text-text-secondary space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-accent-military">•</span>
            <span>三条轨道水平同步滚动，垂直对齐同一回合的测试记录、单位表和地形规则</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-accent-military">•</span>
            <span>鼠标悬浮任意卡片会高亮对应回合和关联节点，点击测试记录可查看完整证据链</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-accent-warning">•</span>
            <span>橙色边框卡片表示存在异常，默认标记为"待确认"，需人工确认后才可结案</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-accent-military">•</span>
            <span>边界格穿越、战报结算不一致、回合顺序错误三类异常会被自动检测并标记</span>
          </div>
        </div>
      </div>

      <DetailPanel />
    </div>
  );
};
