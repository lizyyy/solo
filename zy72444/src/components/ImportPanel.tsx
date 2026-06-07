import { useState } from 'react';
import { Upload, Image, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import type { AttendanceRecord, TicketRecord } from '@/types';

interface ImportPanelProps {
  batchId: string;
  type: 'photo' | 'ticket';
  onSuccess?: () => void;
}

export default function ImportPanel({ batchId, type, onSuccess }: ImportPanelProps) {
  const { importAttendancePhoto, importTicketExport } = useAppStore();
  const [status, setStatus] = useState<'idle' | 'importing' | 'success' | 'duplicate' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const sampleAttendance: Omit<AttendanceRecord, 'id' | 'batchId' | 'createdAt'>[] = [
    { name: '测试学生A', type: 'paid', sourcePhotoRef: 'test-row-1-col-1', remark: '测试导入-售票' },
    { name: '测试学生B', type: 'free', sourcePhotoRef: 'test-row-1-col-2', remark: '测试导入-赠票' },
    { name: '测试学生C', type: 'paid', sourcePhotoRef: 'test-row-1-col-3' },
    { name: '测试学生D', type: 'paid', sourcePhotoRef: 'test-row-2-col-1' },
    { name: '测试学生E', type: 'free', sourcePhotoRef: 'test-row-2-col-2', remark: '测试导入-赠票2' },
  ];

  const sampleTickets: Omit<TicketRecord, 'id' | 'batchId' | 'createdAt'>[] = [
    { ticketNo: 'TEST001', type: 'paid', purchaser: '测试家长A', sourceExportRef: 'export-1' },
    { ticketNo: 'TEST002', type: 'free', purchaser: '测试机构', sourceExportRef: 'export-2' },
  ];

  const handleImport = () => {
    setStatus('importing');
    setMessage('');

    setTimeout(() => {
      if (type === 'photo') {
        const photoContent = `photo-${batchId}-${Date.now()}`;
        const result = importAttendancePhoto(batchId, photoContent, sampleAttendance);
        setMessage(result.message);
        setStatus(result.isDuplicate ? 'duplicate' : result.success ? 'success' : 'error');
      } else {
        const exportContent = `ticket-${batchId}-${Date.now()}`;
        const result = importTicketExport(batchId, exportContent, sampleTickets);
        setMessage(result.message);
        setStatus(result.isDuplicate ? 'duplicate' : result.success ? 'success' : 'error');
      }
      onSuccess?.();
    }, 1000);
  };

  const statusConfig = {
    idle: {
      icon: type === 'photo' ? Image : FileSpreadsheet,
      color: 'text-primary-600',
      bg: 'bg-primary-100',
      btn: 'bg-primary-500 hover:bg-primary-600',
    },
    importing: {
      icon: Upload,
      color: 'text-primary-600',
      bg: 'bg-primary-100',
      btn: 'bg-primary-400 cursor-not-allowed',
    },
    success: {
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100',
      btn: 'bg-emerald-500',
    },
    duplicate: {
      icon: AlertCircle,
      color: 'text-amber-600',
      bg: 'bg-amber-100',
      btn: 'bg-amber-500',
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-100',
      btn: 'bg-red-500',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="glass rounded-2xl p-5 border border-white/50">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${config.bg}`}>
          <Icon className={`w-6 h-6 ${config.color} ${status === 'importing' ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-primary-900">
            {type === 'photo' ? '课时签到照片' : '票务导出表'}
          </h4>
          {message ? (
            <p className={`text-sm mt-0.5 ${config.color}`}>{message}</p>
          ) : (
            <p className="text-sm text-primary-500 mt-0.5">
              {type === 'photo' ? '支持JPG/PNG格式，系统自动识别签到人员' : '支持Excel/CSV格式，系统自动核对票务信息'}
            </p>
          )}
        </div>
        <button
          onClick={handleImport}
          disabled={status === 'importing' || status === 'success'}
          className={`px-5 py-2.5 text-white rounded-xl font-medium transition-all shadow-md ${config.btn} ${
            status === 'success' ? 'cursor-default' : ''
          }`}
        >
          {status === 'idle' && (
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {type === 'photo' ? '模拟导入' : '模拟导入'}
            </span>
          )}
          {status === 'importing' && '导入中...'}
          {status === 'success' && '已完成'}
          {status === 'duplicate' && '已跳过'}
          {status === 'error' && '重试'}
        </button>
      </div>
    </div>
  );
}
