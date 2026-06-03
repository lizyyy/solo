import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ArrowRight, FileCheck, AlertTriangle, SlidersHorizontal } from 'lucide-react';
import { useClearingStore } from '@/store/useClearingStore';
import StatusBadge from '@/components/common/StatusBadge';
import AmountDisplay from '@/components/common/AmountDisplay';
import { isZeroReversed, STATUS_LABELS } from '@shared/types';
import type { AdjustmentStatus } from '@shared/types';

const filterOptions: { value: AdjustmentStatus | 'all' | 'flagged'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'flagged', label: '冲正记录' },
  { value: 'pending_custody', label: '待补托管页' },
  { value: 'pending_review', label: '待风控复核' },
  { value: 'reviewed_normal', label: '已复核正常' },
  { value: 'needs_verification', label: '需进一步核实' },
];

export default function AdjustmentList() {
  const navigate = useNavigate();
  const { adjustments, getCustodyByAdjustmentId, navigateToAdjustmentOrCustody } = useClearingStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<AdjustmentStatus | 'all' | 'flagged'>('all');

  const filteredAdjustments = adjustments.filter((adj) => {
    const matchesSearch =
      adj.adjustmentNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      adj.remark.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'flagged') return matchesSearch && isZeroReversed(adj.amount, adj.remark);
    return matchesSearch && adj.status === filterStatus;
  });

  const flaggedCount = adjustments.filter((a) => isZeroReversed(a.amount, a.remark)).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-carbon-800">尾差调整</h1>
          <p className="text-carbon-500 mt-1">
            共 {adjustments.length} 条记录，其中 {flaggedCount} 条为冲正记录需要人工复核
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-card flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-carbon-400" />
          <input
            type="text"
            placeholder="搜索调整单号或备注..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-carbon-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-custody-blue/30 focus:border-custody-blue transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-carbon-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as AdjustmentStatus | 'all' | 'flagged')}
            className="px-3 py-2 border border-carbon-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-custody-blue/30 focus:border-custody-blue bg-white"
          >
            {filterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredAdjustments.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-card">
            <SlidersHorizontal className="w-12 h-12 text-carbon-300 mx-auto mb-4" />
            <p className="text-carbon-500">暂无符合条件的记录</p>
          </div>
        ) : (
          filteredAdjustments.map((adjustment, index) => {
            const isFlagged = isZeroReversed(adjustment.amount, adjustment.remark);
            const hasCustody = !!getCustodyByAdjustmentId(adjustment.id);

            return (
              <div
                key={adjustment.id}
                className={`bg-white rounded-xl shadow-card hover:shadow-card-hover transition-all duration-200 animate-slide-up ${
                  isFlagged ? 'border-l-4 border-risk-red' : ''
                }`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-carbon-800 text-lg font-mono">
                          {adjustment.adjustmentNo}
                        </h3>
                        <StatusBadge
                          status={adjustment.status}
                          amount={adjustment.amount}
                          remark={adjustment.remark}
                        />
                        {isFlagged && (
                          <span className="px-2 py-0.5 bg-risk-red/10 text-risk-red text-xs rounded border border-risk-red/20 font-medium">
                            已冲正
                          </span>
                        )}
                      </div>
                      <p className="text-carbon-600 mb-3">{adjustment.remark}</p>
                      <div className="flex flex-wrap items-center gap-6 text-sm text-carbon-500">
                        <div className="flex items-center gap-1.5">
                          <span className="text-carbon-400">交易日期：</span>
                          <span className="text-carbon-700">{adjustment.tradeDate}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-carbon-400">导入时间：</span>
                          <span className="text-carbon-700">{adjustment.importTime}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-carbon-400">操作人：</span>
                          <span className="text-carbon-700">{adjustment.importOperator}</span>
                        </div>
                        {hasCustody && (
                          <div className="flex items-center gap-1.5 text-custody-blue">
                            <FileCheck className="w-4 h-4" />
                            <span>已有托管页</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-6">
                      <p className="text-sm text-carbon-400 mb-1">金额</p>
                      <AmountDisplay amount={adjustment.amount} className="text-xl" />
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-carbon-100 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm">
                      {adjustment.status === 'pending_custody' && (
                        <span className="flex items-center gap-1 text-warning-orange">
                          <AlertTriangle className="w-4 h-4" />
                          需要补录托管确认页
                        </span>
                      )}
                      {adjustment.status === 'pending_review' && (
                        <span className="flex items-center gap-1 text-risk-red">
                          <AlertTriangle className="w-4 h-4" />
                          等待风控同事复核
                        </span>
                      )}
                      {adjustment.reviewComment && (
                        <span className="text-carbon-500 truncate max-w-md">
                          复核意见：{adjustment.reviewComment}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => navigateToAdjustmentOrCustody(adjustment.id, navigate)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-carbon-600 text-white rounded-lg hover:bg-carbon-700 transition-colors text-sm font-medium"
                    >
                      {hasCustody ? '查看托管页' : '查看详情'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-card">
        <h3 className="font-semibold text-carbon-800 mb-3">📌 说明</h3>
        <ul className="space-y-2 text-sm text-carbon-600">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 bg-risk-red rounded-full mt-1.5 flex-shrink-0" />
            <span>左侧红边标识表示该记录金额为0但备注"已冲正"，需要风控人工复核</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 bg-warning-orange rounded-full mt-1.5 flex-shrink-0" />
            <span>状态为"待补托管页"的记录，请先补录托管确认凭证再提交复核</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 bg-custody-blue rounded-full mt-1.5 flex-shrink-0" />
            <span>点击"查看托管页"按钮可直接跳转到对应的托管确认页</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
