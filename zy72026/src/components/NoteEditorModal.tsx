import React, { useState } from 'react';
import { X, StickyNote, Send, Info } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { levels } from '../data/levels';

export const NoteEditorModal: React.FC = () => {
  const { showNoteEditor, setShowNoteEditor, addNote, session, currentLevelId } = useGameStore();
  const [content, setContent] = useState('');
  const [linkToProblem, setLinkToProblem] = useState(true);

  if (!showNoteEditor) return null;

  const level = levels.find((l) => l.id === currentLevelId);
  const currentProblem = level?.problems[session?.currentProblemIndex ?? 0];

  const handleSubmit = () => {
    if (!content.trim()) return;
    addNote(linkToProblem && currentProblem ? currentProblem.id : null, content.trim());
    setContent('');
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-industrial-panel border border-industrial-border rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-industrial-border">
          <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
            <StickyNote size={20} />
            补录备注
          </h3>
          <button
            onClick={() => setShowNoteEditor(false)}
            className="p-1 hover:bg-industrial-border rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg flex items-start gap-2">
            <Info className="text-blue-400 flex-shrink-0 mt-0.5" size={16} />
            <div className="text-xs text-blue-200">
              <p className="font-semibold mb-1">补录备注说明：</p>
              <ul className="space-y-0.5 text-blue-300/80">
                <li>• 备注会被标记为"补录"，区别于老师预置备注</li>
                <li>• 结算报告会显示补录前后的差异对比</li>
                <li>• 建议记录学员反应、犹豫时间等现场观察</li>
              </ul>
            </div>
          </div>

          {currentProblem && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="linkToProblem"
                checked={linkToProblem}
                onChange={(e) => setLinkToProblem(e.target.checked)}
                className="w-4 h-4 rounded border-industrial-border bg-industrial-bg text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="linkToProblem" className="text-sm text-industrial-text">
                关联到当前问题：<span className="text-amber-400">{currentProblem.title}</span>
              </label>
            </div>
          )}

          <div>
            <label className="block text-sm text-industrial-muted mb-2">备注内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="例如：学员在第3题犹豫了5秒才做出选择，看起来对 RULE-003 不太熟悉..."
              rows={4}
              className="w-full bg-industrial-bg border border-industrial-border rounded-lg px-3 py-2 text-industrial-text focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>

          {content.trim() && (
            <div className="p-3 bg-industrial-bg rounded-lg">
              <div className="text-xs text-industrial-muted mb-1">预览：</div>
              <div className="text-sm text-industrial-text">
                <span className="text-amber-400">讲解员小夏：</span> {content.trim()}
                <span className="text-amber-400 text-xs ml-1">*补录</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-industrial-border bg-industrial-bg/50">
          <button
            onClick={() => setShowNoteEditor(false)}
            className="industrial-button-secondary"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim()}
            className="industrial-button-primary flex items-center gap-2"
          >
            <Send size={16} />
            添加备注
          </button>
        </div>
      </div>
    </div>
  );
};
