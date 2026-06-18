import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckCircle2,
  FilePlus2,
  AlertTriangle,
  CloudFog,
  Download,
  Filter,
  Clock,
  MapPin,
  ArrowUpRight,
  Waves,
  ChevronRight,
  FileText,
  History,
} from 'lucide-react';
import { useAnnotationStore } from '@/store/useAnnotationStore';
import type { AnnotationStatus } from '@/shared/types';
import { triggerExportAll } from '@/utils/export';
import { cn } from '@/lib/utils';

const statusColor: Record<AnnotationStatus, string> = {
  正常: 'bg-status-normal',
  补录: 'bg-status-supplement',
  异常: 'bg-status-anomaly',
  云遮挡: 'bg-status-cloud',
};

const statusTextColor: Record<AnnotationStatus, string> = {
  正常: 'text-status-normal',
  补录: 'text-status-supplement',
  异常: 'text-status-anomaly',
  云遮挡: 'text-status-cloud',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { annotations, auditTrails, filterStatus, setFilterStatus, computeStatistics } = useAnnotationStore();

  const stats = useMemo(() => computeStatistics(), [computeStatistics]);

  const filteredAnnotations = useMemo(() => {
    const list = [...annotations].sort((a, b) => b.sampleTime.localeCompare(a.sampleTime));
    if (filterStatus === '全部') return list;
    return list.filter((a) => a.status === filterStatus);
  }, [annotations, filterStatus]);

  const statCards = [
    {
      label: '正常记录',
      value: stats.normalCount,
      icon: CheckCircle2,
      color: 'text-status-normal',
      bg: 'bg-status-normal/10',
      border: 'border-status-normal/30',
    },
    {
      label: '补录记录',
      value: stats.supplementCount,
      icon: FilePlus2,
      color: 'text-status-supplement',
      bg: 'bg-status-supplement/10',
      border: 'border-status-supplement/30',
    },
    {
      label: '异常记录',
      value: stats.anomalyCount,
      icon: AlertTriangle,
      color: 'text-status-anomaly',
      bg: 'bg-status-anomaly/10',
      border: 'border-status-anomaly/30',
    },
    {
      label: '云遮挡',
      value: stats.cloudCount,
      icon: CloudFog,
      color: 'text-status-cloud',
      bg: 'bg-status-cloud/10',
      border: 'border-status-cloud/30',
    },
  ];

  const handleExportAll = () => {
    triggerExportAll(annotations, auditTrails, '小宋');
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  };

  const getLastTrail = (id: string) => {
    return auditTrails
      .filter((t) => t.annotationId === id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ocean-900 via-ocean-800 to-ocean-900">
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(255,122,89,0.15) 0%, transparent 40%),
            radial-gradient(circle at 80% 70%, rgba(42,157,143,0.12) 0%, transparent 40%)
          `,
        }}
      />

      <header className="relative border-b border-ocean-600/30 bg-ocean-800/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-coral-400 to-ocean-500 flex items-center justify-center shadow-lg">
              <Waves size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-lg text-ocean-50 tracking-wide">
                珊瑚白化空间标注复核系统
              </h1>
              <p className="text-[11px] text-ocean-300 font-mono">
                Coral Bleaching Spatial Annotation Review
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportAll}
              className="flex items-center gap-2 px-4 py-2 bg-coral-500 hover:bg-coral-600 text-white rounded-lg text-sm font-medium transition-all hover:shadow-lg hover:shadow-coral-500/20 -translate-y-0 hover:-translate-y-0.5"
            >
              <Download size={16} />
              一键导出全部
            </button>
            <div className="w-9 h-9 rounded-full bg-ocean-700 border border-ocean-500/50 flex items-center justify-center text-ocean-200 text-sm font-medium">
              宋
            </div>
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-6 py-6">
        <section className="grid grid-cols-4 gap-4 mb-6">
          {statCards.map((card, idx) => (
            <div
              key={card.label}
              className={cn(
                'relative rounded-xl border p-4 overflow-hidden animate-fade-up',
                card.bg,
                card.border,
              )}
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <div className="absolute top-3 right-3">
                <card.icon size={18} className={cn(card.color, 'opacity-70')} />
              </div>
              <div className="text-[12px] text-ocean-300 mb-1">{card.label}</div>
              <div className={cn('text-3xl font-serif font-bold', card.color)}>{card.value}</div>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-ocean-400">
                <ArrowUpRight size={10} className={card.color} />
                占比 {((card.value / stats.total) * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-12 gap-4 mb-6">
          <div className="col-span-8 rounded-xl border border-ocean-600/30 bg-ocean-800/50 backdrop-blur p-4 animate-fade-up">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif font-semibold text-ocean-50 flex items-center gap-2">
                <LayoutDashboard size={16} className="text-coral-300" />
                整体概览
              </h2>
              <span className="text-[11px] text-ocean-400">基于 {stats.total} 条记录统计</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-ocean-700/30 rounded-lg p-3">
                <div className="text-[11px] text-ocean-400 mb-1">总有效调查面积</div>
                <div className="text-xl font-mono text-ocean-50">
                  {stats.totalValidArea.toFixed(2)}
                  <span className="text-[11px] text-ocean-400 ml-1">km²</span>
                </div>
              </div>
              <div className="bg-ocean-700/30 rounded-lg p-3">
                <div className="text-[11px] text-ocean-400 mb-1">总白化面积</div>
                <div className="text-xl font-mono text-coral-300">
                  {stats.totalBleachingArea.toFixed(2)}
                  <span className="text-[11px] text-ocean-400 ml-1">km²</span>
                </div>
              </div>
              <div className="bg-ocean-700/30 rounded-lg p-3">
                <div className="text-[11px] text-ocean-400 mb-1">平均白化率</div>
                <div className="text-xl font-mono text-status-anomaly">
                  {stats.avgBleachingRate.toFixed(2)}
                  <span className="text-[11px] text-ocean-400 ml-1">%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-4 rounded-xl border border-ocean-600/30 bg-ocean-800/50 backdrop-blur p-4 animate-fade-up" style={{ animationDelay: '80ms' }}>
            <h2 className="font-serif font-semibold text-ocean-50 flex items-center gap-2 mb-3">
              <History size={16} className="text-coral-300" />
              操作指引
            </h2>
            <ul className="space-y-2 text-[12px] text-ocean-200">
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-status-normal/20 text-status-normal flex items-center justify-center text-[10px] flex-shrink-0">1</span>
                从汇总列表点击记录进入详情，遥感截图与三联标注同步
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-status-supplement/20 text-status-supplement flex items-center justify-center text-[10px] flex-shrink-0">2</span>
                发现云遮挡：标记区域并填写补看来源，自动从汇总排除
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-status-anomaly/20 text-status-anomaly flex items-center justify-center text-[10px] flex-shrink-0">3</span>
                人工改判：填写理由，线索链自动记录并可回跳截图
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-status-cloud/20 text-status-cloud flex items-center justify-center text-[10px] flex-shrink-0">4</span>
                一键导出：场景标注/侧边说明/CSV 同一数据源，不会三套话
              </li>
            </ul>
          </div>
        </section>

        <section className="rounded-xl border border-ocean-600/30 bg-ocean-800/50 backdrop-blur overflow-hidden animate-fade-up" style={{ animationDelay: '160ms' }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-ocean-600/30 bg-ocean-700/30">
            <h2 className="font-serif font-semibold text-ocean-50 flex items-center gap-2">
              <Clock size={16} className="text-coral-300" />
              标注时间轴
            </h2>

            <div className="flex items-center gap-2">
              <Filter size={13} className="text-ocean-400" />
              <div className="flex bg-ocean-800/60 rounded-lg p-0.5 border border-ocean-600/30">
                {(['全部', '正常', '补录', '异常', '云遮挡'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={cn(
                      'px-3 py-1 text-[11px] rounded-md transition-all',
                      filterStatus === s
                        ? 'bg-coral-500 text-white shadow'
                        : 'text-ocean-300 hover:text-ocean-100',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="relative">
              <div className="absolute left-6 top-2 bottom-2 w-px bg-gradient-to-b from-ocean-300/40 via-ocean-300/20 to-transparent" />

              <div className="space-y-3">
                {filteredAnnotations.length === 0 && (
                  <div className="text-center text-ocean-400 text-sm py-12">暂无匹配的记录</div>
                )}

                {filteredAnnotations.map((a, idx) => {
                  const lastTrail = getLastTrail(a.id);
                  return (
                    <div
                      key={a.id}
                      onClick={() => navigate(`/annotations/${a.id}`)}
                      className="relative pl-14 cursor-pointer group"
                      style={{ animation: `fadeUp 0.4s ease-out ${idx * 50}ms both` }}
                    >
                      <div
                        className={cn(
                          'absolute left-4 top-5 w-4 h-4 rounded-full border-2 border-ocean-800 z-10',
                          statusColor[a.status],
                        )}
                      />

                      <div className="relative bg-ocean-700/20 hover:bg-ocean-700/40 rounded-xl border border-ocean-600/30 hover:border-ocean-500/50 p-4 transition-all group-hover:translate-x-1 group-hover:shadow-lg">
                        <div className="absolute left-0 top-5 w-1 h-8 rounded-r-full bg-gradient-to-r from-transparent to-transparent group-hover:from-coral-400 transition-all" />

                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span
                                className={cn(
                                  'text-[10px] px-2 py-0.5 rounded-full font-medium text-white',
                                  statusColor[a.status],
                                )}
                              >
                                {a.status}
                              </span>
                              <span className="text-[12px] text-ocean-300 font-serif font-semibold">
                                {a.station}
                              </span>
                              <span className="text-[11px] text-ocean-400 font-mono">{a.id}</span>
                            </div>

                            <div className="text-[12px] text-ocean-100 line-clamp-1 mb-2">
                              {a.sceneLabel.slice(0, 80)}...
                            </div>

                            <div className="flex items-center gap-4 text-[10px] text-ocean-400 flex-wrap">
                              <span className="flex items-center gap-1">
                                <MapPin size={10} />
                                {formatDate(a.sampleTime)} 采样
                              </span>
                              <span>
                                白化率:{' '}
                                <span className={statusTextColor[a.status]}>
                                  {(
                                    (a.bleachingArea /
                                      (a.hasCloudCover && a.cloudMask
                                        ? a.totalArea - a.cloudMask.affectedArea
                                        : a.totalArea)) *
                                    100
                                  ).toFixed(2)}
                                  %
                                </span>
                              </span>
                              <span>
                                等级:{' '}
                                <span className={cn(
                                  a.severity === '正常' && 'text-status-normal',
                                  a.severity === '轻度' && 'text-yellow-400',
                                  a.severity === '中度' && 'text-orange-400',
                                  a.severity === '严重' && 'text-status-anomaly',
                                )}>
                                  {a.severity}
                                </span>
                              </span>
                              {lastTrail && (
                                <span className="flex items-center gap-1 text-ocean-400">
                                  <FileText size={10} />
                                  最近: {lastTrail.action} · {lastTrail.operator}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="text-right text-[10px] text-ocean-500 font-mono">
                              {new Date(a.sampleTime).toLocaleDateString('zh-CN')}
                            </div>
                            <ChevronRight size={16} className="text-ocean-500 group-hover:text-coral-400 transition-colors" />
                          </div>
                        </div>

                        {lastTrail && (
                          <div className="mt-2 pt-2 border-t border-ocean-600/20">
                            <div className="text-[10px] text-ocean-400">
                              <span className="text-coral-300/80">[{lastTrail.action}]</span>{' '}
                              {lastTrail.reason.slice(0, 50)}...
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
