import { useState } from 'react';
import { useScheduleStore } from '@/store/useScheduleStore';
import StatusBadge from '@/components/StatusBadge';
import { Search, Users, History, AlertTriangle } from 'lucide-react';

export default function TeamRecordsPage() {
  const { teamRecords, getMaterialBatchInfo } = useScheduleStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRecords = teamRecords.filter(
    (tr) =>
      tr.materialBatchId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tr.operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tr.teamId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-mono font-bold text-industrial-900 mb-2">
            班组记录管理
          </h1>
          <p className="text-industrial-500 text-sm">
            查看和管理所有班组记录，支持查看修改历史
          </p>
        </div>

        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-industrial-400" />
          <input
            type="text"
            placeholder="搜索批次号、操作员、班组..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-industrial-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="space-y-4">
          {filteredRecords.map((record) => {
            const batchInfo = getMaterialBatchInfo(record.materialBatchId);
            return (
              <div
                key={record.id}
                className={`bg-white border p-6 shadow-industrial ${
                  record.isMissing
                    ? 'border-red-300 bg-red-50/30'
                    : record.status === 'warning'
                    ? 'border-amber-300 bg-amber-50/30'
                    : 'border-industrial-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 flex items-center justify-center ${
                        record.isMissing
                          ? 'bg-red-100'
                          : record.status === 'warning'
                          ? 'bg-amber-100'
                          : 'bg-blue-100'
                      }`}
                    >
                      <Users
                        className={`w-5 h-5 ${
                          record.isMissing
                            ? 'text-red-600'
                            : record.status === 'warning'
                            ? 'text-amber-600'
                            : 'text-blue-600'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-industrial-900">
                          {record.teamId}
                        </h3>
                        {record.isMissing && (
                          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700">
                            内容缺失
                          </span>
                        )}
                        {record.status === 'warning' && !record.isMissing && (
                          <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700">
                            有警告
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-industrial-500">
                        操作员: {record.operator || '未知'} · 记录时间:{' '}
                        {new Date(record.recordTime).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm text-industrial-600">
                      {record.materialBatchId}
                    </p>
                    {batchInfo && (
                      <p className="text-xs text-industrial-400">{batchInfo.name}</p>
                    )}
                  </div>
                </div>

                <div className="bg-industrial-50 border border-industrial-200 p-4 mb-4">
                  <p className="text-sm font-medium text-industrial-600 mb-2">记录内容</p>
                  <p className="text-industrial-800">
                    {record.content || (
                      <span className="text-red-600">【内容缺失，请补录】</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4 text-industrial-500">
                    <span>
                      修改人: <span className="text-industrial-700">{record.modifiedBy}</span>
                    </span>
                    <span>
                      修改时间:{' '}
                      <span className="text-industrial-700">
                        {new Date(record.modifiedAt).toLocaleString('zh-CN')}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-industrial-500">
                    <History className="w-4 h-4" />
                    <span>{record.modificationHistory.length} 条修改历史</span>
                  </div>
                </div>

                {record.modificationHistory.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-industrial-200">
                    <p className="text-sm font-medium text-industrial-700 mb-3 flex items-center gap-2">
                      <History className="w-4 h-4" />
                      修改历史
                    </p>
                    <div className="space-y-2">
                      {record.modificationHistory.map((ml) => (
                        <div
                          key={ml.id}
                          className="bg-industrial-50 border border-industrial-200 p-3 text-sm"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-medium text-industrial-700">
                              {ml.modifiedBy}
                            </span>
                            <span className="text-industrial-400">
                              {new Date(ml.modifiedAt).toLocaleString('zh-CN')}
                            </span>
                            <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700">
                              {ml.reason}
                            </span>
                          </div>
                          <div className="font-mono text-xs">
                            <span className="text-red-600">"- {ml.oldContent}"</span>
                            <span className="mx-2 text-industrial-400">→</span>
                            <span className="text-green-600">"+ {ml.newContent}"</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
