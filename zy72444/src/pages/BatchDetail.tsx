import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Box,
  BarChart3,
  FileText,
  ShieldCheck,
  XCircle,
  Users,
  Ticket,
  Image,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import ProcessTimeline from '@/components/ProcessTimeline';
import AlertCard from '@/components/AlertCard';
import NoteHistoryList from '@/components/NoteHistoryList';
import AttendanceTable from '@/components/AttendanceTable';
import ImportPanel from '@/components/ImportPanel';
import View3D from '@/components/View3D';
import ChartView from '@/components/ChartView';
import ReportView from '@/components/ReportView';
import type { AttendanceRecord } from '@/types';
import { formatDate, getTicketTypeLabel } from '@/utils';

type ViewMode = 'list' | '3d' | 'chart' | 'report';

export default function BatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getBatchById,
    getAttendanceByBatchId,
    getNoteHistoryByBatchId,
    getAlertsByBatchId,
    getProcessStepByBatchId,
    authorizeBatch,
    rejectBatch,
    currentRole,
    calcParams,
  } = useAppStore();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  const batch = getBatchById(id || '');
  const records = getAttendanceByBatchId(id || '');
  const histories = getNoteHistoryByBatchId(id || '');
  const alerts = getAlertsByBatchId(id || '');
  const processStep = getProcessStepByBatchId(id || '');

  if (!batch) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-primary-900">批次不存在</h2>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-primary-600 hover:text-primary-800"
        >
          返回首页
        </button>
      </div>
    );
  }

  const canAuthorize = currentRole === 'recorder' && batch.status !== 'authorized';

  const tabs: { mode: ViewMode; label: string; icon: any }[] = [
    { mode: 'list', label: '列表视图', icon: Users },
    { mode: '3d', label: '3D视图', icon: Box },
    { mode: 'chart', label: '图表视图', icon: BarChart3 },
    { mode: 'report', label: '查看报告', icon: FileText },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-lg hover:bg-primary-100 text-primary-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-primary-900">
            {batch.name}
          </h1>
          <p className="text-primary-500 mt-1">{formatDate(batch.date)}</p>
        </div>
        {canAuthorize && (
          <div className="flex gap-3">
            <button
              onClick={() => rejectBatch(batch.id)}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-all border border-red-200"
            >
              <XCircle className="w-5 h-5" />
              退回修改
            </button>
            <button
              onClick={() => authorizeBatch(batch.id)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200"
            >
              <ShieldCheck className="w-5 h-5" />
              确认授权
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 border border-white/50 flex items-center gap-3">
          <div className="p-2.5 bg-primary-100 rounded-lg">
            <Users className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-primary-900">{batch.totalCount}</p>
            <p className="text-xs text-primary-500">总人次</p>
          </div>
        </div>
        <div className="glass rounded-xl p-4 border border-white/50 flex items-center gap-3">
          <div className="p-2.5 bg-sky-100 rounded-lg">
            <Ticket className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-sky-800">{batch.freeTicketCount}</p>
            <p className="text-xs text-sky-500">{getTicketTypeLabel('free')}</p>
          </div>
        </div>
        <div className="glass rounded-xl p-4 border border-white/50 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 rounded-lg">
            <Ticket className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-800">{batch.paidTicketCount}</p>
            <p className="text-xs text-emerald-500">{getTicketTypeLabel('paid')}</p>
          </div>
        </div>
        <div className="glass rounded-xl p-4 border border-white/50 flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${batch.hasMixedType ? 'bg-accent-100' : 'bg-primary-100'}`}>
            <Image className={`w-5 h-5 ${batch.hasMixedType ? 'text-accent-600' : 'text-primary-600'}`} />
          </div>
          <div>
            <p className={`text-2xl font-bold ${batch.hasMixedType ? 'text-accent-800' : 'text-primary-900'}`}>
              {batch.hasMixedType ? '是' : '否'}
            </p>
            <p className="text-xs text-primary-500">混批状态</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <ImportPanel batchId={batch.id} type="photo" />
            <ImportPanel batchId={batch.id} type="ticket" />
          </div>

          <div className="glass rounded-2xl p-1 border border-white/50">
            <div className="flex gap-1 p-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.mode}
                    onClick={() => setViewMode(tab.mode)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      viewMode === tab.mode
                        ? 'bg-primary-500 text-white shadow-md'
                        : 'text-primary-600 hover:bg-primary-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {viewMode === 'list' && (
            <AttendanceTable records={records} />
          )}
          {viewMode === '3d' && (
            <View3D records={records} onSelectRecord={setSelectedRecord} />
          )}
          {viewMode === 'chart' && (
            <ChartView batch={batch} records={records} onSelectRecord={setSelectedRecord} />
          )}
          {viewMode === 'report' && (
            <ReportView batch={batch} records={records} calcParams={calcParams} />
          )}
        </div>

        <div className="space-y-6">
          {processStep && <ProcessTimeline processStep={processStep} />}

          {alerts.length > 0 && (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}

          <NoteHistoryList histories={histories} />
        </div>
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedRecord(null)}>
          <div className="glass rounded-2xl p-6 max-w-md w-full border border-white/50 shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl font-semibold text-primary-900 mb-4">
              原始记录详情
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-primary-100">
                <span className="text-primary-500">姓名</span>
                <span className="font-medium text-primary-900">{selectedRecord.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-primary-100">
                <span className="text-primary-500">票务类型</span>
                <span className="font-medium text-primary-900">{getTicketTypeLabel(selectedRecord.type)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-primary-100">
                <span className="text-primary-500">照片来源</span>
                <span className="font-medium text-primary-900 font-mono text-xs">{selectedRecord.sourcePhotoRef}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-primary-500">备注</span>
                <span className="font-medium text-primary-900">{selectedRecord.remark || '-'}</span>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Link
                to={`/batch/${batch.id}/report`}
                className="flex-1 text-center px-4 py-2.5 bg-primary-50 text-primary-700 rounded-xl font-medium hover:bg-primary-100 transition-colors"
                onClick={() => setSelectedRecord(null)}
              >
                查看完整报告
              </Link>
              <button
                onClick={() => setSelectedRecord(null)}
                className="flex-1 px-4 py-2.5 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
