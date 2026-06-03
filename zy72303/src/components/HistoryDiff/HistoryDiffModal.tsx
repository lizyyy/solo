import { useAppContext } from '../../store/AppContext';
import { computeHistoryDiff, getStakeholderName } from '../../utils/dataUtils';
import { X, ArrowRight, Clock, User } from 'lucide-react';

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
};

export function HistoryDiffModal({ recordId, fromVersion, toVersion, onClose }: HistoryDiffModalProps) {
  const { state } = useAppContext();
  const record = state.parameterRecords.find(r => r.id === recordId);

  if (!record) return null;

  const diffs = computeHistoryDiff(record, fromVersion, toVersion);

  const formatValue = (value: unknown, fieldName: string): string => {
    if (value === null || value === undefined) return '空';
    if (typeof value === 'boolean') {
      if (fieldName === 'denominatorDisplayEmpty') {
        return value ? '是（显示为空）' : '否';
      }
      return value ? '是' : '否';
    }
    if (typeof value === 'object') return JSON.stringify(value);
    if (fieldName === 'assignedTo') return getStakeholderName(value as any);
    return String(value);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">历史版本对比</h2>
            <p className="text-amber-100 text-sm mt-1">
              {record.sourceNode} → {record.targetNode} · 版本 v{fromVersion} → v{toVersion}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          {record.versions.length > 0 && (
            <div className="mb-6 bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">版本历史时间线</h3>
              <div className="space-y-3">
                {record.versions.map(version => (
                  <div key={version.version} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      version.version >= fromVersion && version.version <= toVersion
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {version.version}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">
                          v{version.version}
                        </span>
                        <span className="text-sm text-gray-500">
                          {version.changeDescription}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {getStakeholderName(version.author as any)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(version.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">变更详情</h3>
            {diffs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>两个版本之间没有差异</p>
              </div>
            ) : (
              <div className="space-y-4">
                {diffs.map((diff, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800">
                          {fieldNameMap[diff.fieldName] || diff.fieldName}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <User className="w-3 h-3" />
                          {getStakeholderName(diff.changedBy as any)}
                          <span className="text-gray-300">|</span>
                          <Clock className="w-3 h-3" />
                          {new Date(diff.changedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 bg-red-50 rounded-lg p-3">
                          <p className="text-xs text-red-600 font-medium mb-1">修改前</p>
                          <p className="text-sm text-gray-800 font-mono">
                            {formatValue(diff.oldValue, diff.fieldName)}
                          </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 bg-green-50 rounded-lg p-3">
                          <p className="text-xs text-green-600 font-medium mb-1">修改后</p>
                          <p className="text-sm text-gray-800 font-mono">
                            {formatValue(diff.newValue, diff.fieldName)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
