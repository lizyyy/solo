import React, { useState } from 'react';
import { Database, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store';
import { ImportZone } from '@/components/data/ImportZone';
import { DataList } from '@/components/data/DataList';
import { OperationHistory } from '@/components/data/OperationHistory';

export const DataPage: React.FC = () => {
  const {
    scripts,
    parts,
    notes,
    knowledgePoints,
    operationLogs,
    generateKnowledgeFromScripts,
    initializeWithMockData,
    clearAllData,
    addNote,
  } = useAppStore();

  const [noteContent, setNoteContent] = useState('');
  const [noteRelatedTo, setNoteRelatedTo] = useState('');
  const [showNoteForm, setShowNoteForm] = useState(false);

  const handleAddNote = () => {
    if (noteContent.trim()) {
      addNote(noteContent, noteRelatedTo || 'general');
      setNoteContent('');
      setNoteRelatedTo('');
      setShowNoteForm(false);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('确定要清空所有数据吗？此操作不可恢复！')) {
      clearAllData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-graphite flex items-center gap-3">
            <Database className="text-star-gold" />
            数据管理
          </h2>
          <p className="text-graphite-light mt-1">
            管理演示脚本、零件清单和零散备注
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={generateKnowledgeFromScripts}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={16} />
            生成知识点
          </button>
          <button
            onClick={initializeWithMockData}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={16} />
            加载演示数据
          </button>
          <button
            onClick={handleClearAll}
            className="px-4 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-all duration-200 flex items-center gap-2"
          >
            <Trash2 size={16} />
            清空数据
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ImportZone type="script" />
        <ImportZone type="part" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif font-semibold text-graphite">添加零散备注</h3>
          <button
            onClick={() => setShowNoteForm(!showNoteForm)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus size={14} />
            {showNoteForm ? '收起' : '添加备注'}
          </button>
        </div>

        {showNoteForm && (
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg animate-fade-in">
            <div>
              <label className="block text-sm font-medium text-graphite mb-1">
                备注内容
              </label>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="输入备注内容..."
                className="input-field h-24 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-graphite mb-1">
                关联知识点ID（可选）
              </label>
              <input
                type="text"
                value={noteRelatedTo}
                onChange={(e) => setNoteRelatedTo(e.target.value)}
                placeholder="如 k001，不填则标记为通用备注"
                className="input-field"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowNoteForm(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleAddNote}
                className="btn-primary"
              >
                保存备注
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DataList
            scripts={scripts}
            parts={parts}
            notes={notes}
            knowledgePoints={knowledgePoints}
          />
        </div>
        <div>
          <OperationHistory logs={operationLogs} />
        </div>
      </div>
    </div>
  );
};
