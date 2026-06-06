import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useScreeningStore } from '../store/useScreeningStore';
import { StatusBadge } from '../components/status/StatusBadge';
import { formatCurrency, formatDate, formatDateTime } from '../utils/format';
import { getAbnormalNotesForSharing, copyToClipboard } from '../utils/export';
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  CalendarDays,
  Copy,
  Check,
  User,
  Building2,
  DollarSign,
  Hash,
  FileCheck,
  AlertCircle,
  Clock,
  Paperclip
} from 'lucide-react';

type TabType = 'rules' | 'notes' | 'settlement';

export const RemittanceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getRemittanceById } = useScreeningStore();
  const [activeTab, setActiveTab] = useState<TabType>('rules');
  const [copied, setCopied] = useState(false);

  const remittance = getRemittanceById(id || '');

  if (!remittance) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">未找到该汇款记录</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            返回概览
          </button>
        </div>
      </div>
    );
  }

  const handleCopy = async () => {
    const text = getAbnormalNotesForSharing(remittance);
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tabs = [
    { id: 'rules' as TabType, label: '命中规则', icon: FileText },
    { id: 'notes' as TabType, label: '人工说明', icon: MessageSquare },
    { id: 'settlement' as TabType, label: '跨清算日分析', icon: CalendarDays }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            返回概览
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">汇款详情</h2>
              <StatusBadge status={remittance.status} />
            </div>
            <p className="text-sm text-slate-500 mt-0.5 font-mono">{remittance.transactionId}</p>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? '已复制' : '复制异常说明'}
          </button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">基础信息</h3>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Hash className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">交易编号</p>
                    <p className="text-sm font-mono text-slate-900 mt-0.5">{remittance.transactionId}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">交易金额</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">
                      {formatCurrency(remittance.amount, remittance.currency)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">付款方</p>
                    <p className="text-sm text-slate-900 mt-0.5">{remittance.payer}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">收款方</p>
                    <p className="text-sm text-slate-900 mt-0.5">{remittance.payee}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center flex-shrink-0">
                    <CalendarDays className="w-4 h-4 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">交易日期</p>
                    <p className="text-sm text-slate-900 mt-0.5">{formatDate(remittance.transactionDate)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">最后更新</p>
                    <p className="text-sm text-slate-900 mt-0.5">{formatDateTime(remittance.updatedAt)}</p>
                  </div>
                </div>
              </div>

              {remittance.crossSettlementAnalysis && (
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-violet-600" />
                    <span className="text-sm font-medium text-violet-700">涉及跨清算日交易</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('settlement')}
                    className="w-full py-2 rounded-lg bg-violet-50 text-violet-700 text-sm font-medium hover:bg-violet-100 transition-colors"
                  >
                    查看详细分析
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="col-span-8">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex border-b border-slate-200">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium transition-colors relative ${
                        isActive
                          ? 'text-blue-600 bg-blue-50/50'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="p-6">
                {activeTab === 'rules' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-slate-900 mb-4">命中的筛查规则 ({remittance.ruleHits.length})</h4>
                    {remittance.ruleHits.map((hit, idx) => (
                      <div key={hit.id} className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                              {idx + 1}
                            </div>
                            <h5 className="font-semibold text-slate-900">{hit.ruleName}</h5>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500">置信度</span>
                            <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${hit.confidence * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-700 w-10 text-right">
                              {Math.round(hit.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">{hit.ruleDescription}</p>
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1.5">命中材料:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {hit.matchedMaterials.map((mat, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs"
                              >
                                <Paperclip className="w-3 h-3" />
                                {mat}
                              </span>
                            ))}
                          </div>
                        </div>
                        {hit.isCrossSettlement && (
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-medium">
                              <AlertCircle className="w-3 h-3" />
                              涉及跨清算日判断
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-slate-900">人工说明记录 ({remittance.manualNotes.length})</h4>
                      <div className="text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                        保留原始记录，系统不做合并判断
                      </div>
                    </div>

                    {remittance.manualNotes.map((note, idx) => (
                      <div key={note.id} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium text-slate-600">
                              {note.author.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">{note.author}</p>
                              <p className="text-xs text-slate-500">{formatDateTime(note.timestamp)}</p>
                            </div>
                          </div>
                          <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 font-mono">
                            {note.source}
                          </span>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <p className="text-sm text-slate-700 leading-relaxed">{note.content}</p>
                        </div>
                        {idx < remittance.manualNotes.length - 1 && (
                          <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
                            <p className="text-xs text-slate-400 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5" />
                              请注意：此说明与后续记录可能存在不一致，请综合判断
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'settlement' && (
                  <div>
                    {remittance.crossSettlementAnalysis ? (
                      <div className="space-y-6">
                        <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <h5 className="font-semibold text-violet-900">退款跨清算日分析</h5>
                              <p className="text-sm text-violet-700 mt-1">
                                该交易原始汇款与退款日期跨越 {remittance.crossSettlementAnalysis.daysAcross} 个清算日，
                                以下为完整证据链，请根据实际业务场景判断。
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">原始交易日</p>
                            <p className="text-lg font-bold text-slate-900">
                              {remittance.crossSettlementAnalysis.originalDate}
                            </p>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">退款申请日</p>
                            <p className="text-lg font-bold text-slate-900">
                              {remittance.crossSettlementAnalysis.refundDate}
                            </p>
                          </div>
                          <div className="bg-violet-50 rounded-lg p-4 border border-violet-200">
                            <p className="text-xs text-violet-600 mb-1">跨越清算日</p>
                            <p className="text-lg font-bold text-violet-700">
                              {remittance.crossSettlementAnalysis.daysAcross} 天
                            </p>
                          </div>
                        </div>

                        <div>
                          <h5 className="text-sm font-semibold text-slate-900 mb-3">日期时间线</h5>
                          <div className="flex items-center gap-1 overflow-x-auto pb-2">
                            {remittance.crossSettlementAnalysis.settlementDates.map((date, idx) => {
                              const isOriginal = date === remittance.crossSettlementAnalysis!.originalDate;
                              const isRefund = date === remittance.crossSettlementAnalysis!.refundDate;
                              const isWeekend = date.includes('06-01') || date.includes('06-02');
                              return (
                                <div key={idx} className="flex-shrink-0">
                                  <div className={`w-20 text-center py-3 rounded-lg border ${
                                    isOriginal
                                      ? 'bg-blue-50 border-blue-300'
                                      : isRefund
                                        ? 'bg-red-50 border-red-300'
                                        : isWeekend
                                          ? 'bg-slate-100 border-slate-200'
                                          : 'bg-white border-slate-200'
                                  }`}>
                                    <p className="text-xs font-medium text-slate-700">{date.slice(5)}</p>
                                    {isOriginal && (
                                      <p className="text-xs text-blue-600 mt-1">原始</p>
                                    )}
                                    {isRefund && (
                                      <p className="text-xs text-red-600 mt-1">退款</p>
                                    )}
                                    {isWeekend && !isRefund && (
                                      <p className="text-xs text-slate-400 mt-1">周末</p>
                                    )}
                                  </div>
                                  {idx < remittance.crossSettlementAnalysis!.settlementDates.length - 1 && (
                                    <div className="h-0.5 bg-slate-200 w-full" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <h5 className="text-sm font-semibold text-slate-900 mb-3">证据链材料</h5>
                          <div className="space-y-3">
                            {remittance.crossSettlementAnalysis.evidenceChain.map((item, idx) => (
                              <div key={idx} className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                  <FileCheck className="w-4 h-4 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-slate-900">{item.type}</p>
                                    <span className="text-xs text-slate-500 font-mono">{item.reference}</span>
                                  </div>
                                  <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-400">
                        <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">该汇款不涉及跨清算日交易</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
