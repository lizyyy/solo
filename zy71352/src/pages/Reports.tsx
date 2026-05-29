import { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Clock,
  Ban,
  AlertTriangle,
  Download,
  FileBarChart,
  RefreshCw,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useArtworkStore } from '../store/artworkStore';
import { useUIStore } from '../store/uiStore';
import { StatCard } from '../components/StatCard';
import { StatusBadge, SeverityBadge } from '../components/StatusBadge';
import { GapAlertList } from '../components/GapAlertList';
import { CURRENCY_SYMBOLS, STATUS_LABELS } from '../../shared/types';
import type { RecordStatus } from '../../shared/types';
import { reportApi, gapCheckApi } from '../services/api';
import { cn } from '../lib/utils';

export default function ReportsPage() {
  const navigate = useNavigate();
  const { artworks, reportSummary, fetchArtworks, fetchReportSummary, loading } = useArtworkStore();
  const { showToast, setLoadingOverlay } = useUIStore();
  const [activeTab, setActiveTab] = useState<RecordStatus | 'all'>('all');
  const [batchAlerts, setBatchAlerts] = useState<Array<{ artworkId?: string; alerts: any[]; isComplete: boolean }>>([]);
  const [showGaps, setShowGaps] = useState(false);

  useEffect(() => {
    fetchArtworks();
    fetchReportSummary();
  }, [fetchArtworks, fetchReportSummary]);

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    setLoadingOverlay(true);
    try {
      const status = activeTab === 'all' ? undefined : activeTab;
      const response = await reportApi.export(format, status);
      if (response.success && response.data) {
        const blob = new Blob([response.data], {
          type: format === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/pdf',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `保险清单报告_${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`报告导出成功`, 'success');
      }
    } catch (err) {
      showToast('导出失败，请重试', 'error');
    } finally {
      setLoadingOverlay(false);
    }
  };

  const handleBatchCheck = async () => {
    setLoadingOverlay(true);
    try {
      const response = await gapCheckApi.checkBatch();
      if (response.success && response.data) {
        setBatchAlerts(response.data);
        setShowGaps(true);
        showToast('批量检测完成', 'success');
      }
    } catch (err) {
      showToast('检测失败', 'error');
    } finally {
      setLoadingOverlay(false);
    }
  };

  const filteredArtworks = activeTab === 'all'
    ? artworks
    : artworks.filter(a => a.status === activeTab);

  const stats = [
    {
      title: '总记录数',
      value: reportSummary?.total || 0,
      icon: <FileBarChart className="w-6 h-6" />,
      color: 'blue' as const,
      delay: 0,
    },
    {
      title: '已处理',
      value: reportSummary?.processed || 0,
      icon: <CheckCircle2 className="w-6 h-6" />,
      color: 'emerald' as const,
      delay: 100,
      trend: reportSummary?.total ? {
        value: Math.round((reportSummary.processed / reportSummary.total) * 100),
        isPositive: true,
      } : undefined,
    },
    {
      title: '待确认',
      value: reportSummary?.pending || 0,
      icon: <Clock className="w-6 h-6" />,
      color: 'amber' as const,
      delay: 200,
    },
    {
      title: '需退回补材料',
      value: reportSummary?.rejected || 0,
      icon: <Ban className="w-6 h-6" />,
      color: 'red' as const,
      delay: 300,
    },
  ];

  const statusTabs: Array<{ id: RecordStatus | 'all'; label: string; icon: typeof CheckCircle2; color: string }> = [
    { id: 'all', label: '全部', icon: FileBarChart, color: 'text-stone-600' },
    { id: 'processed', label: '已处理', icon: CheckCircle2, color: 'text-emerald-600' },
    { id: 'pending', label: '待确认', icon: Clock, color: 'text-amber-600' },
    { id: 'rejected', label: '需退回', icon: Ban, color: 'text-red-600' },
  ];

  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const formatCurrency = (amount: number) => {
    return `${CURRENCY_SYMBOLS.CNY}${amount.toLocaleString()}`;
  };

  const getProgressIcon = (status: RecordStatus) => {
    switch (status) {
      case 'processed':
        return <TrendingUp className="w-4 h-4 text-emerald-600" />;
      case 'pending':
        return <Minus className="w-4 h-4 text-amber-600" />;
      case 'rejected':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-stone-900"
            style={{ fontFamily: "'Noto Serif SC', serif" }}
          >
            报告导出
          </h1>
          <p className="text-stone-500 mt-1">{today} · 展览作品保险清单报告</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleBatchCheck}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-stone-600 bg-white border border-stone-300 hover:bg-stone-50 transition-colors shadow-sm"
          >
            <AlertTriangle className="w-4 h-4" />
            批量缺口检测
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            导出 Excel
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm"
          >
            <FileText className="w-4 h-4" />
            导出 PDF
          </button>
        </div>
      </div>

      {reportSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>
      )}

      {reportSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="总估值"
            value={formatCurrency(reportSummary.totalValuation)}
            icon={<FileBarChart className="w-6 h-6" />}
            color="default"
            delay={400}
          />
          <StatCard
            title="总保额"
            value={formatCurrency(reportSummary.totalCoverage)}
            icon={<FileBarChart className="w-6 h-6" />}
            color="default"
            delay={500}
          />
          <StatCard
            title="待解决问题"
            value={reportSummary.gapCount}
            icon={<AlertTriangle className="w-6 h-6" />}
            color={reportSummary.gapCount > 0 ? 'red' : 'emerald'}
            delay={600}
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-200 bg-stone-50">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-wrap gap-2">
              {statusTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const count = tab.id === 'all'
                  ? artworks.length
                  : artworks.filter(a => a.status === tab.id).length;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                  )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    <span className={cn(
                    'px-1.5 py-0.5 text-xs rounded-full',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-stone-100 text-stone-600'
                  )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left text-xs font-semibold text-stone-600 uppercase tracking-wider px-4 py-3">
                  状态
                </th>
                <th className="text-left text-xs font-semibold text-stone-600 uppercase tracking-wider px-4 py-3">
                  作品编号
                </th>
                <th className="text-left text-xs font-semibold text-stone-600 uppercase tracking-wider px-4 py-3">
                  作品名称
                </th>
                <th className="text-left text-xs font-semibold text-stone-600 uppercase tracking-wider px-4 py-3">
                  艺术家
                </th>
                <th className="text-right text-xs font-semibold text-stone-600 uppercase tracking-wider px-4 py-3">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-stone-500">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      加载中...
                    </div>
                  </td>
                </tr>
              ) : filteredArtworks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-stone-500">
                    暂无记录
                  </td>
                </tr>
              ) : (
                filteredArtworks.map((artwork) => (
                  <tr
                    key={artwork.id}
                    className="hover:bg-stone-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getProgressIcon(artwork.status)}
                        <StatusBadge status={artwork.status} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-stone-600">
                      {artwork.artworkNo}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-stone-900">{artwork.name}</div>
                      <div className="text-xs text-stone-500">{artwork.material}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-700">
                      {artwork.artist}
                      {artwork.year && (
                        <span className="text-stone-400"> · {artwork.year}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => navigate(`/artwork/${artwork.id}`)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                      >
                        查看详情
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <p className="text-sm text-stone-500">
            当前分类下共 <span className="font-medium text-stone-700">{filteredArtworks.length}</span> 条记录
          </p>
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-stone-400" />
            <span className="text-xs text-stone-500">
              点击右上角按钮导出报告
            </span>
          </div>
        </div>
      </div>

      {showGaps && batchAlerts.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-stone-900">批量缺口检测结果</h3>
            </div>
            <button
              onClick={() => setShowGaps(false)}
              className="text-sm text-stone-500 hover:text-stone-700"
            >
              收起
            </button>
          </div>
          <div className="p-4 space-y-4">
            {batchAlerts
              .filter(result => result.alerts.length > 0)
              .map((result) => {
                const artwork = artworks.find(a => a.id === result.artworkId);
                if (!artwork) return null;
                return (
                  <div key={result.artworkId} className="border border-stone-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 bg-stone-50 border-b border-stone-200">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={artwork.status} />
                        <div>
                          <p className="font-medium text-stone-900">{artwork.name}</p>
                          <p className="text-xs text-stone-500">{artwork.artworkNo}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.alerts.filter(a => a.severity === 'error').length > 0 && (
                          <SeverityBadge severity="error" />
                        )}
                        {result.alerts.filter(a => a.severity === 'warning').length > 0 && (
                          <SeverityBadge severity="warning" />
                        )}
                        <button
                          onClick={() => navigate(`/artwork/${artwork.id}`)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
                        >
                          修复
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="p-4">
                      <GapAlertList alerts={result.alerts} />
                    </div>
                  </div>
                );
              })}
            {batchAlerts.filter(r => r.alerts.length > 0).length === 0 && (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-emerald-700 font-medium">所有记录数据完整</p>
                <p className="text-emerald-600 text-sm mt-1">未发现缺失字段或不一致信息</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
        <h3
          className="text-lg font-bold text-slate-900 mb-4"
          style={{ fontFamily: "'Noto Serif SC', serif" }}
        >
          报告说明
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="font-medium text-stone-900">已处理</span>
            </div>
            <p className="text-sm text-stone-600 leading-relaxed">
              估值、合同、运输三要素完整对齐，保险条款齐全，所有数据经过校验无误，可以归档。
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="font-medium text-stone-900">待确认</span>
            </div>
            <p className="text-sm text-stone-600 leading-relaxed">
              部分信息待核对或补充，需要与相关方确认后再完成处理。
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="font-medium text-stone-900">需退回补材料</span>
            </div>
            <p className="text-sm text-stone-600 leading-relaxed">
              存在关键信息缺失或不一致，需要退回相关部门补充完整材料。
            </p>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-slate-200">
          <h4 className="font-medium text-stone-900 mb-2">导出报告包含以下内容：</h4>
          <ul className="text-sm text-stone-600 space-y-1">
            <li>• 作品基本信息（编号、名称、艺术家、年代、材质、尺寸）</li>
            <li>• 估值信息（金额、币种、日期、机构）</li>
            <li>• 借展合同信息（版本、出借方、期限）</li>
            <li>• 运输状态追踪</li>
            <li>• 保险条款信息</li>
            <li>• 数据完整性检查结果及待解决问题</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
