import { useState, useEffect, useRef } from 'react';
import { TrackRecord } from '../types';
import { useTrackStore } from '../store/useTrackStore';
import { Edit3, Save, X, History, Clock, Check } from 'lucide-react';

interface RemarkEditorProps {
  record: TrackRecord;
}

export default function RemarkEditor({ record }: RemarkEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newRemark, setNewRemark] = useState(record.remark);
  const [showHistory, setShowHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateRemark = useTrackStore((state) => state.updateRemark);

  useEffect(() => {
    setNewRemark(record.remark);
  }, [record.remark]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (newRemark === record.remark) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    updateRemark(record.id, newRemark);
    setIsSaving(false);
    setSaveSuccess(true);
    setIsEditing(false);

    setTimeout(() => {
      setSaveSuccess(false);
    }, 1500);
  };

  const handleCancel = () => {
    setNewRemark(record.remark);
    setIsEditing(false);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="w-full">
      <div className="flex items-start gap-2">
        <div className="flex-1 relative">
          {isEditing ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <textarea
                ref={textareaRef}
                value={newRemark}
                onChange={(e) => setNewRemark(e.target.value)}
                placeholder="请输入备注..."
                className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none min-h-[60px]"
              />
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded transition-colors"
                >
                  <X size={12} />
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs bg-amber-600 text-white hover:bg-amber-700 rounded transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <span className="animate-pulse">保存中...</span>
                  ) : (
                    <>
                      <Save size={12} />
                      保存
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`group bg-amber-50/80 border border-amber-100 rounded-lg p-3 cursor-pointer hover:bg-amber-50 transition-colors ${
                saveSuccess ? 'ring-2 ring-emerald-500' : ''
              }`}
              onClick={() => setIsEditing(true)}
            >
              <div className="flex items-start justify-between">
                <p className="text-sm text-slate-700 flex-1 min-h-[20px]">
                  {record.remark || <span className="text-slate-400 italic">点击添加备注</span>}
                </p>
                <div className="flex items-center gap-1 ml-2">
                  {saveSuccess ? (
                    <Check size={14} className="text-emerald-500 animate-bounce" />
                  ) : (
                    <Edit3 size={14} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </div>
              {record.modifyHistory.length > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={12} />
                  <span>最后修改: {formatTime(record.lastModifiedAt)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {record.modifyHistory.length > 0 && !isEditing && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-lg transition-colors ${
              showHistory ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
            }`}
            title="查看历史记录"
          >
            <History size={16} />
          </button>
        )}
      </div>

      {showHistory && record.modifyHistory.length > 0 && (
        <div className="mt-3 ml-4 border-l-2 border-slate-200 pl-4 space-y-3 animate-fadeIn">
          <h4 className="text-xs font-medium text-slate-600 flex items-center gap-1">
            <History size={12} />
            备注修改历史 ({record.modifyHistory.length} 条)
          </h4>
          {[...record.modifyHistory].reverse().map((entry, idx) => (
            <div key={idx} className="bg-slate-50 rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock size={10} />
                  {formatTime(entry.timestamp)}
                </span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  {entry.diff}
                </span>
              </div>
              {entry.oldRemark && (
                <div className="mb-1">
                  <span className="text-xs text-slate-500">修改前: </span>
                  <span className="text-slate-600 line-through">{entry.oldRemark}</span>
                </div>
              )}
              <div>
                <span className="text-xs text-slate-500">修改后: </span>
                <span className="text-slate-800 font-medium">{entry.newRemark || '(空)'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
