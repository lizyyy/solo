import React from 'react';
import { Image, Lightbulb, FileText, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { Exhibition, User } from '@/types';
import { AnomalyAlert } from './AnomalyAlert';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface OverviewProps {
  exhibition: Exhibition;
  currentUser: User;
  onConfirmAnomaly: (id: string) => void;
  getPendingConfirmations: () => any;
}

export const Overview: React.FC<OverviewProps> = ({ exhibition, currentUser, onConfirmAnomaly, getPendingConfirmations }) => {
  const pending = getPendingConfirmations();
  const unconfirmedAnomalies = exhibition.anomalies.filter(a => !a.confirmed);

  const stats = [
    { label: '作品总数', value: exhibition.artworks.filter(a => a.status !== 'replaced').length, icon: Image, color: 'text-blue-600' },
    { label: '灯光记录', value: exhibition.lightingRecords.length, icon: Lightbulb, color: 'text-yellow-600' },
    { label: '策展备注', value: exhibition.curatorNotes.length, icon: FileText, color: 'text-purple-600' },
    { label: '变更记录', value: exhibition.changeLogs.length, icon: Clock, color: 'text-gray-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">{exhibition.name}</h1>
        <div className="flex flex-wrap gap-4 text-sm opacity-90">
          <span>展期：{format(new Date(exhibition.startDate), 'yyyy年MM月dd日', { locale: zhCN })} - {format(new Date(exhibition.endDate), 'yyyy年MM月dd日', { locale: zhCN })}</span>
          <span>地点：{exhibition.location}</span>
          <span>当前用户：{currentUser.name} ({currentUser.role === 'curator' ? '策展人' : '画廊助理'})</span>
        </div>
      </div>

      {unconfirmedAnomalies.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-red-500" size={20} />
            <h2 className="text-lg font-semibold text-red-700">待确认异常 ({unconfirmedAnomalies.length})</h2>
          </div>
          {unconfirmedAnomalies.slice(0, 3).map(anomaly => (
            <AnomalyAlert
              key={anomaly.id}
              anomaly={anomaly}
              onConfirm={onConfirmAnomaly}
            />
          ))}
          {unconfirmedAnomalies.length > 3 && (
            <p className="text-sm text-gray-500">还有 {unconfirmedAnomalies.length - 3} 项异常待处理，请前往异常处理页面查看。</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="card p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gray-50 ${stat.color}`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {pending.anomalies.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">待确认事项</h3>
            <span className="status-badge status-pending">{pending.anomalies.length} 项待处理</span>
          </div>
          <div className="card-body space-y-2">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{pending.anomalies.length}</p>
                <p className="text-xs text-gray-600">异常待确认</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{pending.changeLogs.length}</p>
                <p className="text-xs text-gray-600">变更待确认</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">{pending.artworks.length}</p>
                <p className="text-xs text-gray-600">作品待确认</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-800">最新变更记录</h3>
          </div>
          <div className="card-body space-y-3 max-h-64 overflow-y-auto">
            {exhibition.changeLogs.slice(-5).reverse().map(log => (
              <div key={log.id} className="flex items-start gap-3 p-2 rounded hover:bg-gray-50">
                <div className={`mt-1 ${log.confirmed ? 'text-green-500' : 'text-yellow-500'}`}>
                  {log.confirmed ? <CheckCircle size={16} /> : <Clock size={16} />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{log.reason}</p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(log.timestamp), 'MM-dd HH:mm', { locale: zhCN })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-800">最新策展备注</h3>
          </div>
          <div className="card-body space-y-3 max-h-64 overflow-y-auto">
            {exhibition.curatorNotes.slice(-3).reverse().map(note => (
              <div key={note.id} className="p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-blue-700">v{note.version}</span>
                  {note.isSupplement && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">补充</span>
                  )}
                </div>
                <p className="text-sm text-gray-700">{note.content}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {format(new Date(note.createdAt), 'MM-dd HH:mm', { locale: zhCN })}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
