import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, RefreshCw, Edit3, Undo2, Plus, History, XCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { useGame } from '../GameContext';
import { formatCurrency, getTransactionTypeLabel, getTransactionStatusLabel, getTransactionStatusColor, formatDate } from '../utils';
import type { Transaction, CorrectionRecord } from '../types';

type FilterType = 'all' | 'normal' | 'supplement' | 'reversed' | 'pending_review';

export const Ledger: React.FC = () => {
  const { state, dispatch } = useGame();
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showCorrectModal, setShowCorrectModal] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [correctField, setCorrectField] = useState('amount');
  const [correctNewValue, setCorrectNewValue] = useState('');
  const [correctReason, setCorrectReason] = useState('');
  const [reverseReason, setReverseReason] = useState('');
  const [supplementAmount, setSupplementAmount] = useState('');
  const [supplementReason, setSupplementReason] = useState('');

  const filteredTransactions = state.transactions.filter((t) => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  const totalIncome = state.transactions
    .filter((t) => t.cnyEquivalent > 0 && !t.isReversed)
    .reduce((sum, t) => sum + t.cnyEquivalent, 0);
  const totalExpense = state.transactions
    .filter((t) => t.cnyEquivalent < 0 && !t.isReversed)
    .reduce((sum, t) => sum + Math.abs(t.cnyEquivalent), 0);

  const handleCorrect = () => {
    if (!selectedTransaction || !correctNewValue || !correctReason) return;

    const oldValue = selectedTransaction[correctField as keyof Transaction];
    dispatch({
      type: 'CORRECT_TRANSACTION',
      payload: {
        transactionId: selectedTransaction.id,
        fieldName: correctField,
        oldValue,
        newValue: correctField === 'amount' || correctField === 'cnyEquivalent'
          ? parseFloat(correctNewValue)
          : correctNewValue,
        reason: correctReason,
        operator: '玩家',
      },
    });

    setShowCorrectModal(false);
    setCorrectField('amount');
    setCorrectNewValue('');
    setCorrectReason('');
    setSelectedTransaction(null);
  };

  const handleReverse = () => {
    if (!selectedTransaction || !reverseReason) return;

    dispatch({
      type: 'REVERSE_TRANSACTION',
      payload: {
        transactionId: selectedTransaction.id,
        reason: reverseReason,
        operator: '玩家',
      },
    });

    setShowReverseModal(false);
    setReverseReason('');
    setSelectedTransaction(null);
  };

  const handleSupplement = () => {
    if (!selectedTransaction || !supplementAmount || !supplementReason) return;

    dispatch({
      type: 'SUPPLEMENT_TRANSACTION',
      payload: {
        originalTransactionId: selectedTransaction.id,
        amount: parseFloat(supplementAmount),
        currency: selectedTransaction.currency,
        reason: supplementReason,
        operator: '玩家',
      },
    });

    setShowSupplementModal(false);
    setSupplementAmount('');
    setSupplementReason('');
    setSelectedTransaction(null);
  };

  const getTypeIcon = (type: Transaction['type']) => {
    if (type === 'sale') return ArrowUpRight;
    if (type === 'purchase') return ArrowDownRight;
    return RefreshCw;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">交易账本</h2>
          <p className="text-gray-500 mt-1">记录所有资金往来，支持修正、撤回、补录操作</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <ArrowUpRight className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">总收入</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <ArrowDownRight className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">总支出</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <History className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">补录/修正</p>
              <p className="text-2xl font-bold text-orange-600">
                {state.transactions.filter((t) => t.isSupplement || t.correctionHistory?.length).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
              <Undo2 className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已撤回</p>
              <p className="text-2xl font-bold text-gray-600">
                {state.transactions.filter((t) => t.isReversed).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {(['all', 'normal', 'supplement', 'reversed', 'pending_review'] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-primary-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {f === 'all' ? '全部' : getTransactionStatusLabel(f)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">交易编号</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">类型</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">描述</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">外币金额</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">人民币</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">汇率</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">状态</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">回合</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredTransactions.map((txn) => {
              const TypeIcon = getTypeIcon(txn.type);
              return (
                <tr
                  key={txn.id}
                  className={`hover:bg-gray-50 transition-colors cursor-pointer ${txn.isReversed ? 'opacity-50' : ''}`}
                  onClick={() => setSelectedTransaction(txn)}
                >
                  <td className="px-6 py-4">
                    <div className="font-mono text-sm text-gray-900">{txn.transactionNo}</div>
                    <div className="text-xs text-gray-400">{formatDate(txn.createTime)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        txn.cnyEquivalent >= 0 ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        <TypeIcon className={`w-4 h-4 ${txn.cnyEquivalent >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{getTransactionTypeLabel(txn.type)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-900">{txn.description}</p>
                    {txn.isSupplement && (
                      <p className="text-xs text-orange-600 mt-1">补录自第{txn.supplementRound}回合</p>
                    )}
                    {txn.isReversed && (
                      <p className="text-xs text-gray-500 mt-1">已撤回：{txn.reversalReason}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className={`font-semibold ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(txn.amount, txn.currency)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className={`font-bold ${txn.cnyEquivalent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(txn.cnyEquivalent)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-600">{txn.exchangeRateUsed.toFixed(4)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getTransactionStatusColor(txn.status)}`}>
                      {txn.isReversed ? <XCircle className="w-3 h-3" /> : txn.isSupplement ? <Plus className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                      {getTransactionStatusLabel(txn.status)}
                    </span>
                    {txn.correctionHistory && txn.correctionHistory.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 ml-2">
                        <Edit3 className="w-3 h-3" /> 已修正
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-600">第 {txn.round} 回合</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-1 justify-end">
                      {!txn.isReversed && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTransaction(txn);
                              setShowCorrectModal(true);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="修正"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTransaction(txn);
                              setShowReverseModal(true);
                            }}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="撤回"
                          >
                            <Undo2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTransaction(txn);
                              setShowSupplementModal(true);
                            }}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded transition-colors"
                            title="补录"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {state.correctionRecords.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-blue-600" /> 人工修正历史
          </h3>
          <div className="space-y-3">
            {state.correctionRecords.map((record: CorrectionRecord) => (
              <div key={record.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div>
                  <p className="font-medium text-blue-900">
                    {record.transactionId} - {record.fieldName}
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    旧值: <code className="bg-white px-1.5 py-0.5 rounded">{String(record.oldValue)}</code> →
                    新值: <code className="bg-white px-1.5 py-0.5 rounded">{String(record.newValue)}</code>
                  </p>
                  <p className="text-sm text-blue-600 mt-1">理由：{record.reason}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-blue-600">{record.operator}</p>
                  <p className="text-xs text-blue-500 mt-1">第{record.round}回合 · {formatDate(record.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCorrectModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[500px] shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">人工修正</h3>
            <p className="text-gray-500 mb-6">{selectedTransaction.transactionNo}</p>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">当前金额</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {formatCurrency(selectedTransaction.amount, selectedTransaction.currency)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">修正字段</label>
                <select
                  value={correctField}
                  onChange={(e) => setCorrectField(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="amount">金额 (外币)</option>
                  <option value="cnyEquivalent">金额 (人民币)</option>
                  <option value="description">描述</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">新值</label>
                <input
                  type={correctField === 'description' ? 'text' : 'number'}
                  value={correctNewValue}
                  onChange={(e) => setCorrectNewValue(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="请输入新值"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">修正理由</label>
                <textarea
                  value={correctReason}
                  onChange={(e) => setCorrectReason(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="请输入修正理由，将留痕备查"
                />
              </div>

              <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                <p className="text-sm text-yellow-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  此操作将永久留痕，旧值和修正理由将被记录，月底复盘时可查看。
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCorrectModal(false);
                  setCorrectField('amount');
                  setCorrectNewValue('');
                  setCorrectReason('');
                }}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCorrect}
                disabled={!correctNewValue || !correctReason}
                className="flex-1 px-4 py-3 bg-primary-500 text-white font-medium rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认修正
              </button>
            </div>
          </div>
        </div>
      )}

      {showReverseModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[500px] shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">撤回交易</h3>
            <p className="text-gray-500 mb-6">{selectedTransaction.transactionNo}</p>

            <div className="space-y-4">
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <p className="text-sm text-red-700 mb-2">交易详情</p>
                <p className="font-medium text-red-900">{selectedTransaction.description}</p>
                <p className="text-red-600 mt-1">
                  {formatCurrency(selectedTransaction.cnyEquivalent)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">撤回理由</label>
                <textarea
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="请输入撤回理由，将留痕备查"
                />
              </div>

              <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                <p className="text-sm text-yellow-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  撤回操作将生成一笔反向冲正交易，原交易状态标记为"已撤回"，现金余额将同步调整。
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowReverseModal(false);
                  setReverseReason('');
                }}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleReverse}
                disabled={!reverseReason}
                className="flex-1 px-4 py-3 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认撤回
              </button>
            </div>
          </div>
        </div>
      )}

      {showSupplementModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[500px] shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">补录交易</h3>
            <p className="text-gray-500 mb-6">基于 {selectedTransaction.transactionNo} 补录</p>

            <div className="space-y-4">
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                <p className="text-sm text-orange-700 mb-2">原交易</p>
                <p className="font-medium text-orange-900">{selectedTransaction.description}</p>
                <p className="text-orange-600 mt-1">
                  {formatCurrency(selectedTransaction.amount, selectedTransaction.currency)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">补录金额 ({selectedTransaction.currency})</label>
                <input
                  type="number"
                  value={supplementAmount}
                  onChange={(e) => setSupplementAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="请输入补录金额"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">补录理由</label>
                <textarea
                  value={supplementReason}
                  onChange={(e) => setSupplementReason(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="请输入补录理由，如：前期尾款到账、遗漏记录等"
                />
              </div>

              {supplementAmount && (
                <div className="p-4 bg-primary-50 rounded-xl border border-primary-100">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-primary-700">折算人民币</span>
                    <span className="font-medium text-primary-900">
                      {formatCurrency(parseFloat(supplementAmount) * state.currentRate.rate)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-primary-700">汇率</span>
                    <span className="font-medium text-primary-900">{state.currentRate.rate.toFixed(4)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSupplementModal(false);
                  setSupplementAmount('');
                  setSupplementReason('');
                }}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSupplement}
                disabled={!supplementAmount || !supplementReason}
                className="flex-1 px-4 py-3 bg-orange-500 text-white font-medium rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认补录
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
