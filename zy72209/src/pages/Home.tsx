import { useEffect, useState } from 'react';
import { AlertTriangle, FileCheck, RefreshCw, Download, Users, DollarSign, Activity, CheckCircle2, Upload, ImagePlus } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import { StatsCard } from '@/components/StatsCard';
import { SelfCheckPanel } from '@/components/SelfCheckPanel';
import { FilterBar } from '@/components/FilterBar';
import { RecordsTable } from '@/components/RecordsTable';
import { ConflictDrawer } from '@/components/ConflictDrawer';
import { SupplementModal } from '@/components/SupplementModal';
import { ImportModal } from '@/components/ImportModal';
import { ScreenshotModal } from '@/components/ScreenshotModal';
import { RecordDetailDrawer } from '@/components/RecordDetailDrawer';
import { useMemo } from 'react';
import type { CreditRecord } from '../../shared/types';

export default function Home() {
  const { records, loading, fetchRecords, runSelfCheck, exportData, selfCheckRunning, setShowImportModal } = useDashboardStore();
  const [screenshotRecord, setScreenshotRecord] = useState<CreditRecord | null>(null);

  useEffect(() => {
    fetchRecords();
    runSelfCheck();
  }, [fetchRecords, runSelfCheck]);

  const stats = useMemo(() => {
    const nameInconsistencies = records.filter(r => !r.nameConsistent).length;
    const conflicts = records.filter(r => r.hasConflict).length;
    const pendingReview = records.filter(r => r.status === 'resolved' || r.status === 'abnormal').length;
    const totalAmount = records.reduce((sum, r) => sum + r.creditLine, 0);
    
    return {
      nameInconsistencies,
      conflicts,
      pendingReview,
      totalAmount,
      total: records.length
    };
  }, [records]);

  const formatAmount = (amount: number): string => {
    if (amount >= 100000000) {
      return `${(amount / 100000000).toFixed(2)}亿`;
    } else if (amount >= 10000) {
      return `${(amount / 10000).toFixed(2)}万`;
    }
    return amount.toFixed(2);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">授信额度占用看板</h1>
              <p className="mt-1 text-sm text-gray-500">
                托管确认页与除权日截图数据核对平台
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
              >
                <Upload className="h-4 w-4" />
                导入托管确认页
              </button>
              <button
                onClick={() => {
                  fetchRecords();
                  runSelfCheck();
                }}
                disabled={loading || selfCheckRunning}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${(loading || selfCheckRunning) ? 'animate-spin' : ''}`} />
                刷新数据
              </button>
              <button
                onClick={exportData}
                className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
              >
                <Download className="h-4 w-4" />
                导出明细
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="机构简称不一致"
            value={stats.nameInconsistencies}
            icon={Users}
            color="orange"
            subtitle={`共 ${stats.total} 条记录`}
            pulse={stats.nameInconsistencies > 0}
          />
          <StatsCard
            title="数据冲突待处理"
            value={stats.conflicts}
            icon={AlertTriangle}
            color="red"
            subtitle="需要人工确认"
            pulse={stats.conflicts > 0}
          />
          <StatsCard
            title="待财务复核"
            value={stats.pendingReview}
            icon={FileCheck}
            color="yellow"
            subtitle="补录完成待最终审核"
          />
          <StatsCard
            title="总授信额度"
            value={`${formatAmount(stats.totalAmount)}`}
            icon={DollarSign}
            color="green"
            subtitle="全部机构合计"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-1 space-y-6">
            <FilterBar />
            <SelfCheckPanel />
          </div>
          
          <div className="lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">授信记录列表</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {records.length} 条
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span>数据来源统一，展示与导出一致</span>
              </div>
            </div>
            
            {loading ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center gap-2 text-gray-500">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>加载中...</span>
                </div>
              </div>
            ) : (
              <RecordsTable onScreenshot={setScreenshotRecord} />
            )}
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-blue-900">
            <Activity className="h-5 w-5" />
            核心业务流程指引
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-white p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 font-bold">1</div>
              <h4 className="font-medium text-gray-900">导入托管确认页</h4>
              <p className="mt-1 text-sm text-gray-500">
                系统自动检测重复导入和机构简称前后不一致，异常记录高亮标记
              </p>
            </div>
            <div className="rounded-lg bg-white p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600 font-bold">2</div>
              <h4 className="font-medium text-gray-900">补看除权日截图</h4>
              <p className="mt-1 text-sm text-gray-500">
                存在数据矛盾时列出冲突证据，由您选择确认或驳回，系统不自动拍板
              </p>
            </div>
            <div className="rounded-lg bg-white p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold">3</div>
              <h4 className="font-medium text-gray-900">补录记录更新</h4>
              <p className="mt-1 text-sm text-gray-500">
                补录字段后自动重算额度，机构简称不一致保留异常状态待财务复核
              </p>
            </div>
          </div>
        </div>
      </main>

      <ImportModal />
      {screenshotRecord && (
        <ScreenshotModal record={screenshotRecord} onClose={() => setScreenshotRecord(null)} />
      )}
      <ConflictDrawer />
      <SupplementModal />
      <RecordDetailDrawer />
    </div>
  );
}
