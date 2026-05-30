import { useState, useMemo } from 'react';
import { FileText, AlertTriangle, X, Check, Link2 } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import type { EvidenceType, MarkType, EvidenceMark } from '../types';
import { getMarkTypeLabel, getMarkTypeColor } from '../utils/gameEngine';

interface EvidencePanelProps {
  type: EvidenceType;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  evidenceId: string;
  hasMark: boolean;
  markType?: MarkType;
  hasContradiction?: boolean;
  isUpdated?: boolean;
  updateNote?: string;
  isSelected?: boolean;
  onClick?: () => void;
}

const EvidencePanel = ({
  type,
  title,
  icon: Icon,
  children,
  evidenceId,
  hasMark,
  markType,
  hasContradiction,
  isUpdated,
  updateNote,
  isSelected,
  onClick
}: EvidencePanelProps) => {
  const removeEvidenceMark = useGameStore(state => state.removeEvidenceMark);
  const selectedClauseId = useGameStore(state => state.selectedClauseId);
  const matchClauseToEvidence = useGameStore(state => state.matchClauseToEvidence);
  const activeTool = useGameStore(state => state.activeTool);
  const isPlaybackMode = useGameStore(state => state.isPlaybackMode);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState('');

  const allMarks = useGameStore(state => state.evidenceMarks);
  const evidenceMarks = useMemo(
    () => allMarks.filter(m => m.evidenceType === type && m.evidenceId === evidenceId),
    [allMarks, type, evidenceId]
  );

  const getMarkColor = (markType: MarkType) => {
    const colors: Record<MarkType, string> = {
      'suspicious': 'bg-yellow-500/30 border-yellow-500',
      'contradiction': 'bg-amber-500/30 border-amber-500',
      'exemption': 'bg-red-500/30 border-red-500',
      'old_damage': 'bg-orange-500/30 border-orange-500'
    };
    return colors[markType] || 'bg-gray-500/30 border-gray-500';
  };

  const handleMatchClause = (markId: string) => {
    if (selectedClauseId) {
      matchClauseToEvidence(markId, selectedClauseId);
    }
  };

  return (
    <div
      className={`file-folder cursor-pointer transition-all duration-300 ${
        isSelected ? 'ring-2 ring-detective-accent glow-border' : ''
      } ${isUpdated ? 'animate-highlight-pulse' : ''} ${
        hasContradiction ? 'border-detective-danger/50' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-detective-accent" />
          <h4 className="font-semibold text-slate-200">{title}</h4>
        </div>
        <div className="flex items-center gap-2">
          {isUpdated && (
            <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 animate-pulse">
              已更新
            </span>
          )}
          {hasContradiction && (
            <AlertTriangle className="w-4 h-4 text-detective-danger animate-pulse" />
          )}
        </div>
      </div>

      {isUpdated && updateNote && (
        <div className="mb-3 p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
          {updateNote}
        </div>
      )}

      <div className="text-sm text-slate-300">{children}</div>

      {evidenceMarks.length > 0 && (
        <div className="mt-4 space-y-2">
          {evidenceMarks.map((mark) => (
            <div
              key={mark.id}
              className={`p-3 rounded-lg border ${getMarkColor(mark.markType)} animate-stamp`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${getMarkTypeColor(mark.markType)}`}>
                    {getMarkTypeLabel(mark.markType)}
                  </span>
                  {mark.matchedClauseId && (
                    <Link2 className="w-4 h-4 text-detective-accent" />
                  )}
                </div>
                {!isPlaybackMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeEvidenceMark(mark.id);
                    }}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {mark.note && (
                <p className="mt-2 text-xs text-slate-300">{mark.note}</p>
              )}
              {selectedClauseId && !mark.matchedClauseId && !isPlaybackMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMatchClause(mark.id);
                  }}
                  className="mt-2 text-xs text-detective-accent hover:underline flex items-center gap-1"
                >
                  <Link2 className="w-3 h-3" />
                  匹配到选中的条款
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTool === 'note' && hasMark && (
        <div className="mt-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="添加备注..."
              className="flex-1 px-3 py-2 rounded bg-detective-bgLighter border border-detective-bgLighter text-slate-200 text-sm focus:outline-none focus:border-detective-accent"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowNote(false);
                setNoteText('');
              }}
              className="px-3 py-2 rounded bg-detective-bgLighter text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvidencePanel;
