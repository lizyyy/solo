import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Info, Clock } from 'lucide-react';
import type { SelfCheckResult, SelfCheckItem, CheckStatus } from '../types';
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

const statusIconMap: Record<CheckStatus, typeof CheckCircle> = {
  pass: CheckCircle,
  warning: AlertTriangle,
  fail: XCircle,
  pending: Clock,
};

const statusTextMap: Record<CheckStatus, string> = {
  pass: '通过',
  warning: '警告',
  fail: '失败',
  pending: '未触发',
};

const overallStatusTextMap: Record<CheckStatus, string> = {
  pass: '全部自检通过',
  warning: '存在警告项',
  fail: '存在失败项',
  pending: '待触发动作',
};

function getStatusBorderColor(status: CheckStatus): string {
  const colors: Record<CheckStatus, string> = {
    pass: 'border-green-200 hover:border-green-300',
    warning: 'border-amber-200 hover:border-amber-300',
    fail: 'border-red-200 hover:border-red-300',
    pending: 'border-gray-200 hover:border-gray-300',
  };
  return colors[status];
}

function getStatusIconColor(status: CheckStatus): string {
  const colors: Record<CheckStatus, string> = {
    pass: 'text-green-500',
    warning: 'text-amber-500',
    fail: 'text-red-500',
    pending: 'text-gray-400',
  };
  return colors[status];
}

export default function SelfCheckPanel({ selfCheckResult, onRefresh, loading = false }: Props) {
  const defaultItems: SelfCheckItem[] = [
    { id: 'duplicate-imports', name: '重复导入检测', status: 'pending', message: '尚未触发：请先完成至少一次参数导入', details: '未触发，无法判定。导入参数表后，若出现重复 productId 会自动标记并计数。' },
    { id: 'mixed-format', name: '百分数和小数混合检测', status: 'pending', message: '尚未触发：请先导入参数表后重新自检', details: '未触发，无法判定。出现同一记录 alpha/beta/gamma 既有百分数又有小数时会预警，并标注待活动负责人复核。' },
    { id: 'recalculation', name: '补录后重算检测', status: 'pending', message: '尚未触发：请先完成计算与至少一次补录/修正', details: '未触发，无法判定。补录/修正参数后必须重新计算，本项才会标记通过。' },
    { id: 'export-consistency', name: '导出一致性检测', status: 'pending', message: '尚未触发：请先完成一次计算并导出明细', details: '未触发，无法判定。导出明细后会记录条数与内容哈希，重新计算未重新导出时会预警。' },
  ];

  const items = selfCheckResult?.items || defaultItems;
  const overallStatus: CheckStatus = selfCheckResult?.overallStatus || 'pending';

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
