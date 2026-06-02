import { motion } from 'framer-motion';
import { FileText, Quote, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { Evidence } from '../types';
import { cn } from '../lib/utils';

interface EvidenceBlockProps {
  evidences: Evidence[];
  compact?: boolean;
}

export function EvidenceBlock({ evidences, compact = false }: EvidenceBlockProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (evidences.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic">
        无引用证据
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {evidences.map((evidence, index) => (
        <motion.div
          key={evidence.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className={cn(
            "rounded-lg border overflow-hidden transition-all",
            expandedId === evidence.id
              ? "border-primary-300 bg-primary-50/30"
              : "border-slate-200 bg-slate-50/50 hover:border-primary-200"
          )}
        >
          <button
            onClick={() => setExpandedId(expandedId === evidence.id ? null : evidence.id)}
            className="w-full px-3 py-2 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-primary-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">
                  {evidence.knowledgeDocId}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500">
                    位置: {evidence.startPos}-{evidence.endPos}
                  </span>
                  <span className={cn(
                    "text-xs font-medium px-1.5 py-0.5 rounded",
                    evidence.relevanceScore >= 0.9
                      ? "bg-accent-emerald-100 text-accent-emerald-700"
                      : evidence.relevanceScore >= 0.7
                        ? "bg-accent-amber-100 text-accent-amber-700"
                        : "bg-slate-200 text-slate-600"
                  )}>
                    相关度 {(evidence.relevanceScore * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
            {!compact && (
              expandedId === evidence.id
                ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            )}
          </button>

          {(expandedId === evidence.id || compact) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3">
                <div className="quote-block mt-1">
                  <div className="flex items-start gap-2">
                    <Quote className="w-3.5 h-3.5 text-primary-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {evidence.quotedText}
                    </p>
                  </div>
                </div>
                {evidence.fragment !== evidence.quotedText && (
                  <p className="text-xs text-slate-500 mt-2">
                    <span className="font-medium">原文片段:</span> {evidence.fragment}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
