import { Check, Pause, Edit3, Undo2, MessageSquare, X } from 'lucide-react';
import { useState } from 'react';
import { RecordStatus, InvestmentRecord } from '../../types';
import { useRecordStore } from '../../store/recordStore';

interface ActionBarProps {
  record: InvestmentRecord;
}

export default function ActionBar({ record }: ActionBarProps) {
  const { confirmRecord, suspendRecord, adjustRecord, rollbackRecord, addNote } = useRecordStore();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [diffNote, setDiffNote] = useState('');
  const [adjustAmount, setAdjustAmount] = useState(record.amount.toString());
  const [adjustSuggestion, setAdjustSuggestion] = useState(record.suggestion);
  const [noteContent, setNoteContent] = useState('');

  const handleConfirm = () => {
    if (!diffNote.trim()) return;
    confirmRecord(record.id, diffNote);
    setDiffNote('');
    setShowConfirmModal(false);
  };

  const handleSuspend = () => {
    if (!diffNote.trim()) return;
    suspendRecord(record.id, diffNote);
    setDiffNote('');
    setShowSuspendModal(false);
  };

  const handleAdjust = () => {
    if (!diffNote.trim() || !adjustAmount) return;
    adjustRecord(record.id, Number(adjustAmount), adjustSuggestion, diffNote);
    setDiffNote('');
    setShowAdjustModal(false);
  };

  const handleRollback = () => {
    rollbackRecord(record.id);
  };

  const handleAddNote = () => {
    if (!noteContent.trim()) return;
    addNote(record.id, noteContent);
    setNoteContent('');
    setShowNoteModal(false);
  };

  const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">操作</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={record.status === RecordStatus.CONFIRMED}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>确认入账</span>
          </button>
          <button
            onClick={() => setShowSuspendModal(true)}
            disabled={record.status === RecordStatus.PENDING_MATERIAL}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Pause className="w-4 h-4" />
            <span>挂起待补</span>
          </button>
          <button
            onClick={() => {
              setAdjustAmount(record.amount.toString());
              setAdjustSuggestion(record.suggestion);
              setShowAdjustModal(true);
            }}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            <span>人工改判</span>
          </button>
          <button
            onClick={handleRollback}
            disabled={!record.previousStatus}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Undo2 className="w-4 h-4" />
            <span>回退</span>
          </button>
          <button
            onClick={() => setShowNoteModal(true)}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>添加备注</span>
          </button>
        </div>
      </div>

      {showConfirmModal && (
        <Modal title="确认入账" onClose={() => setShowConfirmModal(false)}>
          <p className="text-sm text-gray-600 mb-4">请填写确认说明，留痕备查：</p>
          <textarea
            value={diffNote}
            onChange={(e) => setDiffNote(e.target.value)}
            placeholder="例如：材料齐全，金额匹配，确认入账"
            className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            rows={3}
          />
          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={!diffNote.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              确认
            </button>
          </div>
        </Modal>
      )}

      {showSuspendModal && (
        <Modal title="挂起待补" onClose={() => setShowSuspendModal(false)}>
          <p className="text-sm text-gray-600 mb-4">请填写挂起原因，留痕备查：</p>
          <textarea
            value={diffNote}
            onChange={(e) => setDiffNote(e.target.value)}
            placeholder="例如：缺失收款流水凭证，待运营补充"
            className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            rows={3}
          />
          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={() => setShowSuspendModal(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSuspend}
              disabled={!diffNote.trim()}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              确认挂起
            </button>
          </div>
        </Modal>
      )}

      {showAdjustModal && (
        <Modal title="人工改判" onClose={() => setShowAdjustModal(false)}>
          <p className="text-sm text-gray-600 mb-4">请修改金额和处理建议，并填写改判说明：</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">投资金额（元）</label>
              <input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">处理建议</label>
              <textarea
                value={adjustSuggestion}
                onChange={(e) => setAdjustSuggestion(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">改判说明</label>
              <textarea
                value={diffNote}
                onChange={(e) => setDiffNote(e.target.value)}
                placeholder="例如：原金额登记错误，实际到账xxx元"
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={() => setShowAdjustModal(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAdjust}
              disabled={!diffNote.trim() || !adjustAmount}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              确认改判
            </button>
          </div>
        </Modal>
      )}

      {showNoteModal && (
        <Modal title="添加备注" onClose={() => setShowNoteModal(false)}>
          <p className="text-sm text-gray-600 mb-4">请输入备注内容：</p>
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="例如：已电话联系投资者确认..."
            className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            rows={4}
          />
          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={() => setShowNoteModal(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAddNote}
              disabled={!noteContent.trim()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              添加
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
