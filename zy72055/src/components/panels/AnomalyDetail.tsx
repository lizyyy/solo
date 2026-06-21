import { useState, useRef, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  MapPin,
  FileText,
  Image,
  User,
  Calendar,
  Plus,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  GitCompare,
  Copy,
  Users,
} from 'lucide-react';
import type { Anomaly, InspectionRecord, AnomalyStatus, ProcessNote } from '../../types';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  ANOMALY_TYPE_LABELS,
  SEVERITY_LABELS,
} from '../../types';
import { formatPosition } from '../../utils/coordinate';
import { diffStrings, renderDiff } from '../../utils/diff';

interface AnomalyDetailProps {
  anomaly: Anomaly;
  record: InspectionRecord | undefined;
  highlightedRow: number | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: AnomalyStatus, note: string) => void;
  onAddSupplement: (id: string, content: string) => void;
  onHighlightRow: (row: number | null) => void;
}

const statusIcons: Record<AnomalyStatus, typeof AlertTriangle> = {
  pending: AlertTriangle,
  processing: Clock,
  completed: CheckCircle,
  rework: RefreshCw,
};

export function AnomalyDetail({
  anomaly,
  record,
  highlightedRow,
  onClose,
  onUpdateStatus,
  onAddSupplement,
  onHighlightRow,
}: AnomalyDetailProps) {
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<AnomalyStatus>(anomaly.status);
  const [statusNote, setStatusNote] = useState('');
  const [supplementContent, setSupplementContent] = useState('');
  const [showRawData, setShowRawData] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const notesEndRef = useRef<HTMLDivElement>(null);
  
  const StatusIcon = statusIcons[anomaly.status];
  
  useEffect(() => {
    if (notesEndRef.current) {
      notesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [anomaly.notes.length]);
  
  const handleStatusChange = () => {
    if (statusNote.trim()) {
      onUpdateStatus(anomaly.id, newStatus, statusNote.trim());
      setShowStatusModal(false);
      setStatusNote('');
    }
  };
  
  const handleAddSupplement = () => {
    if (supplementContent.trim()) {
      onAddSupplement(anomaly.id, supplementContent.trim());
      setSupplementContent('');
    }
  };
  
  const toggleNoteExpanded = (noteId: string) => {
    const newSet = new Set(expandedNotes);
    if (newSet.has(noteId)) {
      newSet.delete(noteId);
    } else {
      newSet.add(noteId);
    }
    setExpandedNotes(newSet);
  };
  
  const renderDiffForNote = (note: ProcessNote) => {
    if (!note.isSupplement || !note.previousContent) return null;
    
    const segments = diffStrings(note.previousContent, note.content);
    const html = renderDiff(segments);
    
    return (
      <div
        className="mt-2 p-2 bg-green-500/10 rounded text-xs"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };
  
  return (
    <div className="h-full flex flex-col bg-slate-900/95 backdrop-blur">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: STATUS_COLORS[anomaly.status] + '30' }}
          >
            <StatusIcon
              className="w-5 h-5"
              style={{ color: STATUS_COLORS[anomaly.status] }}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              {ANOMALY_TYPE_LABELS[anomaly.type]}
            </h3>
            <p className="text-xs text-slate-500 font-mono">{anomaly.id}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <MapPin className="w-3 h-3" />
              上报位置
            </div>
            <p className="text-sm text-slate-300 font-mono">
              {formatPosition(anomaly.reportedPosition)}
            </p>
          </div>
          
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <AlertTriangle className="w-3 h-3" />
              严重程度
            </div>
            <p className={`text-sm font-medium ${
              anomaly.severity === 'critical' ? 'text-red-400' :
              anomaly.severity === 'warning' ? 'text-yellow-400' : 'text-blue-400'
            }`}>
              {SEVERITY_LABELS[anomaly.severity]}
            </p>
          </div>
          
          {anomaly.offsetDistance && (
            <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30 col-span-2">
              <div className="flex items-center gap-1.5 text-xs text-red-400 mb-1">
                <GitCompare className="w-3 h-3" />
                坐标偏移距离
              </div>
              <p className="text-lg font-bold text-red-400 font-mono">
                {anomaly.offsetDistance.toFixed(2)} m
              </p>
            </div>
          )}
          
          {anomaly.nullField && (
            <div className="p-3 bg-pink-500/10 rounded-lg border border-pink-500/30 col-span-2">
              <div className="flex items-center gap-1.5 text-xs text-pink-400 mb-1">
                <AlertTriangle className="w-3 h-3" />
                空值字段
              </div>
              <p className="text-sm text-pink-400 font-mono">
                {anomaly.nullField}
              </p>
            </div>
          )}
          
          {anomaly.duplicateNames && anomaly.duplicateNames.length > 0 && (
            <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30 col-span-2">
              <div className="flex items-center gap-1.5 text-xs text-yellow-400 mb-2">
                <Users className="w-3 h-3" />
                重名设备变体
              </div>
              <div className="space-y-1">
                {anomaly.duplicateNames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                      name === record?.deviceName
                        ? 'bg-yellow-500/20 text-yellow-300'
                        : 'bg-slate-700 text-slate-400'
                    }`}>
                      {name}
                    </span>
                    {name === record?.deviceName && (
                      <span className="text-xs text-yellow-500">当前记录</span>
                    )}
                  </div>
                ))}
              </div>
              {anomaly.relatedAnomalyIds.length > 0 && (
                <p className="text-xs text-slate-500 mt-2">
                  关联异常: {anomaly.relatedAnomalyIds.length} 条
                </p>
              )}
            </div>
          )}
          
          {anomaly.isDuplicate && anomaly.duplicateOf && (
            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30 col-span-2">
              <div className="flex items-center gap-1.5 text-xs text-blue-400 mb-1">
                <Copy className="w-3 h-3" />
                重复记录
              </div>
              <p className="text-sm text-blue-400">
                此记录与主记录重复，主记录ID: {anomaly.duplicateOf}
              </p>
            </div>
          )}
        </div>
        
        {record && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                原始记录
              </h4>
              <button
                onClick={() => onHighlightRow(highlightedRow === record.sourceRow ? null : record.sourceRow)}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                  highlightedRow === record.sourceRow
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                <ExternalLink className="w-3 h-3" />
                来源行 #{record.sourceRow}
              </button>
            </div>
            
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">设备名称:</span>
                  <span className="ml-2 text-slate-300">{record.deviceName}</span>
                </div>
                <div>
                  <span className="text-slate-500">设备类型:</span>
                  <span className="ml-2 text-slate-300">{record.deviceType || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500">楼层:</span>
                  <span className="ml-2 text-slate-300">{record.floor}</span>
                </div>
                <div>
                  <span className="text-slate-500">异常类型:</span>
                  <span className="ml-2 text-slate-300">{record.anomalyType}</span>
                </div>
              </div>
              
              <div className="pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-500 mb-1">问题描述:</p>
                <p className="text-sm text-slate-300">{record.description}</p>
              </div>
              
              <div className="pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-500 mb-1">巡检照片:</p>
                {record.photoUrl ? (
                  <img
                    src={record.photoUrl}
                    alt="巡检照片"
                    className="w-full h-32 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-24 bg-slate-800 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-600">
                    <div className="text-center">
                      <Image className="w-8 h-8 text-slate-600 mx-auto mb-1" />
                      <p className="text-xs text-slate-500">无照片</p>
                    </div>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => setShowRawData(!showRawData)}
                className="w-full flex items-center justify-center gap-1 py-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
              >
                {showRawData ? (
                  <><ChevronUp className="w-3 h-3" /> 收起原始数据</>
                ) : (
                  <><ChevronDown className="w-3 h-3" /> 查看完整原始数据</>
                )}
              </button>
              
              {showRawData && (
                <div className="p-2 bg-slate-900 rounded-lg overflow-x-auto">
                  <pre className="text-xs text-slate-400 whitespace-pre-wrap">
                    {JSON.stringify(record, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-400" />
              处理记录
            </h4>
            <button
              onClick={() => setShowStatusModal(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors"
            >
              <Plus className="w-3 h-3" />
              更新状态
            </button>
          </div>
          
          {anomaly.notes.length === 0 ? (
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
              <p className="text-sm text-slate-500">暂无处理记录</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {anomaly.notes.map((note) => (
                <div
                  key={note.id}
                  className={`p-3 rounded-lg border ${
                    note.isSupplement
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-slate-800/50 border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {note.isSupplement && (
                        <span className="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-400 rounded font-medium">
                          补录
                        </span>
                      )}
                      {note.statusChange && (
                        <span
                          className="px-1.5 py-0.5 text-xs rounded font-medium"
                          style={{
                            backgroundColor: STATUS_COLORS[note.statusChange] + '20',
                            color: STATUS_COLORS[note.statusChange],
                          }}
                        >
                          {STATUS_LABELS[note.statusChange]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <User className="w-3 h-3" />
                      {note.operator}
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-300 mt-2">{note.content}</p>
                  
                  {note.isSupplement && note.previousContent && (
                    <button
                      onClick={() => toggleNoteExpanded(note.id)}
                      className="mt-2 flex items-center gap-1 text-xs text-green-400 hover:text-green-300"
                    >
                      <GitCompare className="w-3 h-3" />
                      {expandedNotes.has(note.id) ? '收起差异' : '查看差异'}
                    </button>
                  )}
                  
                  {expandedNotes.has(note.id) && renderDiffForNote(note)}
                  
                  <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                    <Calendar className="w-3 h-3" />
                    {note.timestamp}
                  </div>
                </div>
              ))}
              <div ref={notesEndRef} />
            </div>
          )}
          
          <div className="space-y-2">
            <textarea
              value={supplementContent}
              onChange={(e) => setSupplementContent(e.target.value)}
              placeholder="临时补录备注..."
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              rows={3}
            />
            <button
              onClick={handleAddSupplement}
              disabled={!supplementContent.trim()}
              className="w-full py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              补录备注
            </button>
          </div>
        </div>
      </div>
      
      {showStatusModal && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">更新处理状态</h3>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-400">选择状态</label>
              <div className="grid grid-cols-2 gap-2">
                {(['pending', 'processing', 'completed', 'rework'] as AnomalyStatus[]).map((status) => {
                  const Icon = statusIcons[status];
                  return (
                    <button
                      key={status}
                      onClick={() => setNewStatus(status)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        newStatus === status
                          ? 'border-current'
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                      style={{
                        borderColor: newStatus === status ? STATUS_COLORS[status] : undefined,
                        backgroundColor: newStatus === status ? STATUS_COLORS[status] + '10' : undefined,
                      }}
                    >
                      <Icon
                        className="w-5 h-5 mx-auto mb-1"
                        style={{ color: STATUS_COLORS[status] }}
                      />
                      <p
                        className="text-xs font-medium"
                        style={{ color: STATUS_COLORS[status] }}
                      >
                        {STATUS_LABELS[status]}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-400">处理备注</label>
              <textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="请输入处理说明..."
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                rows={3}
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setStatusNote('');
                }}
                className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleStatusChange}
                disabled={!statusNote.trim()}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认更新
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
