import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Note } from '../types';
import { formatTimestamp } from '../utils/gameEngine';
import { renderDiffToHTML, getDiffStats } from '../utils/diffUtils';
import { Plus, Edit2, Save, X, GitCompare, User, Clock, FileText } from 'lucide-react';

interface NotesPanelProps {
  notes: Note[];
  onAddNote: (content: string, reason?: string) => void;
  onUpdateNote: (noteId: string, newContent: string, reason?: string) => void;
  disabled?: boolean;
}

interface NoteCardProps {
  note: Note;
  onUpdate: (newContent: string, reason?: string) => void;
  disabled?: boolean;
}

function NoteCard({ note, onUpdate, disabled }: NoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  const [editReason, setEditReason] = useState('');
  const [showDiff, setShowDiff] = useState(false);

  const isOriginal = note.type === 'original';
  const hasRevisions = note.revisions && note.revisions.length > 0;

  const handleSave = () => {
    if (editContent.trim() && editContent !== note.content) {
      onUpdate(editContent, editReason || '补录备注');
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(note.content);
    setEditReason('');
    setIsEditing(false);
  };

  const latestRevision = hasRevisions ? note.revisions![note.revisions!.length - 1] : null;
  const diffStats = latestRevision ? getDiffStats(latestRevision.diff) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative p-4 rounded-lg mb-4 ${
        isOriginal ? 'sticky-note-yellow' : 'sticky-note-blue'
      }`}
      style={{ minHeight: '120px' }}
    >
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <span
          className={`stamp ${
            isOriginal ? 'border-amber-600 text-amber-600' : 'border-blue-600 text-blue-600'
          }`}
        >
          {isOriginal ? '原始' : '补录'}
        </span>
        {!isOriginal && !disabled && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-1 hover:bg-black/10 rounded transition-colors"
            title="编辑补录备注"
          >
            <Edit2 size={14} className="text-gray-700" />
          </button>
        )}
        {hasRevisions && (
          <button
            onClick={() => setShowDiff(!showDiff)}
            className={`p-1 hover:bg-black/10 rounded transition-colors ${
              showDiff ? 'bg-black/20' : ''
            }`}
            title="查看差异"
          >
            <GitCompare size={14} className="text-gray-700" />
          </button>
        )}
      </div>

      <div className="pr-20 mb-2">
        <div className="font-hand text-lg font-bold mb-2">
          {isOriginal ? '📋 原始备注' : '📝 补录备注'}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-2 rounded border border-gray-300 bg-white/80 text-sm font-mono resize-y min-h-[100px]"
              placeholder="输入补录内容..."
            />
            <input
              type="text"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              className="w-full p-2 rounded border border-gray-300 bg-white/80 text-xs font-mono"
              placeholder="修改原因（可选）"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
              >
                <Save size={12} /> 保存
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 px-3 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 transition-colors"
              >
                <X size={12} /> 取消
              </button>
            </div>
          </div>
        ) : (
          <div className="font-hand text-base whitespace-pre-wrap leading-relaxed">
            {note.content}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-600 font-mono">
        <span className="flex items-center gap-1">
          <User size={10} /> {note.author}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={10} /> {formatTimestamp(note.createdAt)}
        </span>
        <span className="flex items-center gap-1">
          <FileText size={10} /> {note.source}
        </span>
      </div>

      <AnimatePresence>
        {showDiff && latestRevision && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t-2 border-dashed border-gray-400 overflow-hidden"
          >
            <div className="text-xs font-mono text-gray-700 mb-2">
              <div className="font-bold mb-1">📌 最近一次修改记录</div>
              <div className="flex items-center gap-4">
                <span>修改人: {latestRevision.author}</span>
                <span>时间: {formatTimestamp(latestRevision.createdAt)}</span>
                <span>原因: {latestRevision.reason}</span>
              </div>
              {diffStats && (
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-green-700">+{diffStats.added} 字符新增</span>
                  <span className="text-red-700">-{diffStats.removed} 字符删除</span>
                  <span className="text-gray-500">{diffStats.unchanged} 字符未变</span>
                </div>
              )}
            </div>
            <div className="bg-white/50 p-3 rounded text-sm font-mono">
              <div className="text-xs text-gray-500 mb-2">差异对比：</div>
              <div
                dangerouslySetInnerHTML={{
                  __html: renderDiffToHTML(latestRevision.diff),
                }}
                className="leading-relaxed whitespace-pre-wrap"
              />
            </div>
            {note.revisions && note.revisions.length > 1 && (
              <div className="mt-2 text-xs text-gray-500 text-center">
                共 {note.revisions.length} 次修改记录
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function NotesPanel({ notes, onAddNote, onUpdateNote, disabled }: NotesPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newReason, setNewReason] = useState('');

  const handleAddNote = () => {
    if (newContent.trim()) {
      onAddNote(newContent, newReason || '补录备注');
      setNewContent('');
      setNewReason('');
      setIsAdding(false);
    }
  };

  const originalNote = notes.find((n) => n.type === 'original');
  const supplementaryNotes = notes.filter((n) => n.type === 'supplementary');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-hand text-xl text-skate-orange">📋 评分备注</h3>
        {!disabled && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="chalk-button text-sm py-1"
          >
            <Plus size={14} className="inline mr-1" />
            补录备注
          </button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-chalkboard-light p-4 rounded-lg border-2 border-skate-blue border-dashed mb-4"
          >
            <div className="font-hand text-lg text-skate-blue mb-2">📝 添加补录备注</div>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full p-3 rounded bg-chalkboard border border-chalk/30 text-chalk font-mono text-sm resize-y min-h-[80px] mb-2"
              placeholder="输入补录备注内容..."
            />
            <input
              type="text"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              className="w-full p-2 rounded bg-chalkboard border border-chalk/30 text-chalk font-mono text-xs mb-3"
              placeholder="补录原因（可选，如：临时调整、学生表现特别等）"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddNote}
                disabled={!newContent.trim()}
                className="chalk-button text-sm py-1 border-skate-teal text-skate-teal"
              >
                <Save size={14} className="inline mr-1" />
                保存备注
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewContent('');
                  setNewReason('');
                }}
                className="chalk-button text-sm py-1 border-chalk-muted text-chalk-muted"
              >
                <X size={14} className="inline mr-1" />
                取消
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {originalNote && (
        <NoteCard note={originalNote} onUpdate={onUpdateNote} disabled={disabled} />
      )}

      {supplementaryNotes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onUpdate={onUpdateNote}
          disabled={disabled}
        />
      ))}

      {notes.length === 0 && (
        <div className="text-center py-12 text-chalk-muted">
          <div className="text-4xl mb-3">📋</div>
          <div className="font-hand text-xl">暂无备注</div>
          <div className="text-xs font-mono mt-1">开始对局后会自动导入原始备注</div>
        </div>
      )}

      <div className="mt-4 p-3 bg-chalkboard-light/50 rounded-lg border border-chalk/10">
        <div className="text-xs text-chalk-muted font-mono">
          <div className="font-bold text-skate-orange mb-1">💡 备注说明</div>
          <ul className="space-y-1 list-disc list-inside">
            <li>原始备注一旦导入不可修改，完整保留课堂计分表的"乱备注"</li>
            <li>补录备注可以编辑，每次修改都会记录差异对比</li>
            <li>所有备注都保留来源、作者和时间戳，便于追溯</li>
            <li>差异对比中，<span className="text-red-500">红色删除线</span>表示删除内容，<span className="text-green-600">绿色下划线</span>表示新增内容</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
