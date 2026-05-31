import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Check,
  Clock,
  AlertTriangle,
  Edit3,
  Music,
  FileText,
  Hand,
  Calendar,
  User,
  Hash,
  Gauge,
  MessageSquare,
  RefreshCw,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { StatusBadge } from '../components/ui/StatusBadge';
import { SourceTag } from '../components/ui/SourceTag';
import { FriendlyErrorMessage } from '../components/ui/FriendlyErrorMessage';
import { RecordStatus, ChangeType, DataSource } from '../types';
import { useToast } from '../components/ui/Toast';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, warning } = useToast();

  const {
    records,
    changeLogs,
    mismatchRecords,
    updateRecord,
    updateRecordStatus,
    getChangeLogsForRecord,
    getMismatchesForRecord,
  } = useStore();

  const record = records.find((r) => r.id === id);
  const recordChangeLogs = record ? getChangeLogsForRecord(record.id) : [];
  const recordMismatches = record ? getMismatchesForRecord(record.id).filter((m) => m.status === 'pending') : [];

  if (!record) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">记录不存在</h3>
        <p className="text-gray-500 mb-4">找不到ID为 {id} 的记录</p>
        <Link to="/" className="btn btn-primary">
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </Link>
      </div>
    );
  }

  const handleConfirm = () => {
    updateRecordStatus(record.id, RecordStatus.CONFIRMED);
    success('记录已确认');
  };

  const handleMarkToFill = () => {
    updateRecordStatus(record.id, RecordStatus.TO_FILL);
    success('已标记为待补');
  };

  const handleEdit = () => {
    navigate(`/records/new?edit=${record.id}`);
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      measureStart: '起始小节',
      measureEnd: '结束小节',
      tempo: '速度',
      status: '状态',
      source: '来源',
      remarks: '备注',
      isDuplicate: '重复标记',
      studentId: '学生',
    };
    return labels[field] || field;
  };

  const getSourceIcon = (source: DataSource) => {
    const icons = {
      [DataSource.METRONOME]: <Music className="w-4 h-4" />,
      [DataSource.MUSIC_SHEET]: <FileText className="w-4 h-4" />,
      [DataSource.MANUAL]: <Hand className="w-4 h-4" />,
    };
    return icons[source];
  };

  const duplicateRecord = record.duplicateOfId ? records.find((r) => r.id === record.duplicateOfId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-serif font-bold text-gray-900">记录详情</h2>
            <p className="text-sm text-gray-500 mt-1">ID: {record.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {record.status !== RecordStatus.CONFIRMED && (
            <button onClick={handleConfirm} className="btn btn-success">
              <Check className="w-4 h-4" />
              确认记录
            </button>
          )}
          {record.status !== RecordStatus.TO_FILL && (
            <button onClick={handleMarkToFill} className="btn btn-warning">
              <AlertTriangle className="w-4 h-4" />
              标记待补
            </button>
          )}
          <button onClick={handleEdit} className="btn btn-secondary">
            <Edit className="w-4 h-4" />
            编辑
          </button>
        </div>
      </div>

      {recordMismatches.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning-500" />
            检测到的问题
          </h3>
          {recordMismatches.map((mismatch) => (
            <FriendlyErrorMessage
              key={mismatch.id}
              error={{
                id: mismatch.id,
                level: 'warning',
                message: `⚠️ ${mismatch.description}`,
                suggestion: `建议：${mismatch.suggestedHandler}`,
              }}
            />
          ))}
        </div>
      )}

      {record.isDuplicate && duplicateRecord && (
        <FriendlyErrorMessage
          error={{
            id: 'dup-warning',
            level: 'warning',
            message: `⚠️ 这条记录和 ${duplicateRecord.studentName} 的另一条记录（小节 ${duplicateRecord.measureStart}-${duplicateRecord.measureEnd}）有重叠`,
            suggestion: '请确认是否为同一段演奏。如果是分谱不同，请在备注中说明。',
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-serif font-semibold text-gray-900 mb-4">基本信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  学生姓名
                </label>
                <p className="font-medium text-gray-900">{record.studentName}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5" />
                  声部
                </label>
                <p className="font-medium text-gray-900">{record.sectionName}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  排练日期
                </label>
                <p className="font-medium text-gray-900">
                  {format(new Date(record.rehearsalDate), 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" />
                  小节范围
                </label>
                <p className={`font-mono font-medium ${record.measureStart > record.measureEnd ? 'text-red-600' : 'text-gray-900'}`}>
                  {record.measureStart} - {record.measureEnd}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5" />
                  速度 (♩=)
                </label>
                <p className={`font-mono font-medium ${record.tempo < 40 || record.tempo > 200 ? 'text-red-600' : 'text-gray-900'}`}>
                  {record.tempo}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  状态
                </label>
                <StatusBadge status={record.status} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  {getSourceIcon(record.source)}
                  数据来源
                </label>
                <SourceTag source={record.source} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  录入人
                </label>
                <p className="font-medium text-gray-900">{record.createdBy}</p>
              </div>
            </div>

            {record.remarks && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5 mb-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  备注
                </label>
                <p className="text-gray-700 bg-gray-50 rounded-lg p-3">{record.remarks}</p>
              </div>
            )}
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-serif font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-accent-500" />
              变更历史
            </h3>
            
            {recordChangeLogs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暂无变更记录</p>
            ) : (
              <div className="relative pl-8">
                <div className="timeline-line" />
                <div className="space-y-6">
                  {recordChangeLogs.map((log, index) => (
                    <div
                      key={log.id}
                      className="relative"
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      <div
                        className={`timeline-dot ${log.changeType === ChangeType.SYSTEM ? 'timeline-dot-system' : 'timeline-dot-manual'}`}
                      />
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            log.changeType === ChangeType.SYSTEM
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-accent-100 text-accent-700'
                          }`}>
                            {log.changeType === ChangeType.SYSTEM ? '系统自动' : '人工修改'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {format(new Date(log.changedAt), 'MM-dd HH:mm')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{log.changedBy}</span>{' '}
                          将 <span className="font-mono bg-gray-200 px-1 rounded">{getFieldLabel(log.fieldName)}</span>{' '}
                          从 <span className="line-through text-red-600">{log.oldValue || '(空)'}</span>{' '}
                          改为 <span className="text-success-700 font-medium">{log.newValue || '(空)'}</span>
                        </p>
                        {log.reason && (
                          <p className="mt-1 text-xs text-gray-500 flex items-start gap-1.5">
                            <MessageSquare className="w-3 h-3 mt-0.5" />
                            {log.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">来源追溯</h3>
            <div className="flex items-center gap-3 p-4 rounded-lg" style={{
              backgroundColor: record.source === DataSource.METRONOME ? '#eff6ff' 
                : record.source === DataSource.MUSIC_SHEET ? '#fff7ed'
                : '#f9fafb'
            }}>
              <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                {getSourceIcon(record.source)}
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {record.source === DataSource.METRONOME && '来自节拍器记录'}
                  {record.source === DataSource.MUSIC_SHEET && '来自选曲表'}
                  {record.source === DataSource.MANUAL && '手工录入'}
                </p>
                <p className="text-xs text-gray-500">
                  创建于 {format(new Date(record.createdAt), 'MM-dd HH:mm')}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              {record.source === DataSource.METRONOME && '此数据由节拍器自动记录，可信度较高。如无特殊情况，建议直接确认。'}
              {record.source === DataSource.MUSIC_SHEET && '此数据根据选曲表填写，可能存在晚补情况。请核对实际演奏情况。'}
              {record.source === DataSource.MANUAL && '此数据为手工录入，建议仔细核对后再确认。'}
            </p>
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">快速操作</h3>
            <div className="space-y-2">
              <button
                onClick={handleConfirm}
                disabled={record.status === RecordStatus.CONFIRMED}
                className="w-full btn btn-success text-sm justify-start"
              >
                <Check className="w-4 h-4" />
                确认此记录
              </button>
              <button
                onClick={handleMarkToFill}
                disabled={record.status === RecordStatus.TO_FILL}
                className="w-full btn btn-warning text-sm justify-start"
              >
                <AlertTriangle className="w-4 h-4" />
                标记为待补
              </button>
              <button
                onClick={handleEdit}
                className="w-full btn btn-secondary text-sm justify-start"
              >
                <Edit className="w-4 h-4" />
                编辑记录
              </button>
              <button
                onClick={() => navigate('/mismatch')}
                className="w-full btn btn-ghost text-sm justify-start"
              >
                <AlertTriangle className="w-4 h-4 text-warning-500" />
                查看所有错位
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
