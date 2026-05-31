import React, { useState } from 'react';
import { FileText, Wrench, StickyNote, ChevronDown, ChevronRight, Link, Eye } from 'lucide-react';
import { DemoScript, Part, Note, KnowledgePoint } from '@/types';
import { ProcessingBadge } from '@/components/common/ProcessingBadge';
import { useAppStore } from '@/store';

interface DataListProps {
  scripts: DemoScript[];
  parts: Part[];
  notes: Note[];
  knowledgePoints: KnowledgePoint[];
}

export const DataList: React.FC<DataListProps> = ({ scripts, parts, notes, knowledgePoints }) => {
  const [expandedSection, setExpandedSection] = useState<'scripts' | 'parts' | 'notes'>('scripts');
  const { setShowTracePanel } = useAppStore();

  const getRelatedKnowledge = (scriptId?: string, partId?: string, noteId?: string) => {
    return knowledgePoints.filter((kp) => {
      if (scriptId) return kp.scriptReferences.includes(scriptId);
      if (partId) return kp.partReferences.includes(partId);
      if (noteId) return kp.noteReferences.includes(noteId);
      return false;
    });
  };

  const toggleSection = (section: 'scripts' | 'parts' | 'notes') => {
    setExpandedSection(expandedSection === section ? section : section);
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <button
          onClick={() => toggleSection('scripts')}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileText size={20} className="text-space-blue" />
            </div>
            <div className="text-left">
              <h3 className="font-serif font-semibold text-graphite">演示脚本</h3>
              <p className="text-sm text-graphite-light">{scripts.length} 条记录</p>
            </div>
          </div>
          {expandedSection === 'scripts' ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </button>

        {expandedSection === 'scripts' && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-2 text-xs font-medium text-graphite-light">步骤</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-graphite-light">标题</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-graphite-light">内容</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-graphite-light">版本</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-graphite-light">状态</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-graphite-light">关联知识点</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-graphite-light">处理口径</th>
                </tr>
              </thead>
              <tbody>
                {scripts.map((script) => {
                  const related = getRelatedKnowledge(script.id);
                  return (
                    <tr
                      key={script.id}
                      className={`border-b border-slate-100 table-row-hover ${
                        script.isSkipped ? 'bg-slate-50 opacity-60' : ''
                      }`}
                    >
                      <td className="py-3 px-2 font-mono text-sm">{script.stepNumber}</td>
                      <td className="py-3 px-2 font-medium text-graphite">{script.title}</td>
                      <td className="py-3 px-2 text-sm text-graphite-light max-w-xs truncate">
                        {script.content}
                      </td>
                      <td className="py-3 px-2 text-sm font-mono text-graphite-light">
                        v{script.version}
                      </td>
                      <td className="py-3 px-2">
                        {script.isSkipped ? (
                          <span className="inline-flex items-center px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded">
                            已跳过
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                            正常
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {related.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {related.map((kp) => (
                              <button
                                key={kp.id}
                                onClick={() => setShowTracePanel(true, kp.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-space-blue/10 text-space-blue text-xs rounded hover:bg-space-blue/20 transition-colors"
                              >
                                <Eye size={12} />
                                {kp.title.substring(0, 8)}...
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">未关联</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <ProcessingBadge rule={script.processingRule} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <button
          onClick={() => toggleSection('parts')}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Wrench size={20} className="text-amber-600" />
            </div>
            <div className="text-left">
              <h3 className="font-serif font-semibold text-graphite">零件清单</h3>
              <p className="text-sm text-graphite-light">{parts.length} 条记录</p>
            </div>
          </div>
          {expandedSection === 'parts' ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </button>

        {expandedSection === 'parts' && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-2 text-xs font-medium text-graphite-light">零件编号</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-graphite-light">名称</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-graphite-light">数量</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-graphite-light">分类</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-graphite-light">版本</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-graphite-light">关联知识点</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-graphite-light">处理口径</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((part) => {
                  const related = getRelatedKnowledge(undefined, part.id);
                  return (
                    <tr key={part.id} className="border-b border-slate-100 table-row-hover">
                      <td className="py-3 px-2 font-mono text-sm">{part.partNumber}</td>
                      <td className="py-3 px-2 font-medium text-graphite">{part.name}</td>
                      <td className="py-3 px-2 text-sm text-graphite-light">{part.quantity}</td>
                      <td className="py-3 px-2 text-sm text-graphite-light">{part.category}</td>
                      <td className="py-3 px-2 text-sm font-mono text-graphite-light">
                        v{part.version}
                      </td>
                      <td className="py-3 px-2">
                        {related.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {related.map((kp) => (
                              <button
                                key={kp.id}
                                onClick={() => setShowTracePanel(true, kp.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-space-blue/10 text-space-blue text-xs rounded hover:bg-space-blue/20 transition-colors"
                              >
                                <Link size={12} />
                                查看
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">未关联</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <ProcessingBadge rule={part.processingRule} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <button
          onClick={() => toggleSection('notes')}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <StickyNote size={20} className="text-purple-600" />
            </div>
            <div className="text-left">
              <h3 className="font-serif font-semibold text-graphite">零散备注</h3>
              <p className="text-sm text-graphite-light">{notes.length} 条记录</p>
            </div>
          </div>
          {expandedSection === 'notes' ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </button>

        {expandedSection === 'notes' && (
          <div className="mt-4 space-y-3">
            {notes.map((note) => {
              const related = getRelatedKnowledge(undefined, undefined, note.id);
              return (
                <div
                  key={note.id}
                  className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-graphite flex-1">{note.content}</p>
                    {related.length > 0 && (
                      <button
                        onClick={() => setShowTracePanel(true, related[0].id)}
                        className="ml-4 inline-flex items-center gap-1 px-2 py-1 bg-space-blue/10 text-space-blue text-xs rounded hover:bg-space-blue/20 transition-colors"
                      >
                        <Link size={12} />
                        查看关联
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-graphite-light">
                      {note.author} · {note.createdAt}
                    </span>
                    <ProcessingBadge rule={note.processingRule} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
