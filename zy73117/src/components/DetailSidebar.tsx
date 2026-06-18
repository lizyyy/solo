import { useState, useMemo } from 'react';
import { X, Undo2, GitBranch, StickyNote, Camera, CheckCircle, AlertTriangle, Clock, History, FileText, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useStore } from '@/store/useStore';
import { TimelineItem } from './TimelineItem';
import { WithdrawDialog } from './WithdrawDialog';
import { ChangeRecordDialog } from './ChangeRecordDialog';
import { ScreenshotDialog } from './ScreenshotDialog';
import { STATUS_LABELS, STATUS_COLORS } from '@/types';
import { getTraceChainSummary, getRecordsForMaterial } from '@/utils/traceEngine';

export function DetailSidebar() {
  const materials = useStore((state) => state.materials);
  const records = useStore((state) => state.records);
  const selectedMaterialId = useStore((state) => state.selectedMaterialId);
  const expandedRecordId = useStore((state) => state.expandedRecordId);
  const selectMaterial = useStore((state) => state.selectMaterial);
  const expandRecord = useStore((state) => state.expandRecord);
  const updateMaterialNote = useStore((state) => state.updateMaterialNote);
  const resolvePending = useStore((state) => state.resolvePending);
  const addNotification = useStore((state) => state.addNotification);

  const selectedMaterial = useMemo(() => {
    return materials.find(m => m.id === selectedMaterialId);
  }, [materials, selectedMaterialId]);

  const selectedRecords = useMemo(() => {
    if (!selectedMaterialId) return [];
    return getRecordsForMaterial(selectedMaterialId, records);
  }, [selectedMaterialId, records]);

  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [showScreenshotDialog, setShowScreenshotDialog] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState('');

  if (!selectedMaterial) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-industrial-500 bg-industrial-900 border-l border-industrial-700">
        <FileText className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-sm">从左侧列表选择材料查看详情</p>
        <p className="text-xs mt-1">包含完整变更时间线和追溯信息</p>
      </div>
    );
  }

  const traceSummary = getTraceChainSummary(selectedMaterial, records);

  const handleSaveNote = () => {
    updateMaterialNote(selectedMaterial.id, noteText);
    setEditingNote(false);
    addNotification({
      type: 'success',
      title: '备注已保存',
      message: '人工备注已更新',
    });
  };

  const handleResolvePending = () => {
    resolvePending(selectedMaterial.id);
  };

  return (
    <div className="h-full flex flex-col bg-industrial-900 border-l border-industrial-700 animate-slide-in-right">
      <div className="p-4 border-b border-industrial-700 flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className={`status-dot ${STATUS_COLORS[selectedMaterial.status]} ${selectedMaterial.status === 'exception' ? 'animate-pulse' : ''}`} />
            <span
              className={`text-xs font-medium ${
                selectedMaterial.status === 'normal'
                  ? 'text-success-400'
                  : selectedMaterial.status === 'withdrawn'
                  ? 'text-danger-400'
                  : selectedMaterial.status === 'changed'
                  ? 'text-primary-400'
                  : 'text-warning-400'
              }`}
            >
              {STATUS_LABELS[selectedMaterial.status]}
            </span>
            {selectedMaterial.isPending && (
              <span className="chip bg-warning-900/50 border-warning-600 text-warning-300 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                待处理
              </span>
            )}
          </div>
          <h2 className="text-lg font-semibold text-industrial-100 mb-1">
            {selectedMaterial.projectName}
          </h2>
          <div className="flex items-center gap-2 text-xs text-industrial-400">
            <span className="font-mono">{selectedMaterial.buildingNo}</span>
            <span className="text-industrial-600">·</span>
            <span>{selectedMaterial.materialType}</span>
            <span className="text-industrial-600">·</span>
            <span className="font-mono">{selectedMaterial.surveyNo}</span>
          </div>
        </div>
        <button
          onClick={() => selectMaterial(null)}
          className="p-1.5 hover:bg-industrial-700 rounded transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4 text-industrial-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-industrial-800 rounded p-3 border border-industrial-700">
              <div className="flex items-center gap-1.5 text-xs text-industrial-500 mb-1">
                <User className="w-3 h-3" />
                操作人
              </div>
              <p className="text-sm text-industrial-200">
                {selectedRecords[selectedRecords.length - 1]?.operator || '—'}
              </p>
            </div>
            <div className="bg-industrial-800 rounded p-3 border border-industrial-700">
              <div className="flex items-center gap-1.5 text-xs text-industrial-500 mb-1">
                <Calendar className="w-3 h-3" />
                导入日期
              </div>
              <p className="text-sm text-industrial-200 font-mono">
                {format(new Date(selectedMaterial.importDate), 'yyyy-MM-dd', { locale: zhCN })}
              </p>
            </div>
          </div>

          <div className="bg-industrial-800 rounded p-3 border border-industrial-700">
            <div className="flex items-center gap-1.5 text-xs text-industrial-500 mb-1">
              <History className="w-3 h-3" />
              追踪摘要
            </div>
            <p className="text-sm text-industrial-200">{traceSummary}</p>
          </div>

          <div className="bg-primary-900/20 rounded p-3 border border-primary-700/50">
            <div className="flex items-center gap-1.5 text-xs text-primary-400 mb-1">
              <FileText className="w-3 h-3" />
              当前结论
            </div>
            <p className="text-sm text-primary-200">{selectedMaterial.currentConclusion}</p>
            {selectedMaterial.originalConclusion !== selectedMaterial.currentConclusion && (
              <p className="text-xs text-industrial-500 mt-2 line-through">
                原始结论：{selectedMaterial.originalConclusion}
              </p>
            )}
          </div>

          {selectedMaterial.status === 'exception' && (
            <div className="bg-warning-900/20 rounded p-3 border border-warning-700/50">
              <div className="flex items-center gap-1.5 text-xs text-warning-400 mb-2">
                <AlertTriangle className="w-3 h-3" />
                异常原因
              </div>
              <p className="text-sm text-warning-200 mb-3">{selectedMaterial.exceptionReason}</p>
              <div className="bg-industrial-900/50 rounded p-2 border border-industrial-700">
                <p className="text-xs text-industrial-400 mb-1">下一步处理：</p>
                <p className="text-sm text-industrial-200 whitespace-pre-line">{selectedMaterial.nextStep}</p>
              </div>
              {selectedMaterial.isPending && (
                <button
                  onClick={handleResolvePending}
                  className="mt-3 w-full btn-primary flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  标记为已处理
                </button>
              )}
            </div>
          )}

          <div className="bg-industrial-800 rounded p-3 border border-industrial-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs text-industrial-500">
                <StickyNote className="w-3 h-3" />
                人工备注
              </div>
              {!editingNote && (
                <button
                  onClick={() => {
                    setNoteText(selectedMaterial.manualNote);
                    setEditingNote(true);
                  }}
                  className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                >
                  {selectedMaterial.manualNote ? '编辑' : '添加'}
                </button>
              )}
            </div>
            {editingNote ? (
              <div className="space-y-2">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="请输入备注内容..."
                  className="input-field resize-none h-20"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveNote} className="btn-primary text-xs py-1.5">
                    保存
                  </button>
                  <button
                    onClick={() => setEditingNote(false)}
                    className="btn-secondary text-xs py-1.5"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-industrial-200">
                {selectedMaterial.manualNote || (
                  <span className="text-industrial-500 italic">暂无备注</span>
                )}
              </p>
            )}
          </div>

          <div className="bg-industrial-800 rounded p-3 border border-industrial-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs text-industrial-500">
                <Camera className="w-3 h-3" />
                截图说明
              </div>
              <button
                onClick={() => setShowScreenshotDialog(true)}
                className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
              >
                {selectedMaterial.screenshotUrl ? '编辑' : '上传'}
              </button>
            </div>
            {selectedMaterial.screenshotUrl ? (
              <div className="space-y-2">
                <img
                  src={selectedMaterial.screenshotUrl}
                  alt="截图说明"
                  className="w-full rounded border border-industrial-600 max-h-48 object-contain bg-industrial-900 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(selectedMaterial.screenshotUrl, '_blank')}
                />
                <p className="text-xs text-industrial-300">{selectedMaterial.screenshotNote}</p>
              </div>
            ) : (
              <p className="text-sm text-industrial-500 italic">暂无截图说明</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowWithdrawDialog(true)}
              className="flex-1 btn-danger flex items-center justify-center gap-1.5 text-xs py-2"
            >
              <Undo2 className="w-3.5 h-3.5" />
              撤回
            </button>
            <button
              onClick={() => setShowChangeDialog(true)}
              className="flex-1 btn-primary flex items-center justify-center gap-1.5 text-xs py-2"
            >
              <GitBranch className="w-3.5 h-3.5" />
              变更
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-industrial-700">
          <h3 className="text-sm font-semibold text-industrial-200 mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-primary-400" />
            变更时间线
            <span className="text-xs font-normal text-industrial-500">
              ({selectedRecords.length}条记录)
            </span>
          </h3>
          <div className="space-y-1">
            {selectedRecords.map((record, index) => (
              <TimelineItem
                key={record.id}
                record={record}
                allRecords={records}
                isExpanded={expandedRecordId === record.id}
                isLast={index === selectedRecords.length - 1}
                onToggle={() => expandRecord(record.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {showWithdrawDialog && (
        <WithdrawDialog
          materialId={selectedMaterial.id}
          currentConclusion={selectedMaterial.currentConclusion}
          onClose={() => setShowWithdrawDialog(false)}
        />
      )}
      {showChangeDialog && (
        <ChangeRecordDialog
          materialId={selectedMaterial.id}
          previousConclusion={selectedMaterial.currentConclusion}
          onClose={() => setShowChangeDialog(false)}
        />
      )}
      {showScreenshotDialog && (
        <ScreenshotDialog
          materialId={selectedMaterial.id}
          currentScreenshotUrl={selectedMaterial.screenshotUrl}
          currentScreenshotNote={selectedMaterial.screenshotNote}
          onClose={() => setShowScreenshotDialog(false)}
        />
      )}
    </div>
  );
}
