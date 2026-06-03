import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  FileWarning,
  Copy,
  Check,
  Database,
  FileCheck,
} from 'lucide-react';
import { useCanonicalStore } from '../store/canonicalStore';
import { SELF_CHECK_LABELS, type SelfCheckType, type SelfCheckResult } from '../types';
import { formatTimestamp } from '../utils/checksum';

const checkIcons: Record<SelfCheckType, React.ReactNode> = {
  duplicate_import: <Copy className="w-8 h-8" />,
  missing_row: <FileWarning className="w-8 h-8" />,
  recalculation: <RefreshCw className="w-8 h-8" />,
  export_consistency: <Database className="w-8 h-8" />,
};

const checkDescriptions: Record<SelfCheckType, string> = {
  duplicate_import: '检测是否存在重复导入相同文件的情况，通过比对文件hash实现',
  missing_row: '检测照片点位与坐标表的匹配情况，标记"照片有点位但坐标表缺一行"的记录',
  recalculation: '校验补录后的重算结果是否正确，补录记录是否正确转换为重算状态',
  export_consistency: '验证页面展示、API接口、文件导出三者读取的数据是否完全一致',
};

export function SelfCheck() {
  const { selfCheckResults, runSelfCheck, loadSelfCheckResults, currentOperator, isLoading } =
    useCanonicalStore();
  const [selectedCheck, setSelectedCheck] = useState<SelfCheckType | null>(null);
  const [runningCheck, setRunningCheck] = useState<SelfCheckType | null>(null);

  useEffect(() => {
    loadSelfCheckResults();
  }, [loadSelfCheckResults]);

  const handleRunCheck = async (type: SelfCheckType) => {
    setRunningCheck(type);
    try {
      await runSelfCheck(type);
    } finally {
      setRunningCheck(null);
    }
  };

  const handleRunAll = async () => {
    const types: SelfCheckType[] = ['duplicate_import', 'missing_row', 'recalculation', 'export_consistency'];
    for (const type of types) {
      await handleRunCheck(type);
    }
  };

  const allPassed =
    selfCheckResults.duplicate_import?.passed &&
    selfCheckResults.missing_row?.passed &&
    selfCheckResults.recalculation?.passed &&
    selfCheckResults.export_consistency?.passed;

  const hasAnyResult = Object.values(selfCheckResults).some((r) => r !== null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">自检中心</h1>
          <p className="text-sm text-gray-500 mt-1">
            四项核心自检：重复导入、缺行检测、补录重算、导出一致
          </p>
        </div>
        <button onClick={handleRunAll} className="btn-industrial flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          执行全部自检
        </button>
      </div>

      {hasAnyResult && (
        <div
          className={`card-industrial p-4 ${
            allPassed ? 'border-success-500 bg-green-50' : 'border-warning-500 bg-orange-50'
          }`}
        >
          <div className="flex items-center gap-3">
            {allPassed ? (
              <CheckCircle className="w-8 h-8 text-success-500" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-warning-500" />
            )}
            <div>
              <h3 className="font-bold text-gray-800">
                {allPassed ? '全部自检通过 ✓' : '存在待处理项'}
              </h3>
              <p className="text-sm text-gray-600">
                {allPassed
                  ? '系统各项检测均已通过，数据一致性得到保障'
                  : '请逐项查看自检结果，处理异常项后重新检测'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {(Object.keys(selfCheckResults) as SelfCheckType[]).map((type) => {
          const result = selfCheckResults[type];
          const isRunning = runningCheck === type;

          return (
            <div
              key={type}
              className={`card-industrial p-6 cursor-pointer transition-all hover:shadow-lg ${
                result?.passed
                  ? 'border-success-500'
                  : result
                  ? 'border-warning-500'
                  : 'border-gray-200'
              } ${selectedCheck === type ? 'ring-2 ring-primary-600' : ''}`}
              onClick={() => setSelectedCheck(selectedCheck === type ? null : type)}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`p-3 ${
                    result?.passed
                      ? 'bg-green-100 text-success-500'
                      : result
                      ? 'bg-orange-100 text-warning-500'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {checkIcons[type]}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRunCheck(type);
                  }}
                  disabled={isRunning}
                  className={`btn-industrial-outline text-sm px-3 py-1.5 flex items-center gap-1.5 ${
                    isRunning ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isRunning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      检测中
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      运行检测
                    </>
                  )}
                </button>
              </div>

              <h3 className="text-lg font-bold text-gray-800 mb-2">{SELF_CHECK_LABELS[type]}</h3>
              <p className="text-sm text-gray-500 mb-4">{checkDescriptions[type]}</p>

              {result ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {result.passed ? (
                      <CheckCircle className="w-5 h-5 text-success-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-warning-500" />
                    )}
                    <span
                      className={`font-medium ${
                        result.passed ? 'text-success-600' : 'text-warning-600'
                      }`}
                    >
                      {result.message}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    检测时间：{formatTimestamp(result.checkedAt)}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <FileCheck className="w-4 h-4" />
                  尚未执行检测
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedCheck && selfCheckResults[selectedCheck] && (
        <div className="card-industrial p-6 border-primary-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 text-lg">
              {SELF_CHECK_LABELS[selectedCheck]} - 详细结果
            </h3>
            <button
              onClick={() => setSelectedCheck(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              关闭
            </button>
          </div>
          <div className="bg-gray-50 p-4 border border-gray-200 font-mono text-sm overflow-x-auto">
            <pre>{JSON.stringify(selfCheckResults[selectedCheck]?.details, null, 2)}</pre>
          </div>
        </div>
      )}

      <div className="card-industrial p-6">
        <h3 className="font-bold text-gray-800 mb-4">自检触发时机说明</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200">
            <Copy className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-gray-800">重复导入检测</span>
              <span className="text-gray-600">
                 - 每次导入坐标原点说明文件时自动触发，比对文件hash判断是否重复
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200">
            <FileWarning className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-gray-800">坐标表缺行检测</span>
              <span className="text-gray-600">
                - 导入时自动遍历照片点位与坐标表匹配，缺行记录标记为"缺行待复核"，
                <span className="font-bold text-warning-600">不自动归正常，留给安全员复核</span>
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-cyan-50 border border-cyan-200">
            <RefreshCw className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-gray-800">补录后重算校验</span>
              <span className="text-gray-600">
                - 补录完成触发重算时自动校验，验证补录记录是否正确转换为重算状态
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200">
            <Database className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-gray-800">导出一致性验证</span>
              <span className="text-gray-600">
                - 导出时同时计算页面数据、导出数据、接口数据的hash并比对，确保三者完全一致
              </span>
            </div>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-xl">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-600">检测中...</p>
          </div>
        </div>
      )}
    </div>
  );
}
