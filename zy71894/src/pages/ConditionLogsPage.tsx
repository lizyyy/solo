import { useState } from 'react';
import { useScheduleStore } from '@/store/useScheduleStore';
import { Search, BarChart3, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export default function ConditionLogsPage() {
  const { conditionLogs, getTeamRecordsByBatch, teamRecords } = useScheduleStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const getTeamRecord = (teamRecordId: string) => {
    return teamRecords.find((tr) => tr.id === teamRecordId);
  };

  const filteredLogs = conditionLogs.filter((cl) => {
    const teamRecord = getTeamRecord(cl.teamRecordId);
    const matchesSearch =
      cl.conditionType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cl.operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
      teamRecord?.materialBatchId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || cl.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string, isMissing: boolean) => {
    if (isMissing || status === 'missing') {
      return <XCircle className="w-4 h-4 text-red-600" />;
    }
    if (status === 'abnormal') {
      return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    }
    return <CheckCircle className="w-4 h-4 text-green-600" />;
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-mono font-bold text-industrial-900 mb-2">
            工况日志管理
          </h1>
          <p className="text-industrial-500 text-sm">
            查看和管理所有工况日志数据，支持缺失检测和异常标注
          </p>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-industrial-400" />
            <input
              type="text"
              placeholder="搜索工况类型、操作员、批次号..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-industrial-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-industrial-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">全部状态</option>
            <option value="normal">正常</option>
            <option value="abnormal">异常</option>
            <option value="missing">缺失</option>
          </select>
        </div>

        <div className="bg-white border border-industrial-200 shadow-industrial overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-industrial-50 border-b border-industrial-200">
                <th className="text-left px-6 py-4 font-semibold text-industrial-600">
                  状态
                </th>
                <th className="text-left px-6 py-4 font-semibold text-industrial-600">
                  工况类型
                </th>
                <th className="text-left px-6 py-4 font-semibold text-industrial-600">
                  温度 (°C)
                </th>
                <th className="text-left px-6 py-4 font-semibold text-industrial-600">
                  压力 (kPa)
                </th>
                <th className="text-left px-6 py-4 font-semibold text-industrial-600">
                  流速 (m/s)
                </th>
                <th className="text-left px-6 py-4 font-semibold text-industrial-600">
                  操作员
                </th>
                <th className="text-left px-6 py-4 font-semibold text-industrial-600">
                  关联班组记录
                </th>
                <th className="text-left px-6 py-4 font-semibold text-industrial-600">
                  记录时间
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-200">
              {filteredLogs.map((log) => {
                const teamRecord = getTeamRecord(log.teamRecordId);
                return (
                  <tr
                    key={log.id}
                    className={`${
                      log.isMissing
                        ? 'bg-red-50'
                        : log.status === 'abnormal'
                        ? 'bg-amber-50'
                        : 'hover:bg-industrial-50'
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status, log.isMissing)}
                        <span
                          className={`text-xs font-medium ${
                            log.isMissing || log.status === 'missing'
                              ? 'text-red-700'
                              : log.status === 'abnormal'
                              ? 'text-amber-700'
                              : 'text-green-700'
                          }`}
                        >
                          {log.isMissing || log.status === 'missing'
                            ? '缺失'
                            : log.status === 'abnormal'
                            ? '异常'
                            : '正常'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-industrial-900">
                      {log.conditionType || (
                        <span className="text-red-600">【缺失】</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-industrial-700">
                      {log.isMissing ? '-' : log.temperature}
                    </td>
                    <td className="px-6 py-4 font-mono text-industrial-700">
                      {log.isMissing ? '-' : log.pressure}
                    </td>
                    <td className="px-6 py-4 font-mono text-industrial-700">
                      {log.isMissing ? '-' : log.velocity}
                    </td>
                    <td className="px-6 py-4 text-industrial-600">
                      {log.operator || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {teamRecord ? (
                        <div>
                          <p className="font-mono text-xs text-industrial-700">
                            {teamRecord.teamId}
                          </p>
                          <p className="text-xs text-industrial-400">
                            {teamRecord.materialBatchId}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-industrial-400">未关联</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-industrial-500">
                      {new Date(log.logTime).toLocaleString('zh-CN')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center gap-6 text-sm text-industrial-500">
          <span>共 {filteredLogs.length} 条记录</span>
          <span className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            正常: {conditionLogs.filter((c) => c.status === 'normal' && !c.isMissing).length}
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            异常: {conditionLogs.filter((c) => c.status === 'abnormal').length}
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="w-4 h-4 text-red-600" />
            缺失: {conditionLogs.filter((c) => c.isMissing || c.status === 'missing').length}
          </span>
        </div>
      </div>
    </div>
  );
}
