import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import type { SelfCheckResult, SelfCheckItem } from '../types';
import { getStatusColor } from '../utils/exponentialSmoothing';

interface Props {
  selfCheckResult: SelfCheckResult | null;
  onRefresh: () => Promise<void>;
  loading?: boolean;
}

const checkItemMap: Record<string, { name: string; icon: typeof CheckCircle }> = {
  'duplicate-imports': { name: '重复导入检测', icon: CheckCircle },
  'mixed-format': { name: '百分数和小数混合检测', icon: CheckCircle },
  'recalculation': { name: '补录后重算检测', icon: CheckCircle },
  'export-consistency': { name: '导出一致性检测', icon: CheckCircle },
};

const statusIconMap = {
  pass: CheckCircle,
  warning: AlertTriangle,
  fail: XCircle,
};

const statusTextMap = {
  pass: '通过',
  warning: '警告',
  fail: '失败',
};

const overallStatusTextMap = {
  pass: '全部自检通过',
  warning: '存在警告项',
  fail: '存在失败项',
};

function getStatusBorderColor(status: 'pass' | 'warning' | 'fail'): string {
  const colors = {
    pass: 'border-green-200 hover:border-green-300',
    warning: 'border-amber-200 hover:border-amber-300',
    fail: 'border-red-200 hover:border-red-300',
  };
  return colors[status];
}

function getStatusIconColor(status: 'pass' | 'warning' | 'fail'): string {
  const colors = {
    pass: 'text-green-500',
    warning: 'text-amber-500',
    fail: 'text-red-500',
  };
  return colors[status];
}

export default function SelfCheckPanel({ selfCheckResult, onRefresh, loading = false }: Props) {
  const defaultItems: SelfCheckItem[] = [
    { id: 'duplicate-imports', name: '重复导入检测', status: 'pass', message: '暂无数据', details: '请执行自检获取结果' },
    { id: 'mixed-format', name: '百分数和小数混合检测', status: 'pass', message: '暂无数据', details: '请执行自检获取结果' },
    { id: 'recalculation', name: '补录后重算检测', status: 'pass', message: '暂无数据', details: '请执行自检获取结果' },
    { id: 'export-consistency', name: '导出一致性检测', status: 'pass', message: '暂无数据', details: '请执行自检获取结果' },
  ];

  const items = selfCheckResult?.items || defaultItems;
  const overallStatus = selfCheckResult?.overallStatus || 'pass';

  const getItemById = (id: string): SelfCheckItem => {
    return items.find(item => item.id === id) || defaultItems.find(item => item.id === id)!;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-opacity duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${getStatusColor(overallStatus)}`}>
            {(() => {
              const StatusIcon = statusIconMap[overallStatus];
              return <StatusIcon className={`w-6 h-6 ${getStatusIconColor(overallStatus)}`} />;
            })()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">数据自检</h2>
            <p className={`text-sm font-medium ${getStatusIconColor(overallStatus)}`}>
              {overallStatusTextMap[overallStatus]}
              {selfCheckResult?.checkedAt && (
                <span className="text-gray-400 ml-2 font-normal">
                  {new Date(selfCheckResult.checkedAt).toLocaleString('zh-CN')}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 hover:border-gray-300"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium">{loading ? '自检中...' : '重新自检'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.keys(checkItemMap).map((id) => {
          const item = getItemById(id);
          const { name } = checkItemMap[id];
          const StatusIcon = statusIconMap[item.status];

          return (
            <div
              key={id}
              className={`relative group p-5 rounded-xl border-2 ${getStatusBorderColor(item.status)} bg-white hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-pointer`}
            >
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="group relative">
                  <Info className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                  <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl">
                    <p className="font-medium mb-1">详细信息</p>
                    <p className="text-gray-300">{item.details}</p>
                    <div className="absolute top-full right-3 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${getStatusColor(item.status)}`}>
                  <StatusIcon className={`w-6 h-6 ${getStatusIconColor(item.status)}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">{name}</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                    {statusTextMap[item.status]}
                  </span>
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">{item.message}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
