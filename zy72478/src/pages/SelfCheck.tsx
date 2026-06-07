
import { useState } from 'react';
import {
  ClipboardCheck,
  Play,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Copy,
  Clock,
  RefreshCw,
  FileCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { SelfCheckResult, SelfCheckType } from '../../shared/types';

const checkIcons: Record<SelfCheckType, React.ReactNode> = {
  duplicate: <Copy className="w-6 h-6" />,
  low_sampling: <Clock className="w-6 h-6" />,
  recalculation: <RefreshCw className="w-6 h-6" />,
  export_consistency: <FileCheck className="w-6 h-6" />,
};

const statusIcons = {
  pass: <CheckCircle className="w-6 h-6 text-green-500" />,
  warning: <AlertTriangle className="w-6 h-6 text-yellow-500" />,
  error: <XCircle className="w-6 h-6 text-red-500" />,
};

const statusColors = {
  pass: 'border-green-200 bg-green-50',
  warning: 'border-yellow-200 bg-yellow-50',
  error: 'border-red-200 bg-red-50',
};

const statusTextColors = {
  pass: 'text-green-700',
  warning: 'text-yellow-700',
  error: 'text-red-700',
};

const statusLabels = {
  pass: '通过',
  warning: '警告',
  error: '异常',
};

export default function SelfCheck() {
  const { selfChecks, runSelfCheck, runAllSelfChecks } = useAppStore();
  const [expandedType, setExpandedType] = useState<SelfCheckType | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);

  const handleRunAll = () => {
    setIsRunningAll(true);
    setTimeout(() => {
      runAllSelfChecks();
      setIsRunningAll(false);
    }, 1000);
  };

  const handleRunSingle = (type: SelfCheckType) => {
    runSelfCheck(type);
  };

  const passCount = selfChecks.filter((s) => s.status === 'pass').length;
  const warningCount = selfChecks.filter((s) => s.status === 'warning').length;
  const errorCount = selfChecks.filter((s) => s.status === 'error').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">自检中心</h1>
          <p className="text-gray-500 mt-1">四项核心自检，确保数据准确可靠</p>
        </div>
        <button
          onClick={handleRunAll}
          disabled={isRunningAll}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#f59e0b] text-white rounded-lg hover:bg-[#d97706] transition-colors disabled:opacity-50"
        >
          <Play className={`w-4 h-4 ${isRunningAll ? 'animate-spin' : ''}`} />
          {isRunningAll ? '执行中...' : '执行全部自检'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">自检项总数</p>
              <p className="text-xl font-bold text-gray-800">{selfChecks.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">通过</p>
              <p className="text-xl font-bold text-green-600">{passCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">警告</p>
              <p className="text-xl font-bold text-yellow-600">{warningCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">异常</p>
              <p className="text-xl font-bold text-red-600">{errorCount}</p>
            </div>
          </div>
        </div>
      </div>

      {errorCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800 font-medium">
            ⚠️ 检测到 {errorCount} 项异常，建议优先处理后再进行后续操作
          </p>
        </div>
      )}

      <div className="space-y-4">
        {selfChecks.map((check) => (
          <SelfCheckCard
            key={check.type}
            check={check}
            isExpanded={expandedType === check.type}
            onToggle={() => setExpandedType(expandedType === check.type ? null : check.type)}
            onRun={() => handleRunSingle(check.type)}
          />
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">自检说明</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex gap-3">
            <Copy className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-800">重复导入检测</p>
              <p className="text-gray-500">检测是否存在重复导入的公交刷卡记录，避免数据重复统计导致热力图失真</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Clock className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-800">夜间采样不足检测</p>
              <p className="text-gray-500">检测夜间时段(22:00-06:00)各区域采样量，低于日间平均值30%则标记异常</p>
            </div>
          </div>
          <div className="flex gap-3">
            <RefreshCw className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-800">补录后重算验证</p>
              <p className="text-gray-500">验证补录数据导入后热力图是否正确重算，确保数据更新完整</p>
            </div>
          </div>
          <div className="flex gap-3">
            <FileCheck className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-800">导出一致性校验</p>
              <p className="text-gray-500">校验导出数据与系统内部数据是否一致，避免导出时数据丢失或错误</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SelfCheckCardProps {
  check: SelfCheckResult;
  isExpanded: boolean;
  onToggle: () => void;
  onRun: () => void;
}

function SelfCheckCard({ check, isExpanded, onToggle, onRun }: SelfCheckCardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 ${statusColors[check.status]}`}>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              check.status === 'pass' ? 'bg-green-100 text-green-600' :
              check.status === 'warning' ? 'bg-yellow-100 text-yellow-600' :
              'bg-red-100 text-red-600'
            }`}>
              {checkIcons[check.type]}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{check.name}</h3>
              <p className={`text-sm mt-0.5 ${statusTextColors[check.status]}`}>
                {check.message}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              check.status === 'pass' ? 'bg-green-200 text-green-800' :
              check.status === 'warning' ? 'bg-yellow-200 text-yellow-800' :
              'bg-red-200 text-red-800'
            }`}>
              {statusLabels[check.status]}
            </span>
            <button
              onClick={onRun}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              title="重新执行"
            >
              <RefreshCw className="w-5 h-5 text-gray-500" />
            </button>
            <button
              onClick={onToggle}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>
          </div>
        </div>

        {isExpanded && check.details && (
          <div className="mt-4 pt-4 border-t border-gray-200/50">
            <h4 className="text-sm font-medium text-gray-700 mb-2">详细信息</h4>
            <div className="bg-white/80 rounded-lg p-4">
              {check.type === 'duplicate' && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    检测到 <span className="font-semibold text-orange-600">{check.details.duplicateCount}</span> 条重复记录
                  </p>
                  <p className="text-sm text-gray-500">
                    涉及记录ID：{check.details.records?.join(', ')}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    💡 建议：去重后重新导入，或确认数据无误后忽略此警告
                  </p>
                </div>
              )}
              {check.type === 'low_sampling' && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    采样不足区域：
                    <span className="font-semibold text-red-600">
                      {check.details.areas?.join('、')}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500">
                    💡 建议：联系街道规划员复核，考虑补充夜间时段数据
                  </p>
                </div>
              )}
              {check.type === 'recalculation' && (
                <p className="text-sm text-green-700">
                  ✅ 热力图重算功能正常，补录数据后可自动触发更新
                </p>
              )}
              {check.type === 'export_consistency' && (
                <p className="text-sm text-green-700">
                  ✅ 导出功能校验通过，数据完整性有保障
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
