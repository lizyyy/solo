import { useEffect, useState } from 'react';
import { History, CheckCircle, Lock, FileText } from 'lucide-react';
import { api } from '../lib/api.js';

const ACTION_TYPE_LABELS: Record<string, string> = {
  EXCEPTION_CONFIRMED: '异常确认',
  SETTLEMENT_LOCKED: '结算锁定',
  SETTLEMENT_CREATED: '结算创建',
  SETTLEMENT_CALCULATED: '重新计算',
};

const ACTION_TYPE_COLORS: Record<string, string> = {
  EXCEPTION_CONFIRMED: 'bg-green-100 text-green-700',
  SETTLEMENT_LOCKED: 'bg-orange-100 text-orange-700',
  SETTLEMENT_CREATED: 'bg-blue-100 text-blue-700',
  SETTLEMENT_CALCULATED: 'bg-purple-100 text-purple-700',
};

const ACTION_TYPE_ICONS: Record<string, any> = {
  EXCEPTION_CONFIRMED: CheckCircle,
  SETTLEMENT_LOCKED: Lock,
  SETTLEMENT_CREATED: FileText,
  SETTLEMENT_CALCULATED: FileText,
};

export default function AuditTrail() {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [filterAction, setFilterAction] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const logs = await api.getAuditLogs();
      setAuditLogs(logs || []);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const actionTypes = [...new Set(auditLogs.map((log) => log.actionType))];

  const filteredLogs = filterAction
    ? auditLogs.filter((log) => log.actionType === filterAction)
    : auditLogs;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">审计追踪</h2>
        <p className="text-gray-500 mt-1">查看所有操作记录和变更历史</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">操作类型:</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部</option>
              {actionTypes.map((type) => (
                <option key={type} value={type}>
                  {ACTION_TYPE_LABELS[type] || type}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={loadLogs}
            className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
          >
            刷新
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">加载中...</div>
        ) : filteredLogs.length > 0 ? (
          <div className="space-y-4">
            {filteredLogs.map((log) => {
              const IconComponent = ACTION_TYPE_ICONS[log.actionType] || History;
              const changes = log.changes ? JSON.parse(log.changes) : null;
              return (
                <div
                  key={log.id}
                  className="p-4 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-2 rounded-lg ${ACTION_TYPE_COLORS[log.actionType] || 'bg-gray-100 text-gray-600'}`}
                    >
                      <IconComponent size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-800">
                          {ACTION_TYPE_LABELS[log.actionType] || log.actionType}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(log.timestamp).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{log.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>操作人: {log.operator}</span>
                        {log.entityId && <span>关联ID: {log.entityId}</span>}
                      </div>
                      {changes && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 mb-2">变更详情:</p>
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                            {JSON.stringify(changes, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <History className="mx-auto mb-3" size={48} />
            <p>暂无审计记录</p>
          </div>
        )}
      </div>
    </div>
  );
}
