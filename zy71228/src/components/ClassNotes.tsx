import { useState } from 'react';
import { Plus, Trash2, Check, BookOpen, StickyNote } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { StatusBadge } from './StatusBadge';
import type { NoteCategory, ClassNote } from '@/types/game';
import { cn } from '@/lib/utils';

interface ClassNotesProps {
  gameId: string;
  notes: ClassNote[];
}

const categoryLabels: Record<NoteCategory, string> = {
  policy: '政策工具',
  liquidity: '银行流动性',
  rate: '市场利率',
  event: '新闻事件',
  report: '课堂报告',
};

const categoryColors: Record<NoteCategory, string> = {
  policy: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  liquidity: 'bg-green-500/20 text-green-400 border-green-500/30',
  rate: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  event: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  report: 'bg-gold-500/20 text-gold-400 border-gold-500/30',
};

export function ClassNotes({ gameId, notes }: ClassNotesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NoteCategory>('report');

  const addClassNote = useGameStore((state) => state.addClassNote);
  const updateNoteStatus = useGameStore((state) => state.updateNoteStatus);
  const deleteClassNote = useGameStore((state) => state.deleteClassNote);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addClassNote(gameId, newNote.trim(), selectedCategory);
    setNewNote('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddNote();
    }
  };

  const groupedNotes = notes.reduce((acc, note) => {
    if (!acc[note.category]) acc[note.category] = [];
    acc[note.category].push(note);
    return acc;
  }, {} as Record<NoteCategory, ClassNote[]>);

  return (
    <div className="bg-navy-800/50 backdrop-blur-sm rounded-xl border border-navy-600 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-navy-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="text-gold-400" size={18} />
          <span className="font-semibold text-gold-400">课堂笔记</span>
          <span className="text-xs text-navy-400">
            {notes.length} 条
          </span>
        </div>
        <StickyNote size={18} className={isExpanded ? 'rotate-12' : ''} />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t border-navy-600">
              <div className="flex gap-2 mb-4">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as NoteCategory)}
                  className="bg-navy-900/50 border border-navy-600 rounded-lg px-3 py-2 text-sm input-focus"
                >
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="添加笔记..."
                  className="flex-1 bg-navy-900/50 border border-navy-600 rounded-lg px-3 py-2 text-sm input-focus"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    newNote.trim()
                      ? 'bg-gold-500 hover:bg-gold-400 text-navy-900'
                      : 'bg-navy-700 text-navy-500'
                  )}
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="space-y-4 max-h-80 overflow-y-auto">
                {Object.entries(groupedNotes).map(([category, categoryNotes]) => (
                  <div key={category}>
                    <div className={cn(
                      'inline-flex items-center px-2 py-0.5 text-xs rounded border mb-2',
                      categoryColors[category as NoteCategory]
                    )}>
                      {categoryLabels[category as NoteCategory]}
                      <span className="ml-2 opacity-70">({categoryNotes.length})</span>
                    </div>
                    <div className="space-y-2">
                      {categoryNotes.map((note) => (
                        <NoteItem
                          key={note.id}
                          note={note}
                          onConfirm={() => updateNoteStatus(gameId, note.id, 'confirmed')}
                          onDelete={() => deleteClassNote(gameId, note.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {notes.length === 0 && (
                  <div className="text-center py-8 text-navy-500 text-sm">
                    暂无笔记，添加第一条笔记吧
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface NoteItemProps {
  note: ClassNote;
  onConfirm: () => void;
  onDelete: () => void;
}

function NoteItem({ note, onConfirm, onDelete }: NoteItemProps) {
  const isConfirmed = note.status === 'confirmed';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'p-3 rounded-lg border flex items-start justify-between gap-2',
        isConfirmed ? 'confirmed-border bg-gold-500/5' : 'tentative-bg'
      )}
    >
      <p className={cn('text-sm flex-1', isConfirmed ? '' : 'tentative-text')}>
        {note.content}
      </p>
      <div className="flex items-center gap-1 flex-shrink-0">
        <StatusBadge type="action" status={note.status} />
        {!isConfirmed && (
          <>
            <button
              onClick={onConfirm}
              className="p-1 rounded hover:bg-liquidity-good/20 text-liquidity-good transition-colors"
              title="确认"
            >
              <Check size={12} />
            </button>
            <button
              onClick={onDelete}
              className="p-1 rounded hover:bg-liquidity-danger/20 text-liquidity-danger transition-colors"
              title="删除"
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
