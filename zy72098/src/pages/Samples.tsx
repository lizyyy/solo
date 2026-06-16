import { useState, useRef } from 'react';
import {
  Database,
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
  Plus,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  AlertOctagon,
  History,
  Upload,
  FileJson,
  X,
  Download,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import type { CalculationRecord, SampleStatus } from '@/types';

export function Samples() {
  const {
    getCurrentSamples,
    getCurrentRecords,
    getRecordRemarks,
    addRemark,
    importMaterialPackage,
    resetToDefaults,
  } = useAppStore();
  const samples = getCurrentSamples();
  const records = getCurrentRecords();
  const [expandedSample, setExpandedSample] = useState<string | null>(null);
  const [remarkInput, setRemarkInput] = useState<Record<string, string>>({});
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'normal':
        return { label: '正常', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle };
      case 'manual':
        return { label: '待确认', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle };
      case 'legacy':
        return { label: '旧口径', color: 'bg-slate-200 text-slate-700', icon: History };
      case 'abnormal':
        return { label: '异常', color: 'bg-red-100 text-red-700', icon: AlertOctagon };
      default:
        return { label: status, color: 'bg-slate-100 text-slate-700', icon: Clock };
    }
  };

  const getRecordForSample = (sampleId: string): CalculationRecord | undefined => {
    return records.find((r) => r.sampleId === sampleId);
  };

  const handleAddRemark = (sampleId: string) => {
    const record = getRecordForSample(sampleId);
    if (record && remarkInput[sampleId]?.trim()) {
      addRemark(record.id, remarkInput[sampleId], '调度主管-周姐');
      setRemarkInput((prev) => ({ ...prev, [sampleId]: '' }));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setImportText(text);
      setImportErrors([]);
      setImportWarnings([]);
      setImportSuccess(false);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!importText.trim()) {
      setImportErrors(['请粘贴JSON内容或选择文件']);
      return;
    }

    const { result, errors, warnings } = importMaterialPackage(importText);
    setImportErrors(errors);
    setImportWarnings(warnings);

    if (result) {
      setImportSuccess(true);
      setShowImport(false);
      setImportText('');
      setTimeout(() => setImportSuccess(false), 5000);
    }
  };

  const loadSamplePackage = () => {
    fetch('/sample-material-package.json')
      .then((res) => res.text())
      .then((text) => {
        setImportText(text);
        setImportErrors([]);
        setImportWarnings([]);
      })
      .catch(() => {
        setImportErrors(['加载样例材料包失败，请手动粘贴']);
      });
  };

  const handleReset = () => {
    if (window.confirm('确定要恢复到默认数据吗？所有导入和备注都会清空。')) {
      resetToDefaults();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">样本管理</h1>
          <p className="text-slate-500 mt-1">管理和查看图神经网络社区解释样本</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImport(!showImport)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            导入材料包
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <XCircle className="w-4 h-4" />
            恢复默认
          </button>
        </div>
      </div>

      {importSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <p className="text-emerald-700">材料包导入成功！已切换到新批次。</p>
        </div>
      )}

      {showImport && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-cyan-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
                <FileJson className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">导入材料包</h3>
                <p className="text-sm text-slate-500">支持JSON格式，包含参数表、历史记录、人工备注、异常样本</p>
              </div>
            </div>
            <button
              onClick={() => setShowImport(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-3 mb-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl hover:border-cyan-300 hover:bg-cyan-50 transition-colors"
            >
              <Upload className="w-5 h-5 text-slate-400" />
              <span className="text-slate-600">选择JSON文件</span>
            </button>
            <button
              onClick={loadSamplePackage}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-cyan-200 bg-cyan-50 rounded-xl hover:bg-cyan-100 transition-colors"
            >
              <Download className="w-5 h-5 text-cyan-600" />
              <span className="text-cyan-700">加载样例材料包</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              或粘贴JSON内容
            </label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{"batchName":"测试批次","samples":[{"id":"s1","name":"样本1","nodeCount":10,"edgeCount":20}]}'
              className="w-full h-48 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-mono text-sm resize-none"
            />
          </div>

          {importErrors.length > 0 && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="font-medium text-red-800 mb-2">导入错误：</p>
              <ul className="text-sm text-red-700 space-y-1">
                {importErrors.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            </div>
          )}

          {importWarnings.length > 0 && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="font-medium text-amber-800 mb-2">注意事项：</p>
              <ul className="text-sm text-amber-700 space-y-1">
                {importWarnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowImport(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleImport}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              确认导入
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <span className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm">
          <CheckCircle className="w-4 h-4" />
          正常: {samples.filter((s) => s.status === ('normal' as SampleStatus)).length}
        </span>
        <span className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4" />
          待确认: {samples.filter((s) => s.status === ('manual' as SampleStatus)).length}
        </span>
        <span className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">
          <History className="w-4 h-4" />
          旧口径: {samples.filter((s) => s.status === ('legacy' as SampleStatus)).length}
        </span>
        <span className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm">
          <XCircle className="w-4 h-4" />
          异常: {samples.filter((s) => s.status === ('abnormal' as SampleStatus)).length}
        </span>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
            <Database className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">样本列表</h3>
            <p className="text-sm text-slate-500">点击展开查看详细信息和添加备注</p>
          </div>
        </div>

        <div className="space-y-4">
          {samples.map((sample) => {
            const statusInfo = getStatusInfo(sample.status);
            const StatusIcon = statusInfo.icon;
            const isExpanded = expandedSample === sample.id;
            const record = getRecordForSample(sample.id);
            const sampleRemarks = record ? getRecordRemarks(record.id) : [];

            return (
              <div
                key={sample.id}
                className={`rounded-xl border transition-all ${
                  sample.isOutOfBounds ? 'border-red-200' : 'border-slate-200'
                }`}
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedSample(isExpanded ? null : sample.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${statusInfo.color
                        .replace('text-', 'bg-')
                        .split(' ')[0]}`}
                    >
                      <StatusIcon className={`w-5 h-5 ${statusInfo.color.split(' ')[1]}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{sample.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        {sample.isOutOfBounds && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            越界
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{sample.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-slate-500">数值</p>
                      <p className="font-bold text-slate-800">
                        {sample.value} {sample.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">预期范围</p>
                      <p className="font-medium text-slate-600">
                        [{sample.expectedRange.min}, {sample.expectedRange.max}]
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100">
                    <div className="pt-4 grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-slate-700 mb-2">样本信息</h4>
                          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-slate-500">样本ID</span>
                              <span className="text-sm font-medium text-slate-700">{sample.id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-slate-500">数值</span>
                              <span className="text-sm font-medium text-slate-700">
                                {sample.value} {sample.unit}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-slate-500">预期范围</span>
                              <span className="text-sm font-medium text-slate-700">
                                [{sample.expectedRange.min}, {sample.expectedRange.max}]
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-slate-500">是否越界</span>
                              <span
                                className={`text-sm font-medium ${
                                  sample.isOutOfBounds ? 'text-red-600' : 'text-emerald-600'
                                }`}
                              >
                                {sample.isOutOfBounds ? '是' : '否'}
                              </span>
                            </div>
                            {sample.legacySource && (
                              <div className="flex justify-between">
                                <span className="text-sm text-slate-500">历史来源</span>
                                <span className="text-sm font-medium text-slate-700">
                                  {sample.legacySource}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {record && (
                          <div>
                            <h4 className="font-medium text-slate-700 mb-2">计算结果</h4>
                            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                              <div className="flex justify-between">
                                <span className="text-sm text-slate-500">模块度</span>
                                <span className="text-sm font-medium text-slate-700">
                                  {record.outputData.modularity}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-slate-500">社区数量</span>
                                <span className="text-sm font-medium text-slate-700">
                                  {record.outputData.communityCount}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-slate-500">稳定性</span>
                                <span className="text-sm font-medium text-slate-700">
                                  {record.outputData.stability}
                                </span>
                              </div>
                              {record.processingAdvice && (
                                <div className="pt-2 border-t border-slate-200">
                                  <p className="text-sm text-cyan-700">{record.processingAdvice}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-slate-700 mb-2">补录备注</h4>
                          <div className="flex gap-2 mb-4">
                            <input
                              type="text"
                              value={remarkInput[sample.id] || ''}
                              onChange={(e) =>
                                setRemarkInput((prev) => ({ ...prev, [sample.id]: e.target.value }))
                              }
                              placeholder="添加备注..."
                              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddRemark(sample.id);
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                              添加
                            </button>
                          </div>

                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {sample.remark && (
                              <div className="bg-slate-100 rounded-lg p-3">
                                <p className="text-sm text-slate-700">{sample.remark}</p>
                                <p className="text-xs text-slate-500 mt-1">系统备注</p>
                              </div>
                            )}
                            {sampleRemarks.map((remark) => (
                              <div
                                key={remark.id}
                                className="bg-amber-50 border border-amber-200 rounded-lg p-3"
                              >
                                <p className="text-sm text-amber-800">{remark.content}</p>
                                <div className="flex justify-between mt-1">
                                  <span className="text-xs text-amber-600">{remark.addedBy}</span>
                                  <span className="text-xs text-amber-500">
                                    {new Date(remark.addedAt).toLocaleString('zh-CN')}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {!sample.remark && sampleRemarks.length === 0 && (
                              <div className="text-center py-4 text-slate-400">
                                <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                                <p className="text-sm">暂无备注</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-8 h-8 text-amber-600 flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-bold text-amber-800 mb-2">周姐提醒</h4>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• 所有异常样本均已保留，未自动过滤</li>
              <li>• 计算不出来的记录请在备注中说明原因</li>
              <li>• 补录备注后差异会在交接报告中高亮显示</li>
              <li>• 图神经网络社区解释算法参与了所有判断</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
