import { useEffect, useState } from 'react';
import { Event, Registration, EventLogEntry, ExportFormat } from '@/types';
import { useAppStore } from '@/store/app';
import { api } from '@/lib/api';
import { ArrowLeft, Calendar, Users, Download, Trash2, FileSpreadsheet, FileText, File, UserPlus, Edit } from 'lucide-react';
import dayjs from 'dayjs';

interface EventDetailProps {
  event: Event;
  registrations: Registration[];
  onBack: () => void;
  onRegister: () => void;
  onEdit: () => void;
  onCancelEvent: () => void;
  onCancelRegistration: (registration: Registration) => void;
  isLoading: boolean;
}

export function EventDetail({ event, registrations, onBack, onRegister, onEdit, onCancelEvent, onCancelRegistration, isLoading }: EventDetailProps) {
  const [logEntries, setLogEntries] = useState<EventLogEntry[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { fetchEventRegistrations } = useAppStore();

  useEffect(() => {
    fetchEventRegistrations(event.id);
    loadEventLog();
  }, [event.id]);

  const loadEventLog = async () => {
    setLoadingLog(true);
    try {
      const { entries } = await api.getEventLogByAggregate('event', event.id);
      const regLogs = await api.getEventLogByAggregate('registration', event.id);
      setLogEntries([...entries, ...regLogs].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ));
    } catch (error) {
      console.error('Failed to load event log:', error);
    } finally {
      setLoadingLog(false);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    setExporting(true);
    try {
      const response = await api.exportEvent(event.id, format, true);
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${event.title}_registrations.${format === 'excel' ? 'xlsx' : format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const statusBadgeClass = {
    draft: 'badge-draft',
    active: 'badge-active',
    cancelled: 'badge-cancelled',
    completed: 'badge-completed',
  }[event.status];

  const regStatusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      confirmed: 'badge-confirmed',
      pending: 'badge-pending',
      cancelled: 'badge-cancelled',
      waitlisted: 'badge-pending',
    };
    return classes[status] || 'badge-draft';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="btn-secondary flex items-center"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回列表
        </button>

        <div className="flex flex-wrap gap-2">
          {event.status === 'active' && (
            <button
              onClick={onRegister}
              className="btn-success flex items-center"
              disabled={isLoading || event.currentParticipants >= event.maxParticipants}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              我要报名
            </button>
          )}

          {event.status !== 'cancelled' && event.status !== 'completed' && (
            <>
              <button
                onClick={onEdit}
                className="btn-primary flex items-center"
                disabled={isLoading}
              >
                <Edit className="w-4 h-4 mr-2" />
                编辑活动
              </button>
              <button
                onClick={onCancelEvent}
                className="btn-danger flex items-center"
                disabled={isLoading}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                取消活动
              </button>
            </>
          )}

          <div className="relative group">
            <button
              className="btn-secondary flex items-center"
              disabled={exporting}
            >
              <Download className="w-4 h-4 mr-2" />
              导出报告
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 hidden group-hover:block z-10">
              <button
                onClick={() => handleExport('excel')}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center"
                disabled={exporting}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                导出 Excel
              </button>
              <button
                onClick={() => handleExport('markdown')}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center"
                disabled={exporting}
              >
                <FileText className="w-4 h-4 mr-2" />
                导出 Markdown
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center"
                disabled={exporting}
              >
                <File className="w-4 h-4 mr-2" />
                导出 PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
            <span className={`badge ${statusBadgeClass} mt-2`}>
              {event.status.toUpperCase()}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            版本: {event.version}
          </div>
        </div>

        {event.description && (
          <p className="text-gray-600 mb-6">{event.description}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center text-gray-500 mb-1">
              <Calendar className="w-4 h-4 mr-2" />
              开始时间
            </div>
            <p className="font-semibold">
              {dayjs(event.startTime).format('YYYY-MM-DD HH:mm')}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center text-gray-500 mb-1">
              <Calendar className="w-4 h-4 mr-2" />
              结束时间
            </div>
            <p className="font-semibold">
              {dayjs(event.endTime).format('YYYY-MM-DD HH:mm')}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center text-gray-500 mb-1">
              <Users className="w-4 h-4 mr-2" />
              已报名
            </div>
            <p className="font-semibold">
              {event.currentParticipants} / {event.maxParticipants}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center text-gray-500 mb-1">
              <File className="w-4 h-4 mr-2" />
              剩余名额
            </div>
            <p className="font-semibold">
              {Math.max(0, event.maxParticipants - event.currentParticipants)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">报名列表</h2>
        
        {registrations.length === 0 ? (
          <p className="text-gray-500 text-center py-8">暂无报名记录</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">#</th>
                  <th className="text-left py-3 px-4">姓名</th>
                  <th className="text-left py-3 px-4">邮箱</th>
                  <th className="text-left py-3 px-4">电话</th>
                  <th className="text-left py-3 px-4">状态</th>
                  <th className="text-left py-3 px-4">报名时间</th>
                  <th className="text-left py-3 px-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((reg, index) => (
                  <tr key={reg.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">{index + 1}</td>
                    <td className="py-3 px-4 font-medium">{reg.userName}</td>
                    <td className="py-3 px-4">{reg.userEmail}</td>
                    <td className="py-3 px-4">{reg.userPhone || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${regStatusBadgeClass(reg.status)}`}>
                        {reg.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {dayjs(reg.createdAt).format('YYYY-MM-DD HH:mm')}
                    </td>
                    <td className="py-3 px-4">
                      {reg.status === 'confirmed' && (
                        <button
                          onClick={() => onCancelRegistration(reg)}
                          className="text-red-600 hover:text-red-800 flex items-center"
                          disabled={isLoading}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">操作日志</h2>
        
        {loadingLog ? (
          <p className="text-gray-500 text-center py-4">加载中...</p>
        ) : logEntries.length === 0 ? (
          <p className="text-gray-500 text-center py-4">暂无操作记录</p>
        ) : (
          <div className="space-y-3">
            {logEntries.slice().reverse().map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 mt-2 rounded-full bg-blue-500"></div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-blue-600">
                      {entry.eventType}
                    </span>
                    <span className="text-sm text-gray-500">
                      {dayjs(entry.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    请求ID: {entry.requestId || '-'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {entry.aggregateType} - {entry.aggregateId.substring(0, 8)}...
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
