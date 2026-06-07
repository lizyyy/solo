import { useState } from 'react';
import {
  History,
  Search,
  Filter,
  User,
  Clock,
  FileText,
  Tags,
  AlertTriangle,
  ShieldCheck,
  FileBarChart,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAppStore } from '../store';
import { formatDateTime } from '../utils/helpers';

const operationTypeConfig: Record<string, { icon: typeof History; color: string; label: string }> = {
  合同导入: { icon: FileText, color: 'bg-sky-100 text-sky-700', label: '合同导入' },
  别名添加: { icon: Tags, color: 'bg-violet-100 text-violet-700', label: '别名添加' },
  冲突处理: { icon: AlertTriangle, color: 'bg-amber-100 text-amber-700', label: '冲突处理' },
  自检运行: { icon: ShieldCheck, color: 'bg-emerald-100 text-emerald-700', label: '自检运行' },
  周报生成: { icon: FileBarChart, color: 'bg-slate-100 text-slate-700', label: '周报生成' },
};

export default function HistoryPage() {
  const { operationLogs } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('全部');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allTypes = ['全部', ...Array.from(new Set(operationLogs.map((l) => l.operationType)))];

  const filteredLogs = operationLogs.filter((log) => {
    const matchesSearch =
      log.description.includes(searchTerm) ||
      log.operator.includes(searchTerm) ||
      log.operationType.includes(searchTerm);
    const matchesType = filterType === '全部' || log.operationType === filterType;
    return matchesSearch && matchesType;
  });

  const getTypeConfig = (type: string) =>
    operationTypeConfig[type] || {
      icon: History,
      color: 'bg-slate-100 text-slate-700',
      label: type,
    };

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <History className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-0.5">操作历史记录</h4>
            <p className="text-xs text-slate-600">
              所有操作都有完整的时间戳和操作人记录，追证据时不会断在半路。
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索操作记录..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            {allTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  filterType === type
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />

          <div className="space-y-1">
            {filteredLogs.map((log) => {
              const config = getTypeConfig(log.operationType);
              const Icon = config.icon;
              const isExpanded = expandedId === log.id;
              const hasDetails = log.beforeData || log.afterData;

              return (
                <div key={log.id} className="relative pl-12">
                  <div
                    className={`absolute left-3.5 top-4 w-3 h-3 rounded-full border-2 border-white ${
                      config.color.includes('sky')
                        ? 'bg-sky-500'
                        : config.color.includes('violet')
                        ? 'bg-violet-500'
                        : config.color.includes('amber')
                        ? 'bg-amber-500'
                        : config.color.includes('emerald')
                        ? 'bg-emerald-500'
                        : 'bg-slate-500'
                    }`}
                  />

                  <div
                    className={`p-4 rounded-lg border transition-colors ${
                      hasDetails
                        ? 'cursor-pointer hover:bg-slate-50 border-slate-200'
                        : 'border-transparent'
                    }`}
                    onClick={() => hasDetails && setExpandedId(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${config.color}`}
                          >
                            <span className="flex items-center gap-1">
                              <Icon className="w-3 h-3" />
                              {config.label}
                            </span>
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {log.operator}
                          </span>
                        </div>
                        <p className="text-sm text-slate-800">{log.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(new Date(log.timestamp))}
                        </span>
                        {hasDetails &&
                          (isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ))}
                      </div>
                    </div>

                    {isExpanded && hasDetails && (
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        {log.beforeData && (
                          <div className="p-3 bg-red-50 rounded-md border border-red-100">
                            <h5 className="text-xs font-semibold text-red-700 mb-1.5">变更前</h5>
                            <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono">
                              {log.beforeData}
                            </pre>
                          </div>
                        )}
                        {log.afterData && (
                          <div className="p-3 bg-emerald-50 rounded-md border border-emerald-100">
                            <h5 className="text-xs font-semibold text-emerald-700 mb-1.5">变更后</h5>
                            <pre className="text-xs text-emerald-600 whitespace-pre-wrap font-mono">
                              {log.afterData}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredLogs.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无操作记录</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
