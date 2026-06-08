import { useState } from 'react';
import {
  Calculator,
  CheckCircle,
  AlertTriangle,
  Clock,
  ChevronRight,
  Code,
  AlertCircle,
  CheckSquare,
  XCircle,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import type { CalculationRecord } from '@/types';

export function Calculation() {
  const { getCurrentRecords, getRecordRemarks, selectedRecordId, selectRecord } = useAppStore();
  const records = getCurrentRecords();
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(
    selectedRecordId || records[0]?.id || null
  );

  const activeId = selectedRecordId || localSelectedId;
  const selectedRecord = records.find((r) => r.id === activeId) || records[0] || null;

  const handleSelect = (record: CalculationRecord) => {
    selectRecord(record.id);
    setLocalSelectedId(record.id);
  };

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'success':
        return { label: '顺利', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle };
      case 'pending':
        return { label: '待确认', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle };
      case 'legacy':
        return { label: '旧口径', color: 'bg-slate-200 text-slate-700', icon: Clock };
      default:
        return { label: type, color: 'bg-slate-100 text-slate-700', icon: Clock };
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">计算流程</h1>
        <p className="text-slate-500 mt-1">查看图神经网络社区解释算法计算过程</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-cyan-600" />
              计算记录列表
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {records.map((record) => {
                const typeInfo = getTypeInfo(record.type);
                const TypeIcon = typeInfo.icon;
                return (
                  <div
                    key={record.id}
                    onClick={() => handleSelect(record)}
                    className={`p-3 rounded-xl cursor-pointer transition-all ${
                      selectedRecord?.id === record.id
                        ? 'bg-cyan-50 border-2 border-cyan-300'
                        : 'bg-slate-50 border border-transparent hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-slate-700 truncate flex-1">
                        {record.sampleName}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${typeInfo.color}`}>
                        <TypeIcon className="w-3 h-3" />
                        {typeInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>模块度: {record.outputData.modularity}</span>
                      <span>{record.steps.length} 步</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="col-span-2 space-y-4">
          {selectedRecord ? (
            <>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{selectedRecord.sampleName}</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      计算时间：{new Date(selectedRecord.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                      getTypeInfo(selectedRecord.type).color
                    }`}
                  >
                    {(() => {
                      const Icon = getTypeInfo(selectedRecord.type).icon;
                      return <Icon className="w-4 h-4" />;
                    })()}
                    <span className="text-sm font-medium">
                      {getTypeInfo(selectedRecord.type).label}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-1">模块度</p>
                    <p className="text-2xl font-bold text-slate-800">{selectedRecord.outputData.modularity}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-1">社区数量</p>
                    <p className="text-2xl font-bold text-slate-800">{selectedRecord.outputData.communityCount}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-1">稳定性</p>
                    <p className="text-2xl font-bold text-slate-800">{selectedRecord.outputData.stability}</p>
                  </div>
                </div>

                {!selectedRecord.unitCheck.passed && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 mb-1">单位校验问题</p>
                        <ul className="text-sm text-amber-700 space-y-1">
                          {selectedRecord.unitCheck.issues.map((issue, i) => (
                            <li key={i}>• {issue}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {selectedRecord.errorReason && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800 mb-1">异常原因</p>
                        <p className="text-sm text-red-700">{selectedRecord.errorReason}</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedRecord.processingAdvice && (
                  <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <CheckSquare className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-cyan-800 mb-1">处理建议</p>
                        <p className="text-sm text-cyan-700">{selectedRecord.processingAdvice}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Code className="w-5 h-5 text-blue-600" />
                  计算步骤详情
                </h3>

                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200"></div>

                  <div className="space-y-6">
                    {selectedRecord.steps.map((step, index) => (
                      <div key={step.step} className="relative flex gap-6">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center z-10 ${
                            step.remark?.includes('❌')
                              ? 'bg-red-100'
                              : step.remark?.includes('⚠️')
                              ? 'bg-amber-100'
                              : 'bg-cyan-100'
                          }`}
                        >
                          <span className="font-bold text-slate-700">{step.step}</span>
                        </div>

                        <div className="flex-1 pb-6">
                          <div className="flex items-center gap-3 mb-3">
                            <h4 className="font-bold text-slate-800">{step.name}</h4>
                            {index < selectedRecord.steps.length - 1 && (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                          </div>

                          <div className="bg-slate-900 rounded-xl p-4 mb-3 font-mono text-sm">
                            <code className="text-cyan-400">{step.formula}</code>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div className="bg-slate-50 rounded-lg p-3">
                              <p className="text-xs text-slate-500 mb-1">输入参数</p>
                              <div className="space-y-1">
                                {Object.entries(step.input).map(([key, value]) => (
                                  <div key={key} className="flex justify-between text-sm">
                                    <span className="text-slate-600">{key}</span>
                                    <span className="font-medium text-slate-800">{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="bg-emerald-50 rounded-lg p-3">
                              <p className="text-xs text-slate-500 mb-1">输出结果</p>
                              <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-emerald-700">{step.output}</span>
                                <span className="text-sm text-emerald-600">{step.unit}</span>
                              </div>
                            </div>
                          </div>

                          {step.remark && (
                            <div
                              className={`text-sm p-3 rounded-lg ${
                                step.remark.includes('图神经网络社区解释算法参与判断')
                                  ? 'bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-700 border border-cyan-200'
                                  : step.remark.includes('❌')
                                  ? 'bg-red-50 text-red-700'
                                  : step.remark.includes('⚠️')
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-slate-50 text-slate-600'
                              }`}
                            >
                              {step.remark}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {getRecordRemarks(selectedRecord.id).length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-4">补录备注</h3>
                  <div className="space-y-3">
                    {getRecordRemarks(selectedRecord.id).map((remark) => (
                      <div key={remark.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-amber-800">{remark.addedBy}</span>
                          <span className="text-xs text-amber-600">
                            {new Date(remark.addedAt).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        <p className="text-amber-700">{remark.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-100 text-center">
              <Calculator className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">请从左侧选择一条记录查看计算详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
