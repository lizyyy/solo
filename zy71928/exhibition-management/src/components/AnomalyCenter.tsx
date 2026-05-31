import React from 'react';
import { AlertTriangle, CheckCircle, Filter, Clock, User } from 'lucide-react';
import { Exhibition, User as UserType } from '@/types';
import { AnomalyAlert } from './AnomalyAlert';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface AnomalyCenterProps {
  exhibition: Exhibition;
  currentUser: UserType;
  onConfirmAnomaly: (id: string) => void;
}

const anomalyTypeLabels: Record<string, string> = {
  lighting_overridden: '灯光覆盖',
  dimension_unit_error: '单位错误',
  artwork_replaced_no_trace: '作品调换',
  note_silently_overwritten: '备注覆盖',
  unit_mismatch: '单位不一致',
};

export const AnomalyCenter: React.FC<AnomalyCenterProps> = ({
  exhibition,
  currentUser,
  onConfirmAnomaly,
}) => {
  const unconfirmedAnomalies = exhibition.anomalies.filter(a => !a.confirmed);
  const confirmedAnomalies = exhibition.anomalies.filter(a => a.confirmed);

  const pendingChangeLogs = exhibition.changeLogs.filter(
    cl => cl.requiresConfirmation && !cl.confirmed
  );

  const getChangeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      artwork_added: '作品添加',
      artwork_removed: '作品移除',
      artwork_modified: '作品修改',
      dimension_unit_changed: '单位变更',
      lighting_recorded: '灯光记录',
      lighting_overridden: '灯光覆盖',
      note_added: '备注添加',
      note_updated: '备注更新',
      artwork_replaced: '作品替换',
      layout_finalized: '布局定稿',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <AlertTriangle className="text-red-500" />
          异常处理中心
        </h2>
        <div className="flex gap-2">
          <span className="status-badge status-danger">
            {unconfirmedAnomalies.length} 待处理
          </span>
          <span className="status-badge status-normal">
            {confirmedAnomalies.length} 已处理
          </span>
        </div>
      </div>

      {unconfirmedAnomalies.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <h3 className="font-semibold text-gray-700">待确认异常</h3>
          </div>
          {unconfirmedAnomalies.map(anomaly => (
            <AnomalyAlert
              key={anomaly.id}
              anomaly={anomaly}
              onConfirm={currentUser.role === 'curator' ? onConfirmAnomaly : undefined}
              showConfirm={currentUser.role === 'curator'}
            />
          ))}
        </div>
      )}

      {pendingChangeLogs.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Clock size={16} />
              待确认变更记录 ({pendingChangeLogs.length})
            </h3>
          </div>
          <div className="card-body">
            <table className="w-full text-sm">
              <thead className="text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="text-left py-2">类型</th>
                  <th className="text-left py-2">变更内容</th>
                  <th className="text-left py-2">操作人</th>
                  <th className="text-left py-2">时间</th>
                  <th className="text-left py-2">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingChangeLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="py-3">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        {getChangeTypeLabel(log.changeType)}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="text-gray-800">{log.reason}</div>
                      {log.oldValue && log.newValue && (
                        <div className="text-xs text-gray-500 mt-1">
                          {log.oldValue} → {log.newValue}
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-gray-600">
                      <div className="flex items-center gap-1">
                        <User size={12} />
                        {log.operator === 'u1' ? '张明' : '李助理'}
                      </div>
                    </td>
                    <td className="py-3 text-gray-500">
                      {format(new Date(log.timestamp), 'MM-dd HH:mm', { locale: zhCN })}
                    </td>
                    <td className="py-3">
                      <span className="status-badge status-pending">待确认</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmedAnomalies.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-500" />
            已处理异常 ({confirmedAnomalies.length})
          </h3>
          <div className="card">
            <div className="card-body">
              <table className="w-full text-sm">
                <thead className="text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-2">类型</th>
                    <th className="text-left py-2">描述</th>
                    <th className="text-left py-2">确认人</th>
                    <th className="text-left py-2">确认时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {confirmedAnomalies.map(anomaly => (
                    <tr key={anomaly.id}>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          anomaly.severity === 'danger' 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {anomalyTypeLabels[anomaly.type]}
                        </span>
                      </td>
                      <td className="py-3 text-gray-700">{anomaly.description}</td>
                      <td className="py-3 text-gray-600">
                        {anomaly.confirmedBy === 'u1' ? '张明' : anomaly.confirmedBy}
                      </td>
                      <td className="py-3 text-gray-500">
                        {anomaly.confirmedAt 
                          ? format(new Date(anomaly.confirmedAt), 'MM-dd HH:mm', { locale: zhCN })
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {unconfirmedAnomalies.length === 0 && pendingChangeLogs.length === 0 && (
        <div className="card p-12 text-center">
          <CheckCircle className="mx-auto text-green-300 mb-4" size={64} />
          <h3 className="text-lg font-medium text-gray-700 mb-2">一切正常</h3>
          <p className="text-gray-500">当前没有待处理的异常</p>
        </div>
      )}
    </div>
  );
};
