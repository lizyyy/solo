import { useAppContext } from '../../store/AppContext';
import { computeHistoryDiff, getStakeholderName } from '../../utils/dataUtils';
import { X, ArrowRight, Clock, User, FileEdit, AlertCircle } from 'lucide-react';

interface HistoryDiffModalProps {
  recordId: string;
  fromVersion: number;
  toVersion: number;
  onClose: () => void;
}

const fieldNameMap: { [key: string]: string } = {
  remark: '备注',
  denominator: '分母',
  denominatorDisplayEmpty: '分母显示为空',
  status: '状态',
  reviewStatus: '复核状态',
  assignedTo: '负责人',
  manualCounterexample: '手算反例',
  counterexampleProvider: '反例提供人',
  counterexampleTimestamp: '反例时间',
  numerator: '分子',
  edgeWeight: '边权重',
};

function getFieldDisplayValue(val: unknown, fieldName: string): string {
  if (val === null || val === undefined) return '（空）';
  if (typeof val === 'boolean') {
    if (fieldName === 'denominatorDisplayEmpty') return val ? '是（显示为空字符串）' : '否';
    return val ? '是' : '否';
  }
  if (typeof val === 'object') return JSON.stringify(val);
  if (fieldName === 'assignedTo') return getStakeholderName(val as any);
  if (fieldName === 'denominator') {
    if (val === 0 || val === '0') return '0（显示为空字符串）';
    return String(val);
  }
  if (fieldName === 'counterexampleTimestamp' && typeof val === 'number') {
    return new Date(val).toLocaleString();
  }
  if (typeof val === 'string' && val.length === 0) return '（空字符串）';
  return String(val);
}

export function HistoryDiffModal({ recordId, fromVersion, toVersion, onClose }: HistoryDiffModalProps) {
  const { state } = useAppContext();
  const record = state.parameterRecords.find(r => r.id === recordId);

  if (!record) return null;

  const diffs = computeHistoryDiff(record, fromVersion, toVersion);

  // 构建按版本分组的变更视图
  const versionsInRange: number[] = [];
  for (let v = fromVersion + 1; v <= toVersion; v++) versionsInRange.push(v);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileEdit className="w-5 h-5" />
              历史版本对比
            </h2>
            <p className="text-amber-100 text-sm mt-1">
              {record.sourceNode} → {record.targetNode}
              <span className="mx-2">·</span>
              版本 v{fromVersion} → v{toVersion}
              <span className="mx-2">·</span>
              共 {diffs.length} 处变更
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* 版本时间线 */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              版本历史时间线（含处理原因）
            </h3>
            <div className="space-y-0 relative">
              <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200" />
              {record.versions.map((version) => {
                const inRange = version.version >= fromVersion && version.version <= toVersion;
                const isTarget = version.version > fromVersion && version.version <= toVersion;
                return (
                  <div key={version.version} className="relative pl-12 py-3">
                    <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      isTarget
                        ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                        : inRange
                        ? 'bg-white text-amber-600 border-amber-300'
                        : 'bg-white text-slate-400 border-slate-300'
                    }`}>
                      {version.version}
                    </div>
                    <div className={`rounded-xl p-3 ${
                      isTarget ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-slate-200'
                    }`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800">v{version.version}</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              version.author === 'alan' ? 'bg-blue-100 text-blue-700'
                              : version.author === 'data_reviewer' ? 'bg-purple-100 text-purple-700'
                              : 'bg-slate-100 text-slate-700'
                            }`}>
                              {getStakeholderName(version.author as any)}
                            </span>
                            {isTarget && (
                              <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700 font-medium">
                                对比范围内
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-slate-700 mt-1.5">
                            <span className="text-slate-500 mr-2">处理原因：</span>
                            {version.changeDescription}
                          </p>
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(version.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {/* 展示本次变更的字段摘要 */}
                      {Object.keys(version.changes).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200/60">
                          <p className="text-xs text-slate-500 mb-1">本次涉及字段：</p>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.keys(version.changes).map(k => (
                              <span key={k} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-mono">
                                {fieldNameMap[k] || k}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 详细变更对比 */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              字段级详细对比（改前 vs 改后）
            </h3>

            {diffs.length === 0 ? (
              <div className="text-center py-10 text-gray-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <p className="font-medium">两个版本之间没有检测到字段级差异</p>
                <p className="text-xs mt-1">可能只涉及处理原因文字变化，或版本号空转</p>
              </div>
            ) : (
              <div className="space-y-4">
                {diffs.map((diff, idx) => (
                  <div key={idx} className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-bold text-slate-800 text-base flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          {fieldNameMap[diff.fieldName] || diff.fieldName}
                          <span className="text-xs text-slate-500 font-mono font-normal">
                            ({diff.fieldName})
                          </span>
                        </span>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {getStakeholderName(diff.changedBy as any)}
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(diff.changedAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
                        {/* 改前 */}
                        <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-4 border border-red-100">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded-full bg-red-200 text-red-800 text-xs font-bold">
                              修改前
                            </span>
                            {diff.fieldName === 'remark' && (
                              <span className="text-xs text-red-600">原备注内容</span>
                            )}
                          </div>
                          <div className={`text-slate-800 rounded-lg p-3 min-h-[2.5rem] ${
                            diff.fieldName === 'remark' || diff.fieldName === 'manualCounterexample'
                              ? 'bg-white/80 whitespace-pre-wrap text-sm leading-relaxed'
                              : 'bg-white/80 font-mono text-sm'
                          }`}>
                            {getFieldDisplayValue(diff.oldValue, diff.fieldName)}
                          </div>
                        </div>

                        <div className="flex md:items-center md:justify-center h-full pt-3 md:pt-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
                            <ArrowRight className="w-5 h-5 text-white" />
                          </div>
                        </div>

                        {/* 改后 */}
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded-full bg-green-200 text-green-800 text-xs font-bold">
                              修改后
                            </span>
                            {diff.fieldName === 'remark' && (
                              <span className="text-xs text-green-600">新备注内容</span>
                            )}
                          </div>
                          <div className={`text-slate-800 rounded-lg p-3 min-h-[2.5rem] ${
                            diff.fieldName === 'remark' || diff.fieldName === 'manualCounterexample'
                              ? 'bg-white/80 whitespace-pre-wrap text-sm leading-relaxed'
                              : 'bg-white/80 font-mono text-sm'
                          }`}>
                            {getFieldDisplayValue(diff.newValue, diff.fieldName)}
                          </div>
                        </div>
                      </div>

                      {/* 备注字段的专门高亮说明 */}
                      {(diff.fieldName === 'remark' || diff.fieldName === 'manualCounterexample') && (
                        <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-800 flex items-start gap-2">
                          <FileEdit className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold mb-0.5">
                              {diff.fieldName === 'remark' ? '备注变更说明：' : '手算反例变更说明：'}
                            </p>
                            <p>
                              该修改由 <b>{getStakeholderName(diff.changedBy as any)}</b> 在{' '}
                              <b>{new Date(diff.changedAt).toLocaleString()}</b> 提交。
                              修改后"课堂演示说明"和绕行比较的解释文案会自动同步刷新，
                              为什么被留下、缺什么材料、下一步找谁等内容会反映最新状态。
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-slate-500">
            💡 提示：修改备注或反例后，绕行比较结果中的"为什么被留下 / 缺什么材料 / 下一步找谁"会自动同步更新
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white rounded-lg transition-colors text-sm font-medium"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
