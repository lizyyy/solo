import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, Stamp, PenTool, Wrench, FileSpreadsheet, X, Bookmark, AlertTriangle } from 'lucide-react';
import { Clue, ClueCategory } from '../types';
import { useGameStore } from '../store/gameStore';

const categoryConfig: Record<ClueCategory, { label: string; icon: React.ReactNode; color: string }> = {
  paper: { label: '纸张', icon: <FileText className="w-5 h-5" />, color: 'bg-amber-100 text-amber-700' },
  seal: { label: '印章', icon: <Stamp className="w-5 h-5" />, color: 'bg-red-100 text-red-700' },
  calligraphy: { label: '题跋', icon: <PenTool className="w-5 h-5" />, color: 'bg-blue-100 text-blue-700' },
  restoration: { label: '修复', icon: <Wrench className="w-5 h-5" />, color: 'bg-green-100 text-green-700' },
  report: { label: '报告', icon: <FileSpreadsheet className="w-5 h-5" />, color: 'bg-purple-100 text-purple-700' },
};

interface CluePanelProps {
  clues: Clue[];
}

export default function CluePanel({ clues }: CluePanelProps) {
  const [activeCategory, setActiveCategory] = useState<ClueCategory>('paper');
  const [selectedClue, setSelectedClue] = useState<Clue | null>(null);
  const [noteText, setNoteText] = useState('');
  
  const { 
    currentSession, 
    selectClue, 
    markClueAsAnomaly, 
    addNote,
    setRiskRating 
  } = useGameStore();

  const categories: ClueCategory[] = ['paper', 'seal', 'calligraphy', 'restoration', 'report'];
  
  const filteredClues = clues.filter(c => c.category === activeCategory);
  
  const isMarkedAnomaly = (clueId: string) => {
    return currentSession?.playerChoices.find(c => c.clueId === clueId)?.markedAsAnomaly || false;
  };

  const getPlayerNote = (clueId: string) => {
    return currentSession?.playerNotes.find(n => n.clueId === clueId)?.content || '';
  };

  const getRiskRating = (clueId: string) => {
    return currentSession?.playerChoices.find(c => c.clueId === clueId)?.riskRating;
  };

  const handleSaveNote = (clueId: string) => {
    if (noteText.trim()) {
      addNote(clueId, noteText.trim());
      setNoteText('');
    }
  };

  return (
    <div className="h-full flex flex-col bg-paper-50 border-l-2 border-paper-300">
      <div className="p-4 border-b border-paper-200">
        <h3 className="font-kai text-lg text-ink-300 flex items-center gap-2">
          <Search className="w-5 h-5" />
          线索分析
        </h3>
      </div>

      <div className="flex border-b border-paper-200">
        {categories.map((category) => {
          const config = categoryConfig[category];
          const clueCount = clues.filter(c => c.category === category).length;
          const markedCount = clues.filter(c => c.category === category && isMarkedAnomaly(c.id)).length;
          
          return (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 transition-all ${
                activeCategory === category
                  ? 'bg-paper-200 border-b-2 border-seal-300'
                  : 'hover:bg-paper-100'
              }`}
            >
              <span className={config.color}>{config.icon}</span>
              <span className="text-xs font-kai text-ink-200">
                {config.label}
                {markedCount > 0 && (
                  <span className="ml-1 text-seal-300 font-bold">({markedCount}/{clueCount})</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {filteredClues.map((clue) => {
            const marked = isMarkedAnomaly(clue.id);
            const existingNote = getPlayerNote(clue.id);
            
            return (
              <motion.div
                key={clue.id}
                layout
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  marked
                    ? 'border-seal-300 bg-seal-50'
                    : 'border-paper-300 bg-paper-50 hover:border-lapis-200'
                }`}
                onClick={() => {
                  setSelectedClue(clue);
                  selectClue(clue.id);
                  setNoteText(existingNote);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-kai text-ink-300">{clue.title}</h4>
                      {marked && (
                        <span className="flex items-center gap-1 text-xs text-seal-300">
                          <AlertTriangle className="w-3 h-3" />
                          疑点
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-ink-200 font-song line-clamp-2">
                      {clue.description}
                    </p>
                    {existingNote && (
                      <div className="mt-2 p-2 bg-paper-200 rounded text-xs text-ink-200 font-song">
                        📝 {existingNote}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedClue && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 bg-paper-100 border-t-2 border-paper-300 shadow-lg"
          >
            <div className="p-4 max-h-80 overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs ${categoryConfig[selectedClue.category].color}`}>
                      {categoryConfig[selectedClue.category].label}
                    </span>
                    <h4 className="font-kai text-lg text-ink-300">{selectedClue.title}</h4>
                  </div>
                  <p className="text-ink-200 font-song">{selectedClue.description}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedClue(null);
                    selectClue(null);
                  }}
                  className="p-1 hover:bg-paper-200 rounded"
                >
                  <X className="w-5 h-5 text-ink-200" />
                </button>
              </div>

              <div className="bg-paper-50 p-4 rounded-lg border border-paper-300 mb-4">
                <p className="text-sm font-song text-ink-200 leading-relaxed">
                  {selectedClue.originalValue}
                </p>
              </div>

              <div className="flex items-center justify-between mb-4">
                <span className="font-kai text-ink-300">标记为疑点：</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markClueAsAnomaly(selectedClue.id, !isMarkedAnomaly(selectedClue.id));
                  }}
                  className={`px-4 py-2 rounded-lg font-kai transition-all ${
                    isMarkedAnomaly(selectedClue.id)
                      ? 'bg-seal-300 text-white shadow-seal'
                      : 'bg-paper-200 text-ink-200 hover:bg-paper-300'
                  }`}
                >
                  {isMarkedAnomaly(selectedClue.id) ? '✓ 已标记疑点' : '标记疑点'}
                </button>
              </div>

              {isMarkedAnomaly(selectedClue.id) && (
                <div className="mb-4">
                  <span className="font-kai text-ink-300 block mb-2">风险等级评分：</span>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((level) => (
                      <button
                        key={level}
                        onClick={() => setRiskRating(selectedClue.id, level)}
                        className={`flex-1 py-2 rounded-lg font-kai transition-all ${
                          getRiskRating(selectedClue.id) === level
                            ? 'bg-seal-300 text-white'
                            : 'bg-paper-200 text-ink-200 hover:bg-paper-300'
                        }`}
                      >
                        {level === 1 && '低风险'}
                        {level === 2 && '中风险'}
                        {level === 3 && '高风险'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Bookmark className="w-4 h-4 text-ink-200" />
                  <span className="font-kai text-ink-300">鉴定笔记</span>
                </div>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="记录您的观察和推理..."
                  className="w-full p-3 rounded-lg border border-paper-300 bg-paper-50 text-ink-200 font-song resize-none h-24 focus:outline-none focus:border-lapis-300"
                />
                {noteText.trim() && (
                  <button
                    onClick={() => handleSaveNote(selectedClue.id)}
                    className="mt-2 px-4 py-2 bg-lapis-300 text-white rounded-lg font-kai hover:bg-lapis-200 transition-colors"
                  >
                    保存笔记
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
