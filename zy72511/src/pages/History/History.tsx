import React, { useState } from 'react';
import { Search, Clock, User, ChevronDown, ChevronUp, FileText, Database } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { OperationType } from '../../types';
import { getOperationTypeLabel, getOperationTypeColor } from '../../utils';

const History: React.FC = () => {
  const { operationLogs, samples } = useStore();
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<OperationType | 'all'>('all');

  const filteredLogs = operationLogs
    .filter((log) => {
      const matchSearch =
      log.description.toLowerCase().includes(searchText.toLowerCase()) ||
      log.operator.toLowerCase().includes(searchText.toLowerCase()) ||
      log.description.toLowerCase().includes(searchText.toLowerCase());
      const matchType = filterType === 'all' || log.operationType === filterType;
      return matchSearch && matchType;
    })
    .sort((a, b) => new Date(b.operationTime).getTime() - new Date(a.operationTime).getTime());

  const getSampleNo = (sampleId?: string) => {
    if (!sampleId) return '-';
    const sample = samples.find((s) => s.id === sampleId);
    return sample?.sampleNo || '-';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 mb-2" style={{ fontFamily: '"Noto Serif SC", serif' }}>
          历史记录
        </h2>
        <p className="text-sm text-slate-500">
          全量操作日志，谁改了什么、为什么改、影响哪些结果
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索操作描述、操作人..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">操作类型：</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as OperationType | 'all')}
              className="px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">全部</option>
              {Object.values(OperationType).map((type) => (
                <option key={type} value={type}>
                  {getOperationTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 w-10"></th>
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">操作时间</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">操作类型</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">操作人</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">关联样本</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">操作描述</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => (
              <React.Fragment key={log.id}>
                <tr
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                >
                  <td className="py-3 px-4">
                    {expandedId === log.id ? (
                      <ChevronUp size={16} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={16} className="text-slate-400" />
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Clock size={14} className="text-slate-400" />
                      {log.operationTime}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${getOperationTypeColor(log.operationType)}`} />
                      <span className="text-sm text-slate-700">{getOperationTypeLabel(log.operationType)}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <User size={14} className="text-slate-400" />
                      {log.operator}
                      <span className="text-xs text-slate-400">({log.operatorRole})</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600">
                    {getSampleNo(log.sampleId)}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-700">{log.description}</td>
                </tr>
                {expandedId === log.id && (
                  <tr className="bg-slate-50">
                    <td colSpan={6} className="py-4 px-8">
                      <div className="space-y-3">
                        {log.reason && (
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">修改原因</p>
                            <p className="text-sm text-slate-700 p-2 bg-white rounded border border-slate-200">
                              {log.reason}
                            </p>
                          </div>
                        )}

                        {(log.beforeState || log.afterState) && (
                          <div className="grid grid-cols-2 gap-4">
                          {log.beforeState && Object.keys(log.beforeState).length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-amber-600 mb-1 flex items-center gap-1">
                                <FileText size={12} />
                                修改前
                              </p>
                              <pre className="text-xs text-slate-600 p-2 bg-amber-50 rounded border border-amber-100 overflow-auto max-h-32">
                                {JSON.stringify(log.beforeState, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.afterState && Object.keys(log.afterState).length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-emerald-600 mb-1 flex items-center gap-1">
                                <Database size={12} />
                                修改后
                              </p>
                              <pre className="text-xs text-slate-600 p-2 bg-emerald-50 rounded border border-emerald-100 overflow-auto max-h-32">
                                {JSON.stringify(log.afterState, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                        {log.affectedSamples && log.affectedSamples.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">影响样本</p>
                            <div className="flex flex-wrap gap-2">
                              {log.affectedSamples.map((sampleId) => {
                                const sample = samples.find((s) => s.id === sampleId);
                                return (
                                  <span
                                    key={sampleId}
                                    className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded border border-blue-100"
                                  >
                                    {sample?.sampleNo || sampleId}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {filteredLogs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-slate-500">暂无匹配的操作记录</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
