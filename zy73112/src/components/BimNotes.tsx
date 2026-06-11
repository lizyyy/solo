import { useState } from 'react';
import { Plus, Search, Tag, Clock, User, Trash2, FileText } from 'lucide-react';
import type { BimNote } from '../types';

interface BimNotesProps {
  notes: BimNote[];
  onSelectNote?: (note: BimNote) => void;
  selectedNoteId?: string;
}

export default function BimNotes({ notes, onSelectNote, selectedNoteId }: BimNotesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedNote, setSelectedNote] = useState<BimNote | null>(null);

  const filteredNotes = notes.filter((note) => {
    if (!showDeleted && note.isDeleted) return false;
    if (searchTerm && !note.title.includes(searchTerm) && !note.content.includes(searchTerm)) return false;
    return true;
  });

  const activeCount = notes.filter(n => !n.isDeleted).length;
  const deletedCount = notes.filter(n => n.isDeleted).length;

  const handleNoteClick = (note: BimNote) => {
    setSelectedNote(note);
    onSelectNote?.(note);
  };

  return (
    <div className="h-full flex">
      <div className="w-80 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">BIM模型备注</h3>
            <button className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Plus size={18} />
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索备注..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setShowDeleted(false)}
              className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                !showDeleted
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              有效 ({activeCount})
            </button>
            <button
              onClick={() => setShowDeleted(true)}
              className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                showDeleted
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              已作废 ({deletedCount})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredNotes.map((note) => (
            <button
              key={note.id}
              onClick={() => handleNoteClick(note)}
              className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                selectedNoteId === note.id || selectedNote?.id === note.id
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-white border border-slate-200 hover:border-blue-300'
              } ${note.isDeleted ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-slate-800 line-clamp-1">{note.title}</p>
                {note.isDeleted && (
                  <Trash2 size={14} className="text-slate-400 flex-shrink-0 ml-2" />
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{note.content}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <User size={12} />
                  {note.author}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {new Date(note.updatedAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {note.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded"
                  >
                    <Tag size={10} />
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white">
        {selectedNote ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-4">
              <div className="flex items-start justify-between">
                <h2 className="text-xl font-semibold text-slate-800">{selectedNote.title}</h2>
                {selectedNote.isDeleted && (
                  <span className="px-2.5 py-1 text-xs bg-slate-100 text-slate-600 rounded-full">
                    已作废
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <User size={14} />
                  {selectedNote.author}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={14} />
                  更新于 {new Date(selectedNote.updatedAt).toLocaleString('zh-CN')}
                </span>
                <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
                  模型版本：{selectedNote.modelVersion}
                </span>
              </div>
            </div>

            {selectedNote.isDeleted && selectedNote.deletedReason && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <span className="font-medium">作废原因：</span>
                  {selectedNote.deletedReason}
                </p>
              </div>
            )}

            <div className="prose prose-sm max-w-none">
              <h4 className="text-sm font-medium text-slate-700 mb-2">备注内容</h4>
              <p className="text-sm text-slate-600 leading-relaxed">{selectedNote.content}</p>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-medium text-slate-700 mb-2">标签</h4>
              <div className="flex flex-wrap gap-2">
                {selectedNote.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-sm bg-slate-100 text-slate-700 rounded-full"
                  >
                    <Tag size={12} />
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-3">溯源信息</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">创建时间</p>
                  <p className="text-slate-700 mt-1">{new Date(selectedNote.createdAt).toLocaleString('zh-CN')}</p>
                </div>
                <div>
                  <p className="text-slate-500">备注编号</p>
                  <p className="text-slate-700 mt-1 font-mono">{selectedNote.id}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <FileText size={48} className="mx-auto mb-3 opacity-50" />
              <p>选择一条BIM备注查看详情</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
