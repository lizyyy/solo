import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { getSecurityLogs, resolveSecurityLog } from '../api';
import { SecurityLog as SecurityLogType } from '../types';

export default function SecurityLogs() {
  const [severityFilter, setSeverityFilter] = useState<string>();
  const queryClient = useQueryClient();

  const { data: logs, isLoading } = useQuery<SecurityLogType[]>(
    ['securityLogs', severityFilter],
    () => getSecurityLogs(severityFilter)
  );

  const resolveMutation = useMutation(
    (logId: number) => resolveSecurityLog(logId, 'admin'),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('securityLogs');
      },
    }
  );

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">🔒 安全日志</h2>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">日志列表</h3>
          <select
            value={severityFilter || ''}
            onChange={(e) => setSeverityFilter(e.target.value || undefined)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部级别</option>
            <option value="info">信息</option>
            <option value="warning">警告</option>
            <option value="critical">严重</option>
          </select>
        </div>

        {isLoading ? (
          <div className="text-center py-8">加载中...</div>
        ) : (
          <div className="space-y-3">
            {logs?.map((log) => (
              <div key={log.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${getSeverityColor(log.severity)}`}>
                      {log.severity}
                    </span>
                    <span className="font-mono text-sm text-blue-600">{log.log_id}</span>
                    <span className="text-sm font-medium">{log.event_type}</span>
                    {log.resolved && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                        已处理
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                    {!log.resolved && (
                      <button
                        onClick={() => resolveMutation.mutate(log.id)}
                        className="text-sm text-green-600 hover:text-green-800"
                      >
                        标记已处理
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-gray-700">{log.message}</p>
                <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                  <span>来源: {log.source_ip}</span>
                  <span>用户代理: {log.user_agent}</span>
                  <Link
                    to={`/uploads/${log.upload_task_id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    查看关联任务 →
                  </Link>
                </div>
                {log.details && (
                  <details className="mt-2">
                    <summary className="text-sm text-blue-600 cursor-pointer">查看详细信息</summary>
                    <pre className="mt-2 bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                      {log.details}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
