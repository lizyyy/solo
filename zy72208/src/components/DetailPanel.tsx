import React, { useState } from 'react';
import { X, Clock, User, FileText, AlertTriangle, CheckCircle, Edit3, Save, Copy, Terminal } from 'lucide-react';
import type { SettlementDetail, OriginalSnapshot, AuditLog, CurrencyReviewDecision, DetailStatus } from '../../shared/types.js';
import { useSettlementStore } from '../store/useSettlementStore.js';

interface DetailPanelProps {
  detail: SettlementDetail & { snapshot?: OriginalSnapshot; auditLogs?: AuditLog[] };
  onClose: () => void;
}

const operationTypeLabels: Record<string, string> = {
  'CREATE': '创建',
  'UPDATE': '更新',
  'STATUS_CHANGE': '状态变更',
  'CURRENCY_REVIEW': '币种复核',
  'TAX_RATE_UPDATE': '税费率更新'
};

export const DetailPanel: React.FC<DetailPanelProps> = ({ detail, onClose }) => {
  const { updateDetail, currencyReview, currentUser, loading } = useSettlementStore();
  const [editTaxRate, setEditTaxRate] = useState(false);
  const [taxRateValue, setTaxRateValue] = useState(detail.taxRate?.toString() || '');
  const [taxRateRemark, setTaxRateRemark] = useState(detail.taxRateRemark || '');
  const [currencyDecision, setCurrencyDecision] = useState<CurrencyReviewDecision | ''>('');
  const [currencyRemark, setCurrencyRemark] = useState('');

  const handleSaveTaxRate = () => {
    if (taxRateValue) {
      updateDetail(detail.id, 'taxRate', parseFloat(taxRateValue), taxRateRemark);
      setEditTaxRate(false);
    }
  };

  const handleCurrencyReview = () => {
    if (currencyDecision) {
      currencyReview(detail.id, currencyDecision, currencyRemark);
      setCurrencyDecision('');
      setCurrencyRemark('');
    }
  };

  const rawContent = detail.snapshot?.rawContent ? JSON.parse(detail.snapshot.rawContent) : null;

  return (
    <div className="fixed inset-y-0 right-0 w-[600px] bg-white shadow-2xl border-l border-navy-200 z-50 flex flex-col animate-slide-in">
      <div className="flex items-center justify-between p-6 border-b border-navy-200 bg-navy-50">
        <div>
          <h3 className="font-display text-xl text-navy-800">明细详情</h3>
          <p className="text-sm text-navy-500 font-mono mt-1">
            原始行号 #{detail.originalLineNo} | {detail.policyNo}
          </p>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-navy-200 rounded transition-colors"
        >
          <X size={20} className="text-navy-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-navy-500 uppercase">保单号</label>
              <p className="font-mono text-lg text-navy-800">{detail.policyNo}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-navy-500 uppercase">产品名称</label>
              <p className="text-lg text-navy-800">{detail.productName}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-navy-500 uppercase">佣金金额</label>
              <p className="font-mono text-lg text-navy-800">{detail.commissionAmount.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-navy-500 uppercase">净佣金</label>
              <p className="font-mono text-lg font-semibold text-navy-800">
                {detail.netAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-navy-500 uppercase">阶梯等级</label>
              <p className="font-mono text-lg text-navy-800">Lv.{detail.tierLevel} ({(detail.tierRate * 100).toFixed(0)}%)</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-navy-500 uppercase">状态</label>
              <p className="text-lg text-navy-800">{detail.status}</p>
            </div>
          </div>

          <div className="p-4 bg-navy-50 rounded-lg border border-navy-200">
            <h4 className="font-semibold text-navy-800 mb-3 flex items-center gap-2">
              <FileText size={16} />
              币种信息
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-navy-600">原始内容:</span>
                <span className="font-mono text-sm bg-white px-2 py-1 rounded border border-navy-200">
                  {detail.currencyRaw}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-navy-600">检测币种:</span>
                <span className="font-mono text-sm bg-white px-2 py-1 rounded border border-navy-200">
                  {detail.currency}
                </span>
              </div>
              {detail.hasMixedCurrency && (
                <>
                  <div className="p-3 bg-audit-orange/10 border border-audit-orange/30 rounded">
                    <p className="text-sm text-audit-orange font-medium flex items-center gap-2">
                      <AlertTriangle size={16} />
                      检测到港币人民币同列，需托管对接人复核
                    </p>
                  </div>
                  {currentUser.role === 'risk_control' || currentUser.role === 'trustee' ? (
                    <div className="space-y-2">
                      <select
                        value={currencyDecision}
                        onChange={(e) => setCurrencyDecision(e.target.value as CurrencyReviewDecision)}
                        className="w-full p-2 border border-navy-300 rounded text-sm"
                      >
                        <option value="">选择复核操作</option>
                        <option value="MARK_EXCEPTION">标记异常</option>
                        <option value="SUBMIT_REVIEW">提交托管对接人复核</option>
                        <option value="REJECT">驳回（正常）</option>
                      </select>
                      <input
                        type="text"
                        placeholder="备注说明"
                        value={currencyRemark}
                        onChange={(e) => setCurrencyRemark(e.target.value)}
                        className="w-full p-2 border border-navy-300 rounded text-sm"
                      />
                      <button
                        onClick={handleCurrencyReview}
                        disabled={!currencyDecision || loading}
                        className="w-full py-2 bg-navy-800 text-white rounded text-sm hover:bg-navy-700 disabled:opacity-50"
                      >
                        提交复核
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="p-4 bg-navy-50 rounded-lg border border-navy-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-navy-800 flex items-center gap-2">
                <Terminal size={16} />
                税费率
              </h4>
              {(currentUser.role === 'risk_control') && (
                <button
                  onClick={() => setEditTaxRate(!editTaxRate)}
                  className="text-sm text-navy-600 hover:text-navy-800 flex items-center gap-1"
                >
                  <Edit3 size={14} />
                  {editTaxRate ? '取消' : '编辑'}
                </button>
              )}
            </div>
            {editTaxRate ? (
              <div className="space-y-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="税率（如 0.06 表示 6%）"
                  value={taxRateValue}
                  onChange={(e) => setTaxRateValue(e.target.value)}
                  className="w-full p-2 border border-navy-300 rounded text-sm font-mono"
                />
                <input
                  type="text"
                  placeholder="备注"
                  value={taxRateRemark}
                  onChange={(e) => setTaxRateRemark(e.target.value)}
                  className="w-full p-2 border border-navy-300 rounded text-sm"
                />
                <button
                  onClick={handleSaveTaxRate}
                  disabled={loading}
                  className="w-full py-2 bg-audit-green text-white rounded text-sm hover:bg-audit-green/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save size={14} />
                  保存并重算
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-navy-600">税费率:</span>
                  <span className="font-mono text-sm">
                    {detail.taxRate !== undefined ? `${(detail.taxRate * 100).toFixed(1)}%` : '待补录'}
                  </span>
                </div>
                {detail.taxRateRemark && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-navy-600">备注:</span>
                    <span className="text-sm text-navy-700">{detail.taxRateRemark}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {rawContent && (
            <div className="p-4 bg-navy-900 rounded-lg">
              <h4 className="font-semibold text-navy-100 mb-3 flex items-center gap-2">
                <FileText size={16} />
                原始行快照（不可修改）
              </h4>
              <pre className="text-xs text-navy-200 font-mono overflow-x-auto p-3 bg-navy-800 rounded">
                {JSON.stringify(rawContent, null, 2)}
              </pre>
              <div className="mt-2 flex items-center justify-between text-xs text-navy-400">
                <span>快照ID: {detail.originalSnapshotId.slice(0, 16)}...</span>
                <button 
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(rawContent, null, 2))}
                  className="flex items-center gap-1 hover:text-navy-200"
                >
                  <Copy size={12} />
                  复制
                </button>
              </div>
            </div>
          )}

          {detail.auditLogs && detail.auditLogs.length > 0 && (
            <div>
              <h4 className="font-semibold text-navy-800 mb-3 flex items-center gap-2">
                <Clock size={16} />
                审计追踪
              </h4>
              <div className="space-y-3">
                {detail.auditLogs.map((log, idx) => (
                  <div key={log.id} className="relative pl-6 pb-3 border-l-2 border-navy-200 last:border-l-0">
                    <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-navy-400 flex items-center justify-center">
                      {log.operationType === 'CREATE' ? (
                        <CheckCircle size={10} className="text-audit-green" />
                      ) : log.operationType === 'STATUS_CHANGE' || log.operationType === 'CURRENCY_REVIEW' ? (
                        <AlertTriangle size={10} className="text-audit-orange" />
                      ) : (
                        <Edit3 size={10} className="text-navy-600" />
                      )}
                    </div>
                    <div className="bg-navy-50 p-3 rounded">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-navy-700">
                          {operationTypeLabels[log.operationType] || log.operationType}
                        </span>
                        <span className="text-xs text-navy-400 font-mono">
                          {log.operatedAt.slice(5, 16)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-navy-500 mb-1">
                        <User size={12} />
                        {log.operator}
                      </div>
                      {log.fieldName && (
                        <div className="text-xs text-navy-600 space-y-1">
                          <p>字段: <span className="font-mono">{log.fieldName}</span></p>
                          {log.oldValue !== undefined && log.newValue !== undefined && (
                            <p className="font-mono">
                              <span className="text-audit-red line-through">{log.oldValue || '(空)'}</span>
                              {' → '}
                              <span className="text-audit-green">{log.newValue || '(空)'}</span>
                            </p>
                          )}
                        </div>
                      )}
                      {log.remark && (
                        <p className="text-xs text-navy-500 mt-1 italic">备注: {log.remark}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
