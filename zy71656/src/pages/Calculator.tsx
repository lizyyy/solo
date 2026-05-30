import { useState, useEffect } from 'react';
import { Calculator as CalcIcon, RefreshCw, Download, AlertCircle, CheckCircle, Eye } from 'lucide-react';
import { useStore } from '../store/useStore.js';
import { PRODUCT_TYPE_LABELS, EXCEPTION_TYPE_LABELS } from '../../shared/types.js';

export default function Calculator() {
  const {
    authors,
    loadAuthors,
    selectedPeriod,
    setSelectedPeriod,
    selectedAuthorId,
    setSelectedAuthorId,
    calculationResult,
    calculateRoyalties,
    clearCalculationResult,
    confirmException,
    exportSettlement,
  } = useStore();

  const [forceRecalculate, setForceRecalculate] = useState(false);
  const [showTrailModal, setShowTrailModal] = useState<string | null>(null);
  const [confirmNote, setConfirmNote] = useState('');
  const [confirmingException, setConfirmingException] = useState<string | null>(null);

  useEffect(() => {
    loadAuthors();
  }, [loadAuthors]);

  const handleCalculate = () => {
    calculateRoyalties({
      period: selectedPeriod,
      authorId: selectedAuthorId || undefined,
      forceRecalculate,
    });
  };

  const handleConfirmException = (exceptionId: string) => {
    confirmException(exceptionId, '当前用户', confirmNote || undefined);
    setConfirmingException(null);
    setConfirmNote('');
  };

  const handleExport = () => {
    if (calculationResult) {
      exportSettlement({
        settlementId: calculationResult.settlementId,
        format: 'EXCEL',
        includeTrail: true,
        includeRawData: false,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">版税计算</h2>
        <p className="text-gray-500 mt-1">选择结算周期和作者，计算版税并生成明细</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              结算周期
            </label>
            <input
              type="month"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择作者
            </label>
            <select
              value={selectedAuthorId || ''}
              onChange={(e) => setSelectedAuthorId(e.target.value || null)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">全部作者</option>
              {authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={forceRecalculate}
                onChange={(e) => setForceRecalculate(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">强制重新计算</span>
            </label>
          </div>
          <div className="flex items-end gap-3">
            <button
              onClick={handleCalculate}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <CalcIcon size={18} />
              开始计算
            </button>
            {calculationResult && (
              <button
                onClick={clearCalculationResult}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {calculationResult && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-sm text-gray-500">总金额</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                ¥{calculationResult.totalAmount.toLocaleString('zh-CN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-sm text-gray-500">明细条数</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {calculationResult.itemCount}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-sm text-gray-500">异常数量</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  calculationResult.exceptionCount > 0 ? 'text-red-600' : 'text-gray-800'
                }`}
              >
                {calculationResult.exceptionCount}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <button
                onClick={handleExport}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download size={18} />
                导出报告
              </button>
            </div>
          </div>

          {calculationResult.exceptions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <AlertCircle className="text-red-500" size={20} />
                异常记录
              </h3>
              <div className="space-y-3">
                {calculationResult.exceptions.map((exception) => (
                  <div
                    key={exception.id}
                    className={`p-4 rounded-lg border ${
                      exception.isConfirmed
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              exception.severity === 'ERROR'
                                ? 'bg-red-200 text-red-800'
                                : exception.severity === 'WARNING'
                                ? 'bg-yellow-200 text-yellow-800'
                                : 'bg-gray-200 text-gray-800'
                            }`}
                          >
                            {exception.severity === 'ERROR'
                              ? '错误'
                              : exception.severity === 'WARNING'
                              ? '警告'
                              : '信息'}
                          </span>
                          <span className="font-medium text-gray-800">
                            {EXCEPTION_TYPE_LABELS[exception.type]}
                          </span>
                          {exception.isConfirmed && (
                            <span className="flex items-center gap-1 text-green-600 text-sm">
                              <CheckCircle size={14} />
                              已确认
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-sm">{exception.message}</p>
                        {exception.confirmedBy && (
                          <p className="text-gray-500 text-xs mt-2">
                            确认人: {exception.confirmedBy} | 备注: {exception.confirmationNote || '无'}
                          </p>
                        )}
                      </div>
                      {!exception.isConfirmed &&
                        confirmingException !== exception.id && (
                          <button
                            onClick={() => setConfirmingException(exception.id)}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            确认处理
                          </button>
                        )}
                      {confirmingException === exception.id && (
                        <div className="flex items-center gap-2 ml-4">
                          <input
                            type="text"
                            placeholder="备注（可选）"
                            value={confirmNote}
                            onChange={(e) => setConfirmNote(e.target.value)}
                            className="px-3 py-1 border border-gray-200 rounded text-sm"
                          />
                          <button
                            onClick={() => handleConfirmException(exception.id)}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                          >
                            确认
                          </button>
                          <button
                            onClick={() => {
                              setConfirmingException(null);
                              setConfirmNote('');
                            }}
                            className="px-3 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50"
                          >
                            取消
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800">结算明细</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">图书</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">作者</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">类型</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">渠道</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">销量</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">退货</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">净销量</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">阶梯</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">税率</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">版税</th>
                    <th className="text-center px-6 py-3 text-sm font-medium text-gray-500">轨迹</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {calculationResult.items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                        {item.bookName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.authorName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {PRODUCT_TYPE_LABELS[item.productType]}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.channel}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">
                        {item.salesVolume}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">
                        {item.returnVolume}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">
                        {item.netSalesVolume}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        第{item.ladderTier}档 ({item.ladderRange})
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {(item.royaltyRate * 100).toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 font-medium text-right">
                        ¥{item.royaltyAmount.toLocaleString('zh-CN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setShowTrailModal(item.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {showTrailModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">计算轨迹</h3>
                  <button
                    onClick={() => setShowTrailModal(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  {calculationResult.items
                    .filter((item) => item.id === showTrailModal)
                    .map((item) => (
                      <div key={item.id} className="space-y-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm font-medium text-blue-800 mb-2">计算公式</p>
                          <code className="text-sm text-blue-600 break-all">
                            {item.calculationTrail?.formula}
                          </code>
                        </div>
                        <div className="space-y-3">
                          {item.calculationTrail?.steps.map((step) => (
                            <div
                              key={step.order}
                              className="p-4 border border-gray-200 rounded-lg"
                            >
                              <div className="flex items-center gap-3 mb-2">
                                <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                                  {step.order}
                                </span>
                                <span className="font-medium text-gray-800">
                                  {step.description}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-1">
                                <span className="font-medium">规则:</span> {step.rule}
                              </p>
                              <p className="text-sm text-gray-600 mb-1">
                                <span className="font-medium">输入:</span> {step.input}
                              </p>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">输出:</span> {step.output}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
