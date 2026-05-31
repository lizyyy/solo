import React, { useState } from 'react';
import { Link, Edit2, Check, Clock, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { KnowledgePoint, KnowledgeStatus } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ProcessingBadge } from '@/components/common/ProcessingBadge';
import { useAppStore } from '@/store';
import { statusToText } from '@/utils/processing';

interface KnowledgeTableProps {
  knowledgePoints: KnowledgePoint[];
}

export const KnowledgeTable: React.FC<KnowledgeTableProps> = ({ knowledgePoints }) => {
  const { setShowTracePanel, updateKnowledgeStatus, editKnowledge } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editReason, setEditReason] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleEdit = (kp: KnowledgePoint) => {
    setEditingId(kp.id);
    setEditContent(kp.content);
    setEditReason('');
  };

  const handleSaveEdit = (id: string) => {
    if (editContent.trim()) {
      editKnowledge(id, { content: editContent }, editReason || undefined);
      setEditingId(null);
      setEditContent('');
      setEditReason('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
    setEditReason('');
  };

  const statusOptions: { value: KnowledgeStatus; icon: typeof Check; label: string }[] = [
    { value: 'confirmed', icon: Check, label: '已确认' },
    { value: 'pending', icon: Clock, label: '待补' },
    { value: 'modified', icon: Sparkles, label: '人工修改' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left py-4 px-4 text-xs font-medium text-graphite-light w-12"></th>
            <th className="text-left py-4 px-4 text-xs font-medium text-graphite-light w-16">ID</th>
            <th className="text-left py-4 px-4 text-xs font-medium text-graphite-light w-48">标题</th>
            <th className="text-left py-4 px-4 text-xs font-medium text-graphite-light">内容</th>
            <th className="text-left py-4 px-4 text-xs font-medium text-graphite-light w-28">状态</th>
            <th className="text-left py-4 px-4 text-xs font-medium text-graphite-light w-32">关联数量</th>
            <th className="text-left py-4 px-4 text-xs font-medium text-graphite-light w-40">处理口径</th>
            <th className="text-left py-4 px-4 text-xs font-medium text-graphite-light w-28">操作</th>
          </tr>
        </thead>
        <tbody>
          {knowledgePoints.map((kp) => {
            const isExpanded = expandedId === kp.id;
            const isEditing = editingId === kp.id;
            const totalRefs =
              kp.scriptReferences.length + kp.partReferences.length + kp.noteReferences.length;

            return (
              <React.Fragment key={kp.id}>
                <tr
                  className={`border-b border-slate-100 transition-all duration-200 ${
                    kp.undoHighlight ? 'animate-pulse-soft' : ''
                  } hover:bg-slate-50`}
                >
                  <td className="py-3 px-4">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : kp.id)}
                      className="p-1 hover:bg-slate-200 rounded transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </td>
                  <td className="py-3 px-4 font-mono text-sm text-graphite-light">{kp.id}</td>
                  <td className="py-3 px-4 font-medium text-graphite">{kp.title}</td>
                  <td className="py-3 px-4 text-sm text-graphite-light">
                    {isEditing ? (
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded text-sm"
                        rows={3}
                      />
                    ) : (
                      <p className="line-clamp-2">{kp.content}</p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {isEditing ? (
                      <div className="flex flex-col gap-1">
                        <select
                          value={kp.status}
                          onChange={(e) =>
                            updateKnowledgeStatus(kp.id, e.target.value as KnowledgeStatus)
                          }
                          className="text-xs p-1 border border-slate-300 rounded"
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <StatusBadge status={kp.status} />
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded">
                      {totalRefs} 项
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <ProcessingBadge rule={kp.processingRule} />
                  </td>
                  <td className="py-3 px-4">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveEdit(kp.id)}
                          className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200 transition-colors"
                          title="保存"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors"
                          title="取消"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18"/>
                            <path d="m6 6 12 12"/>
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowTracePanel(true, kp.id)}
                          className="p-1.5 bg-space-blue/10 text-space-blue rounded hover:bg-space-blue/20 transition-colors"
                          title="查看追溯"
                        >
                          <Link size={14} />
                        </button>
                        <button
                          onClick={() => handleEdit(kp)}
                          className="p-1.5 bg-amber-100 text-amber-600 rounded hover:bg-amber-200 transition-colors"
                          title="编辑"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-slate-50">
                    <td colSpan={8} className="p-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <h6 className="text-xs font-medium text-blue-700 mb-2">状态快捷切换</h6>
                          <div className="flex flex-wrap gap-2">
                            {statusOptions.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => updateKnowledgeStatus(kp.id, opt.value)}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                                  kp.status === opt.value
                                    ? 'bg-space-blue text-white'
                                    : 'bg-white text-graphite hover:bg-slate-100'
                                }`}
                              >
                                <opt.icon size={12} />
                                {statusToText(opt.value)}
                              </button>
                            ))}
                          </div>
                        </div>
                        {isEditing && (
                          <div className="p-3 bg-amber-50 rounded-lg">
                            <h6 className="text-xs font-medium text-amber-700 mb-2">修改原因（必填）</h6>
                            <input
                              type="text"
                              value={editReason}
                              onChange={(e) => setEditReason(e.target.value)}
                              placeholder="请输入修改原因..."
                              className="w-full p-2 text-sm border border-amber-200 rounded"
                            />
                          </div>
                        )}
                        <div className="p-3 bg-purple-50 rounded-lg">
                          <h6 className="text-xs font-medium text-purple-700 mb-2">详细信息</h6>
                          <div className="space-y-1 text-xs text-graphite-light">
                            <p>创建时间：{kp.createdAt}</p>
                            <p>更新时间：{kp.updatedAt}</p>
                            <p>
                              关联：脚本 {kp.scriptReferences.length} · 零件{' '}
                              {kp.partReferences.length} · 备注 {kp.noteReferences.length}
                            </p>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
