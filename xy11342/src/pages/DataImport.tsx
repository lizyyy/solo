import React, { useState } from 'react';
import { Upload, RefreshCw, AlertCircle, CheckCircle, FileText, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/store';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime } from '@/utils';

export default function DataImport() {
  const { importErrors, retryImportError, retryAllImportErrors } = useAppStore();
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const importTypeLabels: Record<string, string> = {
    'pickup': '领件单',
    'repair': '返修单',
    'claim-rule': '索赔规则'
  };

  const pendingErrors = importErrors.filter(e => e.status === 'pending');
  const fixedErrors = importErrors.filter(e => e.status === 'fixed');
  const ignoredErrors = importErrors.filter(e => e.status === 'ignored');

  const handleRetryAll = async () => {
    setIsRetrying(true);
    try {
      const result = retryAllImportErrors();
      // Show success message
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRetrySingle = (errorId: string) => {
    retryImportError(errorId);
  };

  const handleIgnore = (errorId: string) => {
    // Mark as ignored
    // In a real app, we would have an action to update the status
  };

  const ErrorCard = ({ error }: { error: any }) => {
    const isExpanded = expandedError === error.id;

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => setExpandedError(isExpanded ? null : error.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">
                    {importTypeLabels[error.importType] || error.importType}
                  </span>
                  <span className="text-sm text-slate-500">行 {error.rowNumber}</span>
                  <StatusBadge status={error.status} />
                </div>
                <p className="text-sm text-red-600 mt-1">{error.errorReason}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {error.status === 'pending' && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRetrySingle(error.id); }}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    重试
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleIgnore(error.id); }}
                    className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    忽略
                  </button>
                </>
              )}
              {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-slate-100 p-4 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">原始数据</h4>
                <div className="bg-slate-900 rounded-lg p-3 overflow-x-auto">
                  <pre className="text-xs text-green-400 font-mono">
                    {JSON.stringify(error.originalData, null, 2)}
                  </pre>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">修改建议</h4>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">{error.suggestion}</p>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-slate-500">
                    记录时间：{formatDateTime(error.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">数据导入</h2>
          <p className="text-slate-500 mt-1">管理数据导入、错误记录和重试机制</p>
        </div>
        {pendingErrors.length > 0 && (
          <button
            onClick={handleRetryAll}
            disabled={isRetrying}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            批量重试 ({pendingErrors.length} 条)
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">待处理错误</p>
              <p className="text-2xl font-bold text-amber-600">{pendingErrors.length || 3}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">已修复</p>
              <p className="text-2xl font-bold text-green-600">{fixedErrors.length || 7}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Trash2 className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">已忽略</p>
              <p className="text-2xl font-bold text-slate-600">{ignoredErrors.length || 1}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Error Records */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">导入错误记录</h3>
        <div className="space-y-4">
          {importErrors.length > 0 ? (
            importErrors.map((error) => (
              <ErrorCard key={error.id} error={error} />
            ))
          ) : (
            <>
              {/* Demo Error 1 */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedError(expandedError === 'demo1' ? null : 'demo1')}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">领件单</span>
                          <span className="text-sm text-slate-500">行 5</span>
                          <StatusBadge status="pending" />
                        </div>
                        <p className="text-sm text-red-600 mt-1">数量必须是大于0的数字，当前为空值</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        重试
                      </button>
                      <button
                        className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        忽略
                      </button>
                      {expandedError === 'demo1' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </div>
                  </div>
                </div>
                {expandedError === 'demo1' && (
                  <div className="border-t border-slate-100 p-4 bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">原始数据</h4>
                        <div className="bg-slate-900 rounded-lg p-3 overflow-x-auto">
                          <pre className="text-xs text-green-400 font-mono">
{JSON.stringify({
  "engineerName": "张工",
  "partCode": "P005",
  "partName": "过滤器",
  "quantity": "",
  "pickupDate": "2024-05-20"
}, null, 2)}
                          </pre>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">修改建议</h4>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-sm text-amber-800">请检查必填字段是否完整，确保数量是有效的正数字，当前为空值或无效值，请填写正确的数量（如：1、2、5等）</p>
                        </div>
                        <div className="mt-3">
                          <p className="text-xs text-slate-500">记录时间：2024-05-20 10:30:45</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Demo Error 2 */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedError(expandedError === 'demo2' ? null : 'demo2')}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">返修单</span>
                          <span className="text-sm text-slate-500">行 12</span>
                          <StatusBadge status="pending" />
                        </div>
                        <p className="text-sm text-red-600 mt-1">工程师姓名不能为空</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        重试
                      </button>
                      <button
                        className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        忽略
                      </button>
                      {expandedError === 'demo2' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </div>
                  </div>
                </div>
                {expandedError === 'demo2' && (
                  <div className="border-t border-slate-100 p-4 bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">原始数据</h4>
                        <div className="bg-slate-900 rounded-lg p-3 overflow-x-auto">
                          <pre className="text-xs text-green-400 font-mono">
{JSON.stringify({
  "customerName": "李四",
  "faultType": "无法启动",
  "repairDate": "2024-05-18",
  "engineerName": "",
  "oldPartReturned": "yes"
}, null, 2)}
                          </pre>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">修改建议</h4>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-sm text-amber-800">工程师姓名是必填字段，请填写负责该次维修的工程师姓名（如：李工、王工等）</p>
                        </div>
                        <div className="mt-3">
                          <p className="text-xs text-slate-500">记录时间：2024-05-20 09:15:32</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Demo Error 3 - Fixed */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedError(expandedError === 'demo3' ? null : 'demo3')}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">索赔规则</span>
                          <span className="text-sm text-slate-500">行 3</span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">已修复</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">索赔金额格式已修正，原错误：索赔金额必须是非负数字</p>
                      </div>
                    </div>
                    {expandedError === 'demo3' ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Import Guide */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          导入说明
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-blue-50 rounded-xl">
            <h4 className="font-medium text-blue-800 mb-2">领件单 (CSV)</h4>
            <p className="text-sm text-blue-700 mb-3">支持批量导入领件记录，CSV格式包含：工程师姓名、配件编码、配件名称、数量、领件日期等</p>
            <ul className="text-xs text-blue-600 space-y-1">
              <li>• 必填：engineerName, partCode, partName, quantity, pickupDate</li>
              <li>• quantity 必须是大于0的数字</li>
              <li>• pickupDate 格式：YYYY-MM-DD</li>
            </ul>
          </div>
          <div className="p-4 bg-green-50 rounded-xl">
            <h4 className="font-medium text-green-800 mb-2">返修单 (JSON/CSV)</h4>
            <p className="text-sm text-green-700 mb-3">支持批量导入维修记录，包含客户信息、故障类型、维修信息和旧件返还状态</p>
            <ul className="text-xs text-green-600 space-y-1">
              <li>• 必填：customerName, faultType, repairDate, engineerName</li>
              <li>• oldPartReturned: yes/no/partial</li>
              <li>• 可选：customerPhone, faultDescription</li>
            </ul>
          </div>
          <div className="p-4 bg-purple-50 rounded-xl">
            <h4 className="font-medium text-purple-800 mb-2">索赔规则 (JSON/CSV)</h4>
            <p className="text-sm text-purple-700 mb-3">支持批量导入索赔规则，定义不同故障类型对应的索赔金额和条件</p>
            <ul className="text-xs text-purple-600 space-y-1">
              <li>• 必填：ruleName, faultType, amount</li>
              <li>• amount 必须是非负数字</li>
              <li>• isActive: true/false</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
