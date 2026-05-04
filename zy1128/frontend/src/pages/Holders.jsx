import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  getHolders,
  getSubscriptions,
  getHolderAllocations,
  validateShareRatios
} from '../services/api';
import {
  formatCurrency,
  formatDate,
  formatPercentage,
  getProductTypeLabel
} from '../utils/format';

function Holders() {
  const queryClient = useQueryClient();
  const [selectedHolder, setSelectedHolder] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [holderAllocations, setHolderAllocations] = useState(null);
  const [validationResult, setValidationResult] = useState(null);

  const { data: holders, isLoading: loadingHolders } = useQuery('holders', () => getHolders());
  const { data: subscriptions } = useQuery('subscriptions', () => getSubscriptions());

  const validateMutation = useMutation(
    (productId) => validateShareRatios(productId),
    {
      onSuccess: (data) => {
        setValidationResult(data.data);
      },
    }
  );

  const handleViewHolder = async (holder) => {
    setSelectedHolder(holder);
    setShowDetails(true);
    
    try {
      const allocs = await getHolderAllocations(holder.id);
      setHolderAllocations(allocs.data);
    } catch (e) {
      console.error('Failed to load allocations:', e);
    }
  };

  const handleValidateAll = () => {
    const products = new Set();
    subscriptions?.data?.forEach(sub => {
      if (sub.product_id) products.add(sub.product_id);
    });
    if (products.size > 0) {
      validateMutation.mutate(Array.from(products)[0]);
    }
  };

  const holderList = holders?.data || [];
  const subscriptionList = subscriptions?.data || [];

  const getHolderSubscriptions = (holderId) => {
    return subscriptionList.filter(sub => sub.holder_id === holderId);
  };

  const getHolderTotalInvestment = (holderId) => {
    return getHolderSubscriptions(holderId).reduce((sum, sub) => sum + (sub.share_amount || 0), 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">持有人管理</h1>
          <p className="text-gray-500 mt-1">管理持有人信息和份额分摊</p>
        </div>
        <button
          onClick={handleValidateAll}
          className="btn btn-secondary"
        >
          📊 验证分摊比例
        </button>
      </div>

      {validationResult && (
        <div className={`card p-4 ${validationResult.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">{validationResult.valid ? '✅' : '⚠️'}</span>
            <div>
              <h3 className={`font-semibold ${validationResult.valid ? 'text-green-800' : 'text-red-800'}`}>
                分摊比例验证结果
              </h3>
              {validationResult.valid ? (
                <p className="text-sm text-green-700 mt-1">所有产品的分摊比例合计均为 100%</p>
              ) : (
                <div className="mt-2">
                  <p className="text-sm text-red-700">发现以下产品分摊比例异常：</p>
                  <ul className="text-sm text-red-600 mt-1 space-y-1">
                    {validationResult.issues?.map((issue, idx) => (
                      <li key={idx}>
                        • 产品 {issue.product_name || issue.product_code}: 
                        比例合计 {(issue.totalRatio * 100).toFixed(2)}% 
                        (应为 100%)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loadingHolders ? (
          <div className="col-span-full card p-8 text-center text-gray-500">
            <p>加载中...</p>
          </div>
        ) : holderList.length > 0 ? (
          holderList.map((holder) => {
            const holderSubs = getHolderSubscriptions(holder.id);
            const totalInvestment = getHolderTotalInvestment(holder.id);
            
            return (
              <div
                key={holder.id}
                className="card p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-xl text-primary-600">👤</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{holder.holder_name}</h3>
                      <p className="text-sm text-gray-500">
                        {holderSubs.length} 个产品
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">总投资金额</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(totalInvestment)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">持有的产品</span>
                    <span className="text-sm text-gray-700">
                      {holderSubs.slice(0, 2).map(sub => sub.product_name || sub.product_code).join('、')}
                      {holderSubs.length > 2 && ` 等 ${holderSubs.length} 个`}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleViewHolder(holder)}
                    className="w-full btn btn-secondary text-sm"
                  >
                    查看详情
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full card p-12 text-center text-gray-500">
            <p className="text-4xl mb-3">👥</p>
            <p>暂无持有人数据</p>
            <p className="text-sm mt-1">请先导入认购份额数据</p>
          </div>
        )}
      </div>

      {showDetails && selectedHolder && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-lg text-primary-600">👤</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedHolder.holder_name}
                    </h2>
                    <p className="text-sm text-gray-500">持有人详情</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">总投资金额</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {formatCurrency(getHolderTotalInvestment(selectedHolder.id))}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">持有产品数</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {getHolderSubscriptions(selectedHolder.id).length}
                  </p>
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 mb-3">持有份额明细</h3>
              {getHolderSubscriptions(selectedHolder.id).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-3 text-gray-500">产品</th>
                        <th className="text-left py-2 px-3 text-gray-500">类型</th>
                        <th className="text-right py-2 px-3 text-gray-500">份额金额</th>
                        <th className="text-right py-2 px-3 text-gray-500">分摊比例</th>
                        <th className="text-left py-2 px-3 text-gray-500">起息日</th>
                        <th className="text-left py-2 px-3 text-gray-500">到期日</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getHolderSubscriptions(selectedHolder.id).map((sub) => (
                        <tr key={sub.id} className="border-t border-gray-100">
                          <td className="py-2 px-3">
                            <p className="font-medium text-gray-900">{sub.product_name || sub.product_code}</p>
                          </td>
                          <td className="py-2 px-3 text-gray-600">
                            {getProductTypeLabel(sub.product_type)}
                          </td>
                          <td className="py-2 px-3 text-right font-medium">
                            {formatCurrency(sub.share_amount)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {formatPercentage(sub.share_ratio)}
                          </td>
                          <td className="py-2 px-3 text-gray-600">
                            {formatDate(sub.start_date)}
                          </td>
                          <td className="py-2 px-3 text-gray-600">
                            {formatDate(sub.maturity_date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">暂无持有记录</p>
              )}

              {holderAllocations?.allocations?.length > 0 && (
                <>
                  <h3 className="font-semibold text-gray-900 mt-6 mb-3">分摊明细</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-2 px-3 text-gray-500">产品</th>
                          <th className="text-left py-2 px-3 text-gray-500">到账日期</th>
                          <th className="text-right py-2 px-3 text-gray-500">分摊本金</th>
                          <th className="text-right py-2 px-3 text-gray-500">分摊利息</th>
                          <th className="text-right py-2 px-3 text-gray-500">分摊差额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holderAllocations.allocations.map((alloc) => (
                          <tr key={alloc.id} className="border-t border-gray-100">
                            <td className="py-2 px-3">
                              <p className="font-medium text-gray-900">{alloc.product_name || '-'}</p>
                            </td>
                            <td className="py-2 px-3 text-gray-600">
                              {formatDate(alloc.payout_date)}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {formatCurrency(alloc.allocated_principal)}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {formatCurrency(alloc.allocated_interest)}
                            </td>
                            <td className={`py-2 px-3 text-right font-medium ${
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

                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">汇总统计</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-blue-600">总分摊本金</p>
                        <p className="font-bold text-blue-900">
                          {formatCurrency(holderAllocations.summary?.totalPrincipal)}
                        </p>
                      </div>
                      <div>
                        <p className="text-blue-600">总分摊利息</p>
                        <p className="font-bold text-blue-900">
                          {formatCurrency(holderAllocations.summary?.totalInterest)}
                        </p>
                      </div>
                      <div>
                        <p className="text-blue-600">总分摊费用</p>
                        <p className="font-bold text-blue-900">
                          {formatCurrency(holderAllocations.summary?.totalFees)}
                        </p>
                      </div>
                      <div>
                        <p className="text-blue-600">总分摊差额</p>
                        <p className={`font-bold ${
                          (holderAllocations.summary?.totalDifference || 0) < 0 ? 'text-red-600' : 
                          (holderAllocations.summary?.totalDifference || 0) > 0 ? 'text-green-600' : 'text-blue-900'
                        }`}>
                          {formatCurrency(holderAllocations.summary?.totalDifference)}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowDetails(false)}
                className="btn btn-secondary"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Holders;
