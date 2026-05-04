import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  getReconciliations,
  getAccounts,
  getProducts,
  getHolders,
  getUnmatchedTransactions,
  getPayoutDetails,
  getReconciliationAllocations,
  manualMatch,
  unmatch,
  addManualAdjustment,
  exportReconciliations
} from '../services/api';
import {
  formatCurrency,
  formatDate,
  getStatusLabel,
  getStatusBadgeClass
} from '../utils/format';

function Reconciliations() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    account_id: '',
    product_id: '',
    holder_id: '',
    difference_type: '',
    start_date: '',
    end_date: ''
  });
  const [selectedReconciliation, setSelectedReconciliation] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [payoutDetails, setPayoutDetails] = useState(null);
  const [allocations, setAllocations] = useState(null);

  const { data: reconciliations, isLoading: loadingReconciliations } = useQuery(
    ['reconciliations', filters],
    () => getReconciliations(filters),
    { keepPreviousData: true }
  );

  const { data: accounts } = useQuery('accounts', () => getAccounts());
  const { data: products } = useQuery('products', () => getProducts());
  const { data: holders } = useQuery('holders', () => getHolders());
  const { data: unmatchedTransactions } = useQuery(
    ['unmatchedTransactions', selectedReconciliation?.account_id],
    () => getUnmatchedTransactions(selectedReconciliation?.account_id),
    { enabled: showMatchModal && !!selectedReconciliation }
  );

  const matchMutation = useMutation(
    ({ expectedPayoutId, transactionId }) => manualMatch(expectedPayoutId, transactionId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('reconciliations');
        queryClient.invalidateQueries('unmatchedTransactions');
        setShowMatchModal(false);
      },
    }
  );

  const unmatchMutation = useMutation(unmatch, {
    onSuccess: () => {
      queryClient.invalidateQueries('reconciliations');
      setSelectedReconciliation(null);
      setShowDetailsModal(false);
    },
  });

  const adjustmentMutation = useMutation(
    ({ reconciliationId, note }) => addManualAdjustment(reconciliationId, note),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('reconciliations');
        setAdjustmentNote('');
      },
    }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      account_id: '',
      product_id: '',
      holder_id: '',
      difference_type: '',
      start_date: '',
      end_date: ''
    });
  };

  const handleViewDetails = async (reconciliation) => {
    setSelectedReconciliation(reconciliation);
    
    if (reconciliation.expected_payout_id) {
      try {
        const details = await getPayoutDetails(reconciliation.expected_payout_id);
        setPayoutDetails(details.data);
      } catch (e) {
        console.error('Failed to load payout details:', e);
      }
    }

    if (reconciliation.id) {
      try {
        const allocs = await getReconciliationAllocations(reconciliation.id);
        setAllocations(allocs.data);
      } catch (e) {
        console.error('Failed to load allocations:', e);
      }
    }

    setShowDetailsModal(true);
  };

  const handleManualMatch = () => {
    if (!selectedReconciliation?.expected_payout_id || !selectedTransaction) return;
    matchMutation.mutate({
      expectedPayoutId: selectedReconciliation.expected_payout_id,
      transactionId: selectedTransaction.id
    });
  };

  const handleAddAdjustment = () => {
    if (!selectedReconciliation?.id || !adjustmentNote.trim()) return;
    adjustmentMutation.mutate({
      reconciliationId: selectedReconciliation.id,
      note: adjustmentNote
    });
  };

  const handleExport = (format) => {
    const url = exportReconciliations(format, filters);
    window.open(url, '_blank');
  };

  const differenceTypeOptions = [
    { value: '', label: '全部状态' },
    { value: 'matched', label: '已匹配' },
    { value: 'unmatched', label: '未到账' },
    { value: 'underpaid', label: '少到账' },
    { value: 'overpaid', label: '多到账' },
    { value: 'manual', label: '手工调整' },
  ];

  const data = reconciliations?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">核对看板</h1>
          <p className="text-gray-500 mt-1">查看和管理所有核对记录，处理差异和匹配</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="btn btn-secondary"
          >
            📥 导出 CSV
          </button>
          <button
            onClick={() => handleExport('html')}
            className="btn btn-secondary"
          >
            🌐 导出 HTML
          </button>
          <button
            onClick={() => handleExport('markdown')}
            className="btn btn-primary"
          >
            📝 导出 Markdown
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">筛选条件</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">账户</label>
            <select
              value={filters.account_id}
              onChange={(e) => handleFilterChange('account_id', e.target.value)}
              className="select"
            >
              <option value="">全部账户</option>
              {accounts?.data?.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.account_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">产品</label>
            <select
              value={filters.product_id}
              onChange={(e) => handleFilterChange('product_id', e.target.value)}
              className="select"
            >
              <option value="">全部产品</option>
              {products?.data?.map(prod => (
                <option key={prod.id} value={prod.id}>{prod.product_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">持有人</label>
            <select
              value={filters.holder_id}
              onChange={(e) => handleFilterChange('holder_id', e.target.value)}
              className="select"
            >
              <option value="">全部持有人</option>
              {holders?.data?.map(holder => (
                <option key={holder.id} value={holder.id}>{holder.holder_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
            <select
              value={filters.difference_type}
              onChange={(e) => handleFilterChange('difference_type', e.target.value)}
              className="select"
            >
              {differenceTypeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleClearFilters}
            className="btn btn-secondary"
          >
            清除筛选
          </button>
        </div>
      </div>

      <div className="card">
        {loadingReconciliations ? (
          <div className="p-8 text-center text-gray-500">
            <p>加载中...</p>
          </div>
        ) : data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">到账日期</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">产品</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">持有人</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">账户</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">应到账</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">实际到账</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">差额</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">状态</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {formatDate(item.payout_date)}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{item.product_name || '-'}</p>
                        <p className="text-xs text-gray-500">{item.product_code || ''}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{item.holder_name || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{item.account_name || '-'}</td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900 text-right">
                      {formatCurrency(item.expected_amount)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 text-right">
                      {formatCurrency(item.actual_amount)}
                    </td>
                    <td className={`py-3 px-4 text-sm font-medium text-right ${
                      (item.difference || 0) < 0 ? 'text-red-600' : 
                      (item.difference || 0) > 0 ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {formatCurrency(item.difference)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${getStatusBadgeClass(item.difference_type)}`}>
                        {getStatusLabel(item.difference_type)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(item)}
                          className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                        >
                          详情
                        </button>
                        {item.difference_type === 'unmatched' && item.expected_payout_id && (
                          <button
                            onClick={() => {
                              setSelectedReconciliation(item);
                              setShowMatchModal(true);
                            }}
                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                          >
                            匹配
                          </button>
                        )}
                        {item.transaction_id && (
                          <button
                            onClick={() => unmatchMutation.mutate(item.id)}
                            disabled={unmatchMutation.isLoading}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            取消
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500">
            <p className="text-4xl mb-3">📋</p>
            <p>暂无核对记录</p>
            <p className="text-sm mt-1">请先计算应到账计划并进行匹配</p>
          </div>
        )}
      </div>

      {showDetailsModal && selectedReconciliation && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">核对详情</h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">产品</p>
                  <p className="font-medium">{selectedReconciliation.product_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">持有人</p>
                  <p className="font-medium">{selectedReconciliation.holder_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">账户</p>
                  <p className="font-medium">{selectedReconciliation.account_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">状态</p>
                  <span className={`badge ${getStatusBadgeClass(selectedReconciliation.difference_type)}`}>
                    {getStatusLabel(selectedReconciliation.difference_type)}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-gray-900 mb-3">金额明细</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">应到账金额:</span>
                    <span className="font-medium">{formatCurrency(selectedReconciliation.expected_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">实际到账金额:</span>
                    <span className="font-medium">{formatCurrency(selectedReconciliation.actual_amount)}</span>
                  </div>
                  <div className="flex justify-between col-span-2 pt-2 border-t border-gray-200">
                    <span className="text-gray-600">差额:</span>
                    <span className={`font-medium ${
                      (selectedReconciliation.difference || 0) < 0 ? 'text-red-600' : 
                      (selectedReconciliation.difference || 0) > 0 ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {formatCurrency(selectedReconciliation.difference)}
                    </span>
                  </div>
                </div>
              </div>

              {payoutDetails?.calculations && (
                <div className="mb-6">
                  <h3 className="font-medium text-gray-900 mb-3">计算过程</h3>
                  <div className="bg-blue-50 rounded-lg p-4 text-sm">
                    <div className="mb-3">
                      <p className="font-medium text-blue-900">利息计算</p>
                      <p className="text-blue-700 mt-1">{payoutDetails.calculations.interestCalculation?.formula}</p>
                      <p className="text-blue-600 mt-1">
                        本金 {formatCurrency(payoutDetails.calculations.interestCalculation?.principal)} × 
                        年化 {payoutDetails.calculations.interestCalculation?.annualRate}% × 
                        {payoutDetails.calculations.interestCalculation?.holdingDays}天 ÷ 
                        {payoutDetails.calculations.interestCalculation?.daysInYear}天 = 
                        <span className="font-medium">{formatCurrency(payoutDetails.calculations.interestCalculation?.result)}</span>
                      </p>
                    </div>
                    <div className="mb-3">
                      <p className="font-medium text-blue-900">管理费计算</p>
                      <p className="text-blue-700 mt-1">{payoutDetails.calculations.managementFeeCalculation?.formula}</p>
                      <p className="text-blue-600 mt-1">
                        结果: <span className="font-medium">{formatCurrency(payoutDetails.calculations.managementFeeCalculation?.result)}</span>
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-blue-900">净到账计算</p>
                      <p className="text-blue-700 mt-1">{payoutDetails.calculations.netPayout?.formula}</p>
                      <p className="text-blue-600 mt-1">
                        结果: <span className="font-medium">{formatCurrency(payoutDetails.calculations.netPayout?.result)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedReconciliation.transaction_description && (
                <div className="mb-6">
                  <h3 className="font-medium text-gray-900 mb-2">交易描述</h3>
                  <p className="text-gray-600 bg-gray-50 rounded-lg p-3">
                    {selectedReconciliation.transaction_description}
                  </p>
                </div>
              )}

              {selectedReconciliation.manual_adjustment && (
                <div className="mb-6">
                  <h3 className="font-medium text-gray-900 mb-2">手工调整说明</h3>
                  <p className="text-gray-600 bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                    {selectedReconciliation.manual_adjustment}
                  </p>
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-2">添加手工调整说明</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={adjustmentNote}
                    onChange={(e) => setAdjustmentNote(e.target.value)}
                    placeholder="输入调整说明..."
                    className="input flex-1"
                  />
                  <button
                    onClick={handleAddAdjustment}
                    disabled={!adjustmentNote.trim() || adjustmentMutation.isLoading}
                    className="btn btn-primary"
                  >
                    {adjustmentMutation.isLoading ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>

              {allocations?.allocations?.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">份额分摊明细</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-2 px-3 text-gray-500">持有人</th>
                          <th className="text-right py-2 px-3 text-gray-500">份额</th>
                          <th className="text-right py-2 px-3 text-gray-500">分摊本金</th>
                          <th className="text-right py-2 px-3 text-gray-500">分摊利息</th>
                          <th className="text-right py-2 px-3 text-gray-500">分摊差额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocations.allocations.map((alloc) => (
                          <tr key={alloc.id} className="border-t border-gray-100">
                            <td className="py-2 px-3">{alloc.holder_name || '-'}</td>
                            <td className="py-2 px-3 text-right">{(alloc.share_ratio * 100).toFixed(2)}%</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(alloc.allocated_principal)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(alloc.allocated_interest)}</td>
                            <td className={`py-2 px-3 text-right ${
                              (alloc.allocated_difference || 0) < 0 ? 'text-red-600' : 
                              (alloc.allocated_difference || 0) > 0 ? 'text-green-600' : 'text-gray-600'
                            }`}>
                              {formatCurrency(alloc.allocated_difference)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="btn btn-secondary"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {showMatchModal && selectedReconciliation && (
        <div className="modal-overlay" onClick={() => setShowMatchModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">手工匹配交易</h2>
                <button
                  onClick={() => setShowMatchModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  匹配产品: <span className="font-medium">{selectedReconciliation.product_name}</span>
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  应到账金额: <span className="font-medium">{formatCurrency(selectedReconciliation.expected_amount)}</span>
                </p>
              </div>

              <h3 className="font-medium text-gray-900 mb-3">选择未匹配的交易</h3>
              {unmatchedTransactions?.data?.length > 0 ? (
                <div className="space-y-2">
                  {unmatchedTransactions.data.map((txn) => (
                    <div
                      key={txn.id}
                      onClick={() => setSelectedTransaction(txn)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTransaction?.id === txn.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{txn.description || '无描述'}</p>
                          <p className="text-sm text-gray-500">{formatDate(txn.transaction_date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{formatCurrency(txn.transaction_amount)}</p>
                          <p className="text-xs text-gray-500">差额: {formatCurrency(txn.transaction_amount - selectedReconciliation.expected_amount)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>没有找到未匹配的交易</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowMatchModal(false)}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleManualMatch}
                disabled={!selectedTransaction || matchMutation.isLoading}
                className="btn btn-primary"
              >
                {matchMutation.isLoading ? '匹配中...' : '确认匹配'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reconciliations;
