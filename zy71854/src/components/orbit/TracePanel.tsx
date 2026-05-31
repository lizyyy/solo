import React from 'react';
import { X, FileText, Wrench, StickyNote, Link2 } from 'lucide-react';
import { useAppStore } from '@/store';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ProcessingBadge } from '@/components/common/ProcessingBadge';
import { highlightText } from '@/utils/processing';

export const TracePanel: React.FC = () => {
  const { showTracePanel, selectedKnowledgeId, setShowTracePanel, scripts, parts, notes, knowledgePoints } = useAppStore();

  if (!showTracePanel || !selectedKnowledgeId) return null;

  const knowledge = knowledgePoints.find((k) => k.id === selectedKnowledgeId);
  if (!knowledge) return null;

  const relatedScripts = scripts.filter((s) => knowledge.scriptReferences.includes(s.id));
  const relatedParts = parts.filter((p) => knowledge.partReferences.includes(p.id));
  const relatedNotes = notes.filter((n) => knowledge.noteReferences.includes(n.id));

  const keywords = knowledge.title.split(/[，。、\s]+/).filter((w) => w.length > 1);

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-2xl border-l border-slate-200 z-50 animate-slide-in-right flex flex-col">
      <div className="flex items-center justify-between p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link2 className="text-star-gold" />
          <h3 className="font-serif font-bold text-lg text-graphite">追溯查看</h3>
        </div>
        <button
          onClick={() => setShowTracePanel(false)}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X size={20} className="text-graphite-light" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-6 space-y-6">
          <div className="p-4 bg-space-deep/5 rounded-xl border border-space-blue/20">
            <div className="flex items-center justify-between mb-2">
              <StatusBadge status={knowledge.status} />
              <span className="text-xs text-graphite-light">ID: {knowledge.id}</span>
            </div>
            <h4 className="font-serif font-semibold text-lg text-graphite mb-2">
              {knowledge.title}
            </h4>
            <p
              className="text-graphite-light text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: highlightText(knowledge.content, keywords) }}
            />
            <div className="mt-3 pt-3 border-t border-slate-200">
              <ProcessingBadge rule={knowledge.processingRule} />
            </div>
            {knowledge.manualEditReason && (
              <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-700">
                  <strong>修改原因：</strong>
                  {knowledge.manualEditReason}
                </p>
              </div>
            )}
          </div>

          {relatedScripts.length > 0 && (
            <div>
              <h5 className="flex items-center gap-2 font-medium text-graphite mb-3">
                <FileText size={18} className="text-space-blue" />
                关联演示脚本 ({relatedScripts.length})
              </h5>
              <div className="space-y-3">
                {relatedScripts.map((script) => (
                  <div
                    key={script.id}
                    className="p-4 bg-blue-50 rounded-lg border border-blue-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        步骤 {script.stepNumber}
                      </span>
                      {script.isSkipped && (
                        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded">
                          已跳过
                        </span>
                      )}
                    </div>
                    <h6 className="font-medium text-graphite mb-1">{script.title}</h6>
                    <p
                      className="text-sm text-graphite-light"
                      dangerouslySetInnerHTML={{ __html: highlightText(script.content, keywords) }}
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-graphite-light">
                        来源：{script.sourceFile} · v{script.version}
                      </span>
                      <ProcessingBadge rule={script.processingRule} showIcon={false} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {relatedParts.length > 0 && (
            <div>
              <h5 className="flex items-center gap-2 font-medium text-graphite mb-3">
                <Wrench size={18} className="text-amber-600" />
                关联零件 ({relatedParts.length})
              </h5>
              <div className="space-y-2">
                {relatedParts.map((part) => (
                  <div
                    key={part.id}
                    className="p-3 bg-amber-50 rounded-lg border border-amber-200"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono text-amber-700">
                          {part.partNumber}
                        </span>
                        <h6 className="font-medium text-graphite">{part.name}</h6>
                      </div>
                      <span className="text-sm font-medium text-amber-700">
                        ×{part.quantity}
                      </span>
                    </div>
                    {part.description && (
                      <p className="text-xs text-graphite-light mt-1">
                        {part.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-graphite-light">
                        分类：{part.category}
                      </span>
                      <ProcessingBadge rule={part.processingRule} showIcon={false} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {relatedNotes.length > 0 && (
            <div>
              <h5 className="flex items-center gap-2 font-medium text-graphite mb-3">
                <StickyNote size={18} className="text-purple-600" />
                关联备注 ({relatedNotes.length})
              </h5>
              <div className="space-y-2">
                {relatedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 bg-purple-50 rounded-lg border border-purple-200"
                  >
                    <p className="text-sm text-graphite">{note.content}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-graphite-light">
                        {note.author} · {note.createdAt}
                      </span>
                      <ProcessingBadge rule={note.processingRule} showIcon={false} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {relatedScripts.length === 0 && relatedParts.length === 0 && relatedNotes.length === 0 && (
            <div className="text-center py-8 text-graphite-light">
              <p>该知识点暂无关联的原始材料</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <p className="text-xs text-graphite-light text-center">
          关闭面板：点击右上角 × 或点击面板外区域
        </p>
      </div>
    </div>
  );
};
