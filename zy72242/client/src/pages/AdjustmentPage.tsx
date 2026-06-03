import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { adjustmentApi, recordApi } from '../services/api';
import { TailAdjustment, ReconciliationRecord } from '../types';
import {
  AdjustmentsHorizontalIcon,
  PlusIcon,
  LinkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

export default function AdjustmentPage() {
  const { state, loadRecords, loadAdjustments } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const handleCreateAdjustment = async () => {
    if (!selectedRecordId || !amount || !reason) return;
    setSubmitting(true);
    try {
      await adjustmentApi.createAdjustment({
        recordId: selectedRecordId,
        amount: parseFloat(amount),
        reason,
        adjustedBy: state.currentUser.name
      });
      setShowForm(false);
      setSelectedRecordId('');
      setAmount('');
      setReason('');
      await loadRecords();
      await loadAdjustments();
    } catch (error) {
      console.error('创建尾差调整失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await adjustmentApi.recalculateAll();
      await loadRecords();
      await loadAdjustments();
    } catch (error) {
      console.error('重算失败:', error);
    } finally {
      setRecalculating(false);
    }
  };

  const getRecordInfo = (recordId: string): ReconciliationRecord | undefined => {
    return state.records.find(r => r.id === recordId);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif-sc text-gray-900">尾差调整管理</h2>
          <p className="text-sm text-gray-500 mt-1">补录尾差调整条后，关联记录的对账说明自动更新</p>
        </div>
        <div className="flex space-x-2">
          <button onClick={handleRecalculate} disabled={recalculating} className="btn-secondary flex items-center space-x-1">
            <ArrowPathIcon className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
            <span>{recalculating ? '重算中...' : '重算所有对账说明'}</span>
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center space-x-1">
            <PlusIcon className="w-4 h-4" />
            <span>补录尾差调整</span>
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card animate-slide-up border-l-4 border-l-indigo-500">
          <h3 className="font-serif-sc text-lg font-semibold text-gray-900 mb-4">新增尾差调整</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">关联对账记录</label>
              <select
                value={selectedRecordId}
                onChange={(e) => setSelectedRecordId(e.target.value)}
                className="input"
              >
                <option value="">请选择记录...</option>
                {state.records.map(record => (
                  <option key={record.id} value={record.id}>
                    {record.fundCode} / {record.futuresCode} — {record.tradeDate} — ¥{record.amount.toLocaleString()}
                    {record.hasManualModification ? ' [T+1→T+2]' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">调整金额</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input"
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <div>
              <label className="label">调整原因</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input"
                placeholder="如：银行手续费尾差调整"
              />
            </div>
          </div>
          <div className="mt-4 flex space-x-3">
            <button onClick={handleCreateAdjustment} disabled={submitting} className="btn-primary">
              {submitting ? '提交中...' : '提交调整'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">取消</button>
          </div>

          {selectedRecordId && (
            <div className="mt-4 bg-amber-50 border border-amber-200 p-3 rounded">
              <div className="text-xs font-medium text-amber-800 mb-1">关联记录对账说明将自动更新</div>
              {(() => {
                const rec = getRecordInfo(selectedRecordId);
                if (!rec) return null;
                return (
                  <div className="text-sm text-amber-700">
                    <div>当前对账说明: {rec.whyKept}</div>
                    <div className="mt-1 text-amber-600">补录尾差调整后，对账说明会自动增加"已补录尾差调整条"说明</div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3 className="font-serif-sc text-lg font-semibold text-gray-900 mb-4">尾差调整列表</h3>
        {state.adjustments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AdjustmentsHorizontalIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>暂无尾差调整记录</p>
            <p className="text-sm mt-1">点击"补录尾差调整"开始添加</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">关联记录</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">调整金额</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">调整原因</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">操作人</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">操作时间</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">影响对账说明</th>
                </tr>
              </thead>
              <tbody>
                {state.adjustments.map((adj) => {
                  const rec = getRecordInfo(adj.recordId);
                  return (
                    <tr key={adj.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        {rec ? (
                          <a href={`/record/${adj.recordId}`} className="text-finance-600 hover:underline flex items-center space-x-1">
                            <LinkIcon className="w-3 h-3" />
                            <span>{rec.fundCode} / {rec.futuresCode}</span>
                          </a>
                        ) : (
                          <span className="text-gray-400">{adj.recordId.slice(0, 8)}...</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-indigo-700">
                        ¥{adj.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-gray-700">{adj.reason}</td>
                      <td className="py-3 px-4 text-gray-600">{adj.adjustedBy}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{adj.adjustedAt}</td>
                      <td className="py-3 px-4">
                        {adj.affectsReconciliation ? (
                          <span className="badge bg-green-100 text-green-800">已自动更新</span>
                        ) : (
                          <span className="badge bg-gray-100 text-gray-600">不影响</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
