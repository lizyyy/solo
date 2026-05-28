import { useState } from 'react';
import { History, FileText, Clock, User, ChevronDown, ChevronUp, AlertTriangle, Tag, Image } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export const HistoryPanel = () => {
  const { history, caseNotes, addCaseNote, authorName, screenshots } = useAppStore();
  const [activeTab, setActiveTab] = useState<'history' | 'notes' | 'screenshots'>('history');
  const [newNote, setNewNote] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'window_adjust':
        return <Tag className="w-3 h-3" />;
      case 'annotation_add':
      case 'annotation_edit':
      case 'annotation_delete':
        return <FileText className="w-3 h-3" />;
      case 'screenshot_export':
        return <Image className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'window_adjust':
        return 'text-cyan-400 bg-cyan-500/20';
      case 'annotation_add':
        return 'text-green-400 bg-green-500/20';
      case 'annotation_edit':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'annotation_delete':
        return 'text-red-400 bg-red-500/20';
      case 'screenshot_export':
        return 'text-purple-400 bg-purple-500/20';
      default:
        return 'text-slate-400 bg-slate-500/20';
    }
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addCaseNote({
      content: newNote,
      author: authorName,
      sliceReferences: [],
      tags: [],
    });
    setNewNote('');
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 px-4 py-3 text-xs font-medium transition-all ${
            activeTab === 'history'
              ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <History className="w-4 h-4" />
            操作历史
          </div>
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 px-4 py-3 text-xs font-medium transition-all ${
            activeTab === 'notes'
              ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <FileText className="w-4 h-4" />
            病例备注
          </div>
        </button>
        <button
          onClick={() => setActiveTab('screenshots')}
          className={`flex-1 px-4 py-3 text-xs font-medium transition-all ${
            activeTab === 'screenshots'
              ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Image className="w-4 h-4" />
            截图
          </div>
        </button>
      </div>

      <div className="p-4 max-h-80 overflow-y-auto">
        {activeTab === 'history' && (
          <div className="space-y-2">
            {history.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                暂无操作记录
              </div>
            ) : (
              history.map((record) => (
                <div
                  key={record.id}
                  className="p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`p-1 rounded ${getActionColor(record.action)}`}>
                        {getActionIcon(record.action)}
                      </span>
                      <span className="text-slate-300 text-sm">{record.description}</span>
                    </div>
                    <button
                      onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      {expandedId === record.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {record.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(record.timestamp)}
                    </span>
                  </div>
                  {expandedId === record.id && record.beforeState && (
                    <div className="mt-2 p-2 bg-slate-900/50 rounded text-xs">
                      <div className="text-slate-400 mb-1">变更详情:</div>
                      <div className="text-slate-500 font-mono">
                        前: {JSON.stringify(record.beforeState)}
                      </div>
                      {record.afterState && (
                        <div className="text-slate-500 font-mono mt-1">
                          后: {JSON.stringify(record.afterState)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-600">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="添加病例备注..."
                className="w-full h-20 bg-transparent text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="px-3 py-1.5 bg-cyan-500 text-white rounded-lg text-xs font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  添加备注
                </button>
              </div>
            </div>

            {caseNotes.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                暂无病例备注
              </div>
            ) : (
              caseNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <p className="text-slate-300 text-sm">{note.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {note.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(note.timestamp)}
                    </span>
                  </div>
                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {note.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'screenshots' && (
          <div className="space-y-3">
            {screenshots.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
                暂无截图
              </div>
            ) : (
              screenshots.map((screenshot) => (
                <div
                  key={screenshot.id}
                  className="p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <img
                    src={screenshot.imageData}
                    alt={screenshot.description}
                    className="w-full h-32 object-cover rounded mb-2"
                  />
                  <p className="text-slate-300 text-sm">{screenshot.description}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {screenshot.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(screenshot.timestamp)}
                    </span>
                  </div>
                  <div className="flex gap-1 mt-2">
                    <span className="px-2 py-0.5 bg-slate-600 text-slate-300 rounded text-xs">
                      切片: {screenshot.sliceIndices.join(', ')}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-600 text-slate-300 rounded text-xs">
                      WW/WL: {screenshot.windowSettings.width}/{screenshot.windowSettings.center}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
