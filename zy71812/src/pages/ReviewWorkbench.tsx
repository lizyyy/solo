import { useEffect } from 'react';
import { useReviewStore } from '../store/useReviewStore';
import { FilterPanel } from '../components/FilterPanel';
import { TimelineView } from '../components/TimelineView';
import { DetailPanel } from '../components/DetailPanel';
import { AlertTriangle, CheckCircle, Clock, FileText } from 'lucide-react';

export function ReviewWorkbench() {
  const { initializeData, isLoading, refunds, getFilteredRefunds, getPendingCount } =
    useReviewStore();

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  const filteredRefunds = getFilteredRefunds();
  const pendingCount = getPendingCount();
  const normalCount = refunds.filter((r) => r.status === 'normal').length;
  const totalAmount = refunds.reduce((sum, r) => sum + r.amount, 0);
  const totalFeeAmount = refunds.reduce((sum, r) => sum + r.feeAmount, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-status-normal border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-text-secondary text-data-sm">正在加载数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <FilterPanel />

      <div className="px-4 py-3 bg-bg-secondary/50 border-b border-bg-border">
        <div className="flex items-center gap-6">
          <StatCard
            icon={FileText}
            label="总记录数"
            value={refunds.length.toString()}
            color="text-text-primary"
          />
          <StatCard
            icon={CheckCircle}
            label="已确认"
            value={normalCount.toString()}
            color="text-status-normal"
          />
          <StatCard
            icon={AlertTriangle}
            label="待确认"
            value={pendingCount.toString()}
            color="text-status-pending"
          />
          <StatCard
            icon={Clock}
            label="退款合计"
            value={`¥${totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
            color="text-text-primary"
          />
          <StatCard
            icon={FileText}
            label="手续费合计"
            value={`¥${totalFeeAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
            color="text-text-secondary"
          />
          <div className="ml-auto text-data-xs text-text-muted">
            筛选结果：{filteredRefunds.length} 条记录
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <TimelineView refunds={filteredRefunds} />
        </div>
        <DetailPanel />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${color}`} />
      <div>
        <p className="text-data-xs text-text-muted">{label}</p>
        <p className={`font-mono font-medium text-data-sm ${color}`}>{value}</p>
      </div>
    </div>
  );
}
