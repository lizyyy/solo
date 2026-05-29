import { useState } from 'react';
import { History, Download, Filter, User, Clock, FileText, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { formatDateTime } from '@/utils/format';
import { cn } from '@/lib/utils';

const OPERATION_TYPE_LABELS: Record<string, string> = {
  filter: '筛选操作',
  export: '导出操作',
  status_change: '状态变更',
  manual_judgment: '人工判断',
  announcement_update: '公告更新',
};

const OPERATION_TYPE_COLORS: Record<string, string> = {
  filter: 'bg-primary-100 text-primary-700 border-primary-300',
  export: 'bg-accent-100 text-accent-700 border-accent-300',
  status_change: 'bg-conflict-date/10 text-conflict-date border-conflict-date/30',
  manual_judgment: 'bg-conflict-position/10 text-conflict-position border-conflict-position/30',
  announcement_update: 'bg-success-500/10 text-success-600 border-success-500/30',
};

export default function OperationLogs() {
  const { operationLogs, exportRecords } = useStore();
  const [activeTab, setActiveTab] = useState<'logs' | 'exports'>('logs');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [operatorFilter, setOperatorFilter] = useState('');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  const operators = Array.from(new Set(operationLogs.map((log) => log.operator)));

  const filteredLogs = operationLogs.filter((log) => {
    if (typeFilter && log.operationType !== typeFilter) return false;
    if (operatorFilter && !log.operator.includes(operatorFilter)) return false;
    return true;
  });

  const hasFilters = typeFilter || operatorFilter;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-semibold text-primary-900">操作回看</h2>
        <p className="text-sm text-neutral-500 mt-1">查看历史操作记录和导出记录</p>
      </div>

      <div className="flex border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('logs')}
          className={cn(
            'px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'logs'
              ? 'text-accent-600 border-accent-500'
              : 'text-neutral-500 border-transparent hover:text-primary-700'
          )}
        >
          <History className="w-4 h-4 inline mr-2" />
          操作日志
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-neutral-100 text-neutral-600">
            {filteredLogs.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('exports')}
          className={cn(
            'px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'exports'
              ? 'text-accent-600 border-accent-500'
              : 'text-neutral-500 border-transparent hover:text-primary-700'
          )}
        >
          <Download className="w-4 h-4 inline mr-2" />
          导出记录
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-neutral-100 text-neutral-600">
            {exportRecords.length}
          </span>
        </button>
      </div>

      {activeTab === 'logs' && (
        <>
          <div className="card overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-4 bg-neutral-50 border-b border-neutral-200 cursor-pointer"
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary-600" />
                <span className="font-medium text-neutral-800">筛选条件</span>
                {hasFilters && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-accent-100 text-accent-700">
                    已筛选
                  </span>
                )}
              </div>
              {isFilterExpanded ? (
                <ChevronUp className="w-4 h-4 text-neutral-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-neutral-500" />
              )}
            </div>
            {isFilterExpanded && (
              <div className="p-5 border-b border-neutral-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                    操作类型
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setTypeFilter(null)}
                      className={cn(
                        'px-3 py-1.5 text-sm font-medium rounded border-2 transition-all',
                        typeFilter === null
                          ? 'bg-accent-500 text-white border-accent-500'
                          : 'bg-white text-neutral-600 border-neutral-300 hover:border-accent-400'
                      )}
                    >
                      全部
                    </button>
                    {Object.entries(OPERATION_TYPE_LABELS).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => setTypeFilter(typeFilter === value ? null : value)}
                        className={cn(
                          'px-3 py-1.5 text-sm font-medium rounded border-2 transition-all',
                          typeFilter === value
                            ? 'bg-accent-500 text-white border-accent-500'
                            : 'bg-white text-neutral-600 border-neutral-300 hover:border-accent-400'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                    操作人
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={operatorFilter}
                      onChange={(e) => setOperatorFilter(e.target.value)}
                      placeholder="输入操作人姓名..."
                      className="input-field pl-9"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="divide-y divide-neutral-200 max-h-[600px] overflow-y-auto scrollbar-thin">
              {filteredLogs.length === 0 ? (
                <div className="py-16 text-center text-neutral-500">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">暂无操作记录</p>
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.logId} className="p-5 hover:bg-neutral-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'px-2 py-0.5 text-xs font-medium rounded border',
                            OPERATION_TYPE_COLORS[log.operationType]
                          )}
                        >
                          {OPERATION_TYPE_LABELS[log.operationType]}
                        </span>
                        <span className="text-sm font-medium text-neutral-800">
                          {log.description}
                        </span>
                      </div>
                      <span className="text-xs text-neutral-400 font-mono tabular-nums">
                        {formatDateTime(log.operationTime)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-neutral-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {log.operator}
                      </span>
                      {log.detail && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {JSON.stringify(log.detail)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'exports' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead className="bg-neutral-100 border-b border-neutral-200 sticky top-0 z-10">
                <tr>
                  <th className="table-header">导出时间</th>
                  <th className="table-header">操作人</th>
                  <th className="table-header">文件名称</th>
                  <th className="table-header">记录数量</th>
                  <th className="table-header">筛选条件</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {exportRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-neutral-500">
                      <Download className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">暂无导出记录</p>
                    </td>
                  </tr>
                ) : (
                  exportRecords.map((record) => (
                    <tr key={record.recordId} className="table-row">
                      <td className="table-cell">
                        <span className="font-mono text-xs tabular-nums">
                          {formatDateTime(record.exportTime)}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-neutral-400" />
                          {record.operator}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className="font-mono text-xs text-primary-700">
                          {record.fileName}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className="font-mono tabular-nums text-accent-600 font-medium">
                          {record.recordCount} 条
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(record.filterConditions)
                            .filter(([, v]) => v !== undefined && v !== null && v !== '')
                            .map(([key, value]) => (
                              <span
                                key={key}
                                className="px-1.5 py-0.5 text-xs rounded bg-neutral-100 text-neutral-600"
                              >
                                {key}: {Array.isArray(value) ? value.join(',') : String(value)}
                              </span>
                            ))}
                          {Object.keys(record.filterConditions).filter(
                            (k) =>
                              record.filterConditions[k as keyof typeof record.filterConditions] !==
                                undefined &&
                              record.filterConditions[k as keyof typeof record.filterConditions] !==
                                null &&
                              record.filterConditions[k as keyof typeof record.filterConditions] !== ''
                          ).length === 0 && (
                            <span className="text-xs text-neutral-400">无筛选条件</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
