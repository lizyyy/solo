import { Shield, Clock, Archive, Lock, FileText, AlertCircle } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import {
  CONFIDENTIALITY_LABELS,
  CONFIDENTIALITY_COLORS,
  RETENTION_LABELS,
  FILE_CATEGORY_LABELS,
} from '@/types';
import type { ConfidentialityLevel, RetentionPeriod, ArchiveBox } from '@/types';
import { getFileCategoryRuleHint } from '@/utils/gameLogic';

interface ControlPanelProps {
  boxes: ArchiveBox[];
}

const CONFIDENTIALITY_LEVELS: ConfidentialityLevel[] = ['open', 'secret', 'confidential', 'top_secret'];
const RETENTION_PERIODS: RetentionPeriod[] = ['permanent', '30yrs', '10yrs', '5yrs', '3yrs'];

export default function ControlPanel({ boxes }: ControlPanelProps) {
  const {
    currentFile,
    selectedConfidentiality,
    selectedRetention,
    selectedBoxId,
    selectConfidentiality,
    selectRetention,
    selectBox,
    submitFile,
    showRuleHint,
    toggleRuleHint,
  } = useGameStore();

  const canSubmit = selectedConfidentiality && selectedRetention && selectedBoxId;

  if (!currentFile) {
    return (
      <div className="w-80 bg-[#1a3a2e]/95 backdrop-blur-sm border-l border-[#d4a017]/30
        flex items-center justify-center p-8">
        <div className="text-center text-white/60">
          <FileText size={48} className="mx-auto mb-4 opacity-50" />
          <p>等待加载文件...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-[#1a3a2e]/95 backdrop-blur-sm border-l border-[#d4a017]/30
      flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: CONFIDENTIALITY_COLORS[currentFile.confidentiality] }}
          />
          <span className="text-white/60 text-xs uppercase tracking-wider">
            {FILE_CATEGORY_LABELS[currentFile.type]}
          </span>
        </div>
        <h3 className="text-white font-bold text-lg leading-tight">{currentFile.name}</h3>
        <p className="text-white/60 text-sm mt-2 leading-relaxed">{currentFile.content}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} className="text-[#d4a017]" />
            <span className="text-white/80 text-sm font-medium">保密级别</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CONFIDENTIALITY_LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => selectConfidentiality(level)}
                className={cn(
                  'px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  'border-2 flex items-center justify-center gap-1.5',
                  selectedConfidentiality === level
                    ? 'border-[#d4a017] bg-[#d4a017]/20 text-[#d4a017] shadow-lg shadow-[#d4a017]/20'
                    : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10'
                )}
              >
                <Lock size={14} style={{ color: CONFIDENTIALITY_COLORS[level] }} />
                {CONFIDENTIALITY_LABELS[level]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-[#d4a017]" />
            <span className="text-white/80 text-sm font-medium">保管期限</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {RETENTION_PERIODS.map((period) => (
              <button
                key={period}
                onClick={() => selectRetention(period)}
                className={cn(
                  'px-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  'border-2',
                  selectedRetention === period
                    ? 'border-[#d4a017] bg-[#d4a017]/20 text-[#d4a017] shadow-lg shadow-[#d4a017]/20'
                    : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10'
                )}
              >
                {RETENTION_LABELS[period]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Archive size={16} className="text-[#d4a017]" />
            <span className="text-white/80 text-sm font-medium">归档到档案盒</span>
          </div>
          <div className="space-y-2">
            {boxes.map((box) => (
              <button
                key={box.id}
                onClick={() => selectBox(box.id)}
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  'border-2 flex items-center gap-2',
                  selectedBoxId === box.id
                    ? 'border-[#d4a017] bg-[#d4a017]/20 text-[#d4a017] shadow-lg shadow-[#d4a017]/20'
                    : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10'
                )}
              >
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: box.color }}
                />
                {box.name}
              </button>
            ))}
          </div>
        </div>

        {showRuleHint && (
          <div className="p-3 rounded-lg bg-[#d4a017]/10 border border-[#d4a017]/30">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-[#d4a017] mt-0.5 flex-shrink-0" />
              <p className="text-white/80 text-xs leading-relaxed">
                {getFileCategoryRuleHint(currentFile)}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={toggleRuleHint}
          className="text-white/40 text-xs hover:text-white/60 transition-colors"
        >
          {showRuleHint ? '隐藏规则提示' : '显示规则提示'}
        </button>
      </div>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={submitFile}
          disabled={!canSubmit}
          className={cn(
            'w-full py-3 rounded-xl font-bold text-lg transition-all duration-300',
            'flex items-center justify-center gap-2',
            canSubmit
              ? 'bg-gradient-to-r from-[#d4a017] to-[#f1c40f] text-[#1a3a2e] shadow-lg shadow-[#d4a017]/30 hover:shadow-xl hover:shadow-[#d4a017]/40 active:scale-[0.98]'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
          )}
        >
          <Archive size={20} />
          确认归档
        </button>
        {!canSubmit && (
          <p className="text-white/40 text-xs text-center mt-2">
            请完成所有选择后提交
          </p>
        )}
      </div>
    </div>
  );
}