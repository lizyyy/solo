import { useState } from 'react';
import { X, AlertTriangle, Check } from 'lucide-react';
import { useUiStore } from '../../store/useUiStore';
import { useRecordsStore } from '../../store/useRecordsStore';
import { NoFlyZoneSourceType } from '../../types';
import { cn } from '../../lib/utils';

export function IssueModal() {
  const { activeModal, closeModal, currentUser, modalData } = useUiStore();
  const { addNoFlyZoneIssue, getSelectedRecord } = useRecordsStore();

  const record = getSelectedRecord();
  const recordId = modalData.recordId || record?.id;

  const [sourceType, setSourceType] = useState<NoFlyZoneSourceType>('pilot_note');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState(record?.pilot || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (activeModal !== 'issue') return null;

  const handleSubmit = async () => {
    if (!recordId || !description || !assignee) return;

    setLoading(true);
    try {
      await addNoFlyZoneIssue(
        recordId,
        sourceType,
        { lat: 0, lng: 0, alt: 0 },
        description,
        assignee,
        currentUser
      );
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSourceType('pilot_note');
    setDescription('');
    setAssignee(record?.pilot || '');
    setSuccess(false);
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 rounded-xl border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h3 className="text-lg font-semibold text-slate-200">添加禁飞区问题</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-green-400 font-medium">问题已添加</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs text-slate-400 mb-2">来源类型</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'pilot_note' as const, label: '飞手备注', desc: '飞手发现的问题' },
                    { value: 'inspection_photo' as const, label: '巡检照片', desc: '照片中发现的问题' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setSourceType(type.value)}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-colors',
                        sourceType === type.value
                          ? 'border-orange-500/50 bg-orange-500/10 text-orange-400'
                          : 'border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-300'
                      )}
                    >
                      <p className="font-medium text-sm">{type.label}</p>
                      <p className="text-xs opacity-70">{type.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">问题描述</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="请详细描述禁飞区擦边问题，包括位置、影响等..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">责任人</label>
                <input
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="指定处理该问题的人员"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-400">
                  <span className="font-medium">提示：</span>
                  添加问题后，系统会自动记录到操作历史，并可在问题标签页中跟踪处理进度。责任人将收到该问题的处理责任。
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-700/50 bg-slate-900/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            取消
          </button>
          {!success && (
            <button
              onClick={handleSubmit}
              disabled={!description || !assignee || loading}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  添加问题
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
