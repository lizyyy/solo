import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { CheckSquare, Copy, FileText, RefreshCw, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

export const SelfCheckCenter: React.FC = () => {
  const { selfCheckResult, loading, error, runSelfCheck, resolveOpinionMissing } = useAppStore();
  const [expandedSection, setExpandedSection] = useState<string | null>('missingOpinion');
  const [editingRecord, setEditingRecord] = useState<string | null>(null);
  const [opinionText, setOpinionText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    runSelfCheck();
  }, [runSelfCheck]);

  const handleRunCheck = () => {
    runSelfCheck();
    setMessage('自检完成');
    setTimeout(() => setMessage(null), 3000);
  };

  const handleResolveOpinion = async (recordId: string) => {
    if (!opinionText.trim()) {
      setMessage('请输入居民意见原文');
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    const success = await resolveOpinionMissing(recordId, opinionText);
    if (success) {
      setMessage('意见原文补全成功');
      setEditingRecord(null);
      setOpinionText('');
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const checkItems = [
    {
      key: 'duplicateImports',
      title: '重复导入检测',
      description: '检查是否有重复导入的记录',
      count: selfCheckResult?.duplicateImports.length || 0,
      icon: Copy,
      color: 'orange',
    },
    {
      key: 'missingOpinion',
      title: '居民意见完整性',
      description: '检查是否只有汇总没有原文的记录',
      count: selfCheckResult?.missingOpinionOriginal.length || 0,
      icon: FileText,
      color: 'red',
    },
    {
      key: 'recalculation',
      title: '补录后重算',
      description: '检查是否有需要重新计算的记录',
      count: selfCheckResult?.recalculationNeeded.length || 0,
      icon: RefreshCw,
      color: 'blue',
    },
    {
      key: 'exportConsistency',
      title: '导出一致性',
      description: '验证页面展示、接口返回、导出数据是否一致',
      count: selfCheckResult?.exportConsistency.isConsistent ? 0 : (selfCheckResult?.exportConsistency.mismatches.length || 0),
      icon: CheckSquare,
      color: selfCheckResult?.exportConsistency.isConsistent ? 'emerald' : 'red',
    },
  ];

  const colorClasses: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    orange: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-700',
      icon: 'text-orange-500',
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      icon: 'text-red-500',
    },
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
      icon: 'text-blue-500',
    },
    emerald: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      icon: 'text-emerald-500',
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-800">自检中心</h3>
          <p className="text-sm text-slate-500 mt-1">
            四项核心自检，确保数据准确、一致、可追溯
          </p>
        </div>
        <button
          onClick={handleRunCheck}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          立即自检
        </button>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {checkItems.map((item) => {
          const colors = colorClasses[item.color];
          return (
            <div
              key={item.key}
              className={`${colors.bg} ${colors.border} border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md`}
              onClick={() => setExpandedSection(expandedSection === item.key ? null : item.key)}
            >
              <div className="flex items-start justify-between">
                <div className={`${colors.icon}`}>
                  <item.icon className="w-8 h-8" />
                </div>
                <div className={`text-3xl font-bold ${colors.text}`}>
                  {item.count}
                </div>
              </div>
              <h4 className={`font-medium ${colors.text} mt-3`}>{item.title}</h4>
              <p className="text-xs text-slate-500 mt-1">{item.description}</p>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        {expandedSection === 'missingOpinion' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {expandedSection === 'missingOpinion' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <h4 className="font-medium text-slate-700">居民意见缺少原文的记录</h4>
                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                  {selfCheckResult?.missingOpinionOriginal.length || 0} 条
                </span>
              </div>
              <p className="text-xs text-slate-500">
                这些记录只有居民意见汇总，没有原文，请社区书记复核补全
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {selfCheckResult?.missingOpinionOriginal.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <CheckSquare className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                  <p>所有记录都有完整的居民意见原文</p>
                </div>
              ) : (
                selfCheckResult?.missingOpinionOriginal.map((record) => (
                  <div key={record.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-slate-800">{record.location}</span>
                          <StatusBadge status={record.status} />
                        </div>
                        <p className="text-sm text-slate-600">
                          <span className="text-slate-500">意见汇总：</span>
                          {record.residentOpinionSummary}
                        </p>
                        <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          缺少居民意见原文，请复核后补全
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setEditingRecord(editingRecord === record.id ? null : record.id);
                          setOpinionText('');
                        }}
                        className="text-xs px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
                      >
                        补全原文
                      </button>
                    </div>
                    {editingRecord === record.id && (
                      <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <label className="text-sm font-medium text-slate-700 mb-2 block">
                          请输入居民意见原文
                        </label>
                        <textarea
                          value={opinionText}
                          onChange={(e) => setOpinionText(e.target.value)}
                          placeholder="输入居民的原始反馈内容..."
                          rows={3}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-3"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingRecord(null)}
                            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => handleResolveOpinion(record.id)}
                            className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors"
                          >
                            确认补全
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {expandedSection === 'duplicateImports' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              {expandedSection === 'duplicateImports' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <h4 className="font-medium text-slate-700">重复导入的记录</h4>
              <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                {selfCheckResult?.duplicateImports.length || 0} 条
              </span>
            </div>
            <div className="p-12 text-center text-slate-500">
              <CheckSquare className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p>暂无重复导入的记录</p>
            </div>
          </div>
        )}

        {expandedSection === 'recalculation' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              {expandedSection === 'recalculation' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <h4 className="font-medium text-slate-700">需要重算的记录</h4>
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                {selfCheckResult?.recalculationNeeded.length || 0} 条
              </span>
            </div>
            <div className="p-12 text-center text-slate-500">
              <CheckSquare className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p>所有记录数据同步，无需重算</p>
            </div>
          </div>
        )}

        {expandedSection === 'exportConsistency' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {expandedSection === 'exportConsistency' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <h4 className="font-medium text-slate-700">导出一致性检查</h4>
                {selfCheckResult?.exportConsistency.isConsistent ? (
                  <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
                    一致
                  </span>
                ) : (
                  <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                    {selfCheckResult?.exportConsistency.mismatches.length || 0} 处不一致
                  </span>
                )}
              </div>
            </div>
            {selfCheckResult?.exportConsistency.isConsistent ? (
              <div className="p-12 text-center text-slate-500">
                <CheckSquare className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p>页面展示、接口返回、导出数据三者完全一致</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {selfCheckResult?.exportConsistency.mismatches.map((m, idx) => (
                  <div key={idx} className="p-4">
                    <p className="text-sm text-slate-700">
                      记录ID：{m.recordId}，字段：{m.field}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      页面值：{JSON.stringify(m.pageValue)}，导出值：{JSON.stringify(m.exportValue)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
