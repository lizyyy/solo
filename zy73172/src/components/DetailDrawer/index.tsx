import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  attributionTypeColors,
  attributionTypeLabels,
  statusLabels,
} from '@/data/seedData';
import {
  X,
  User,
  BookOpen,
  Tag,
  RefreshCw,
  AlertTriangle,
  MoveRight,
  Edit3,
  Check,
} from 'lucide-react';
import type { RecordStatus } from '@/types';

export default function DetailDrawer() {
  const {
    records,
    selectedRecordId,
    selectRecord,
    moveRecordTo,
    recalcWithdrawn,
    graph,
    selectNode,
    updateRecordNote,
  } = useAppStore();

  const [toast, setToast] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  const allRecords = [...records.processed, ...records.pending, ...records.manual];
  const record = allRecords.find((r) => r.id === selectedRecordId);
  const node = record ? graph.nodes.find((n) => n.id === record.nodeId) : null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleRecalc = () => {
    if (!record) return;
    const result = recalcWithdrawn(record.id);
    showToast(result.message);
  };

  const handleMove = (target: RecordStatus) => {
    if (!record) return;
    moveRecordTo(record.id, target);
    showToast(`已移至「${statusLabels[target]}」`);
  };

  const handleOpenNote = () => {
    if (!record) return;
    setNoteDraft(record.note);
    setEditingNote(true);
  };

  const handleSaveNote = () => {
    if (!record) return;
    updateRecordNote(record.id, noteDraft);
    setEditingNote(false);
    showToast('备注已保存');
  };

  const isOpen = !!record;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pointer-events-none">
      <div
        className="absolute inset-0 bg-ink-900/20 pointer-events-auto"
        onClick={() => selectRecord(null)}
      />

      <div className="relative pointer-events-auto">
        <div className="mx-auto max-w-5xl px-4 pb-4">
          <div className="paper-card shadow-paper-lg overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-5 py-3 border-b border-paper-200 bg-paper-50/80">
              <div className="flex items-center gap-3">
                <h3 className="font-serif font-semibold text-ink-800 text-base">
                  错题明细
                </h3>
                <span className="tag bg-ink-100 text-ink-600">
                  {statusLabels[record.status]}
                </span>
                {record.isWithdrawn && (
                  <span className="tag bg-paper-200 text-paper-600">
                    撤回补录
                  </span>
                )}
                {record.isDuplicate && (
                  <span className="tag bg-ochre-100 text-ochre-700 flex items-center gap-1">
                    <AlertTriangle size={10} />
                    重复样本
                  </span>
                )}
              </div>
              <button
                onClick={() => selectRecord(null)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto scrollbar-thin">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-ink-400" />
                    <span className="text-sm text-ink-500">学生</span>
                    <span className="text-sm font-medium text-ink-800 ml-1">
                      {record.studentName}
                    </span>
                    <span className="text-xs text-ink-400">
                      （{record.studentId}）
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <BookOpen size={14} className="text-ink-400" />
                      <span className="text-sm text-ink-500">题目</span>
                    </div>
                    <p className="text-sm text-ink-800 font-medium leading-relaxed bg-paper-50 px-3 py-2 rounded-md border border-paper-200">
                      {record.questionTitle}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-ink-400 mb-1">学生作答</p>
                      <div className="bg-ochre-50 border border-ochre-200 rounded-md px-3 py-2 text-sm text-ochre-800">
                        {record.studentAnswer}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-ink-400 mb-1">正确答案</p>
                      <div className="bg-ink-50 border border-ink-200 rounded-md px-3 py-2 text-sm text-ink-800">
                        {record.correctAnswer}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-ink-400 mb-1.5">归因标签</p>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className="tag text-white"
                        style={{
                          backgroundColor: attributionTypeColors[record.attributionType],
                        }}
                      >
                        {attributionTypeLabels[record.attributionType]}
                      </span>
                      <span className="tag bg-paper-200 text-paper-700">
                        {record.attribution}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-ink-400 mb-1.5">关联知识点</p>
                    <button
                      onClick={() => {
                        selectNode(record.nodeId);
                        selectRecord(null);
                      }}
                      className="inline-flex items-center gap-1.5 text-sm text-ink-700 bg-ink-50 hover:bg-ink-100 px-3 py-1.5 rounded-md border border-ink-200 transition-colors"
                    >
                      <Tag size={12} />
                      {node?.name}
                      <MoveRight size={12} className="text-ink-400" />
                      <span className="text-ink-500 text-xs">查看路径</span>
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-ink-400">备注说明</p>
                      {!editingNote ? (
                        <button
                          onClick={handleOpenNote}
                          className="text-xs text-ink-500 hover:text-ink-700 flex items-center gap-1"
                        >
                          <Edit3 size={10} />
                          编辑
                        </button>
                      ) : (
                        <button
                          onClick={handleSaveNote}
                          className="text-xs text-ink-700 hover:text-ink-900 flex items-center gap-1 font-medium"
                        >
                          <Check size={10} />
                          保存
                        </button>
                      )}
                    </div>
                    {editingNote ? (
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-ink-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-ink-400/30 focus:border-ink-400 min-h-[72px]"
                        placeholder="添加备注..."
                      />
                    ) : (
                      <div className="bg-paper-50 border border-paper-200 rounded-md px-3 py-2 text-sm text-ink-700 min-h-[52px]">
                        {record.note || (
                          <span className="text-ink-400 italic">暂无备注</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-ink-400 space-y-0.5 pt-2 border-t border-paper-200">
                    <p>创建时间：{formatTime(record.createdAt)}</p>
                    <p>更新时间：{formatTime(record.updatedAt)}</p>
                    <p>记录编号：{record.id}</p>
                  </div>
                </div>
              </div>

              {record.isDuplicate && record.duplicateReason && (
                <div className="mt-5 bg-ochre-50 border border-ochre-200 rounded-md p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      size={16}
                      className="text-ochre-500 mt-0.5 flex-shrink-0"
                    />
                    <div>
                      <p className="text-sm font-medium text-ochre-800">
                        异常说明
                      </p>
                      <p className="text-sm text-ochre-700 mt-1">
                        {record.duplicateReason}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-t border-paper-200 bg-paper-50/60">
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-500">快捷操作：</span>
                {record.status !== 'processed' && (
                  <button
                    onClick={() => handleMove('processed')}
                    className="btn-secondary text-xs !px-3 !py-1.5"
                  >
                    移至已处理
                  </button>
                )}
                {record.status !== 'pending' && (
                  <button
                    onClick={() => handleMove('pending')}
                    className="btn-secondary text-xs !px-3 !py-1.5"
                  >
                    移至待补
                  </button>
                )}
                {record.status !== 'manual' && (
                  <button
                    onClick={() => handleMove('manual')}
                    className="btn-secondary text-xs !px-3 !py-1.5"
                  >
                    移至人工改判
                  </button>
                )}
              </div>

              {record.isWithdrawn && (
                <button
                  onClick={handleRecalc}
                  className="btn-primary text-xs !px-4 !py-1.5 flex items-center gap-1.5"
                >
                  <RefreshCw size={12} />
                  撤回复算
                </button>
              )}
            </div>
          </div>
        </div>

        {toast && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-3 bg-ink-800 text-white text-sm px-4 py-2 rounded-md shadow-lg animate-fade-in">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
