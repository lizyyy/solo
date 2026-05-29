import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  ChevronRight,
  Filter,
  RefreshCw,
  DollarSign,
  Shield,
} from 'lucide-react';
import { useArtworkStore } from '../store/artworkStore';
import { useUIStore } from '../store/uiStore';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { NewArtworkModal } from '../components/NewArtworkModal';
import { CURRENCY_SYMBOLS } from '../../shared/types';
import type { RecordStatus } from '../../shared/types';
import { reportApi } from '../services/api';
import { cn } from '../lib/utils';

const statusFilters: Array<{ value: RecordStatus | 'all'; label: string; count?: number }> = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待确认' },
  { value: 'processed', label: '已处理' },
  { value: 'rejected', label: '需退回' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const {
    artworks,
    loading,
    total,
    reportSummary,
    fetchArtworks,
    fetchReportSummary,
    setSelectedStatus,
    selectedStatus,
    setFilters,
    filters,
  } = useArtworkStore();
  const { openNewArtworkModal, showToast, openConfirmDialog, setLoadingOverlay } = useUIStore();

  useEffect(() => {
    fetchArtworks();
    fetchReportSummary();
  }, [fetchArtworks, fetchReportSummary]);

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    setLoadingOverlay(true);
    try {
      const status = selectedStatus === 'all' ? undefined : selectedStatus;
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
        a.download = `保险清单_${new Date().toISOString().slice(0, 10)}.${format}`;
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
    openConfirmDialog({
      title: '批量缺口检测',
      message: '将对所有作品记录进行完整性检查，检测缺失字段和不一致信息。是否继续？',
      confirmText: '开始检测',
      onConfirm: async () => {
        setLoadingOverlay(true);
        try {
          await fetchArtworks();
          showToast('批量检测完成', 'success');
        } catch (err) {
          showToast('检测失败', 'error');
        } finally {
          setLoadingOverlay(false);
        }
      },
    });
  };

  const stats = useMemo(() => [
    {
      title: '总记录数',
      value: total,
      icon: <FileSpreadsheet className="w-6 h-6" />,
      color: 'blue' as const,
      delay: 0,
    },
    {
      title: '已处理',
      value: reportSummary?.processed || 0,
      icon: <CheckCircle2 className="w-6 h-6" />,
      color: 'emerald' as const,
      delay: 100,
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
  ], [total, reportSummary]);

  const formatCurrency = (amount: number, currency: string) => {
    return `${CURRENCY_SYMBOLS[currency as keyof typeof CURRENCY_SYMBOLS] || ''}${amount.toLocaleString()}`;
  };

  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-stone-900"
            style={{ fontFamily: "'Noto Serif SC', serif" }}
          >
            展览作品保险清单
          </h1>
          <p className="text-stone-500 mt-1">{today} · 待处理材料一览</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleBatchCheck}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-stone-600 bg-white border border-stone-300 hover:bg-stone-50 transition-colors shadow-sm"
          >
            <AlertTriangle className="w-4 h-4" />
            批量检查
          </button>
          <div className="flex items-center bg-white border border-stone-300 rounded-lg overflow-hidden shadow-sm">
            <button
              onClick={() => handleExport('xlsx')}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors border-r border-stone-200"
              title="导出Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
              title="导出PDF"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
          <button
            onClick={openNewArtworkModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新建记录
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            title="总估值（人民币）"
            value={formatCurrency(reportSummary.totalValuation, 'CNY')}
            icon={<DollarSign className="w-6 h-6" />}
            color="default"
            delay={400}
          />
          <StatCard
            title="总保额（人民币）"
            value={formatCurrency(reportSummary.totalCoverage, 'CNY')}
            icon={<Shield className="w-6 h-6" />}
            color="default"
            delay={500}
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-200 bg-stone-50">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="搜索作品名称、编号、艺术家..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-colors"
                value={filters.search || ''}
                onChange={(e) => setFilters({ search: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-stone-400" />
              <div className="flex bg-stone-100 rounded-lg p-1">
                {statusFilters.map((filter) => {
                  const isActive = selectedStatus === filter.value;
                  return (
                    <button
                      key={filter.value}
                      onClick={() => setSelectedStatus(filter.value as RecordStatus | 'all')}
                      className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                      isActive
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-stone-600 hover:text-stone-800'
                    )}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => {
                setFilters({ search: '', page: 1 });
                setSelectedStatus('all');
              }}
                className="p-2 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
                title="重置筛选"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left text-xs font-semibold text-stone-600 uppercase tracking-wider px-4 py-3">
                  作品编号
                </th>
                <th className="text-left text-xs font-semibold text-stone-600 uppercase tracking-wider px-4 py-3">
                  作品名称
                </th>
                <th className="text-left text-xs font-semibold text-stone-600 uppercase tracking-wider px-4 py-3">
                  艺术家
                </th>
                <th className="text-left text-xs font-semibold text-stone-600 uppercase tracking-wider px-4 py-3">
                  估值
                </th>
                <th className="text-left text-xs font-semibold text-stone-600 uppercase tracking-wider px-4 py-3">
                  运输状态
                </th>
                <th className="text-left text-xs font-semibold text-stone-600 uppercase tracking-wider px-4 py-3">
                  状态
                </th>
                <th className="text-left text-xs font-semibold text-stone-600 uppercase tracking-wider px-4 py-3">
                  更新时间
                </th>
                <th className="text-right text-xs font-semibold text-stone-600 uppercase tracking-wider px-4 py-3">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-stone-500">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      加载中...
                    </div>
                  </td>
                </tr>
              ) : artworks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-stone-500">
                    暂无记录
                  </td>
                </tr>
              ) : (
                artworks.map((artwork) => (
                  <tr
                    key={artwork.id}
                    className="hover:bg-stone-50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/artwork/${artwork.id}`)}
                  >
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
                    <td className="px-4 py-3 text-sm text-stone-700">
                      -
                    </td>
                    <td className="px-4 py-3">
                      -
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={artwork.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-500">
                      {new Date(artwork.updatedAt).toLocaleDateString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                        查看
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && artworks.length > 0 && (
          <div className="px-4 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
            <p className="text-sm text-stone-500">
              共 <span className="font-medium text-stone-700">{total}</span> 条记录
            </p>
          </div>
        )}
      </div>

      <NewArtworkModal />
    </div>
  );
}
