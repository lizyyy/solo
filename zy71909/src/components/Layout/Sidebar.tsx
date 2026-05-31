import { useState } from 'react';
import { X, Music, Calendar, FileText, User, Plus, Trash2, Edit2, Save } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { getNoteSourceLabel } from '../../utils/classification';

export function Sidebar() {
  const { 
    sidebarOpen, 
    setSidebarOpen, 
    batches, 
    notes,
    addBatch,
    addNote,
    selectedBatchId,
    setSelectedBatchId,
  } = useAppStore();
  
  const [showNewBatchForm, setShowNewBatchForm] = useState(false);
  const [newBatch, setNewBatch] = useState({
    title: '',
    rehearsalDate: '',
    songName: '',
    keySignature: '',
    totalMeasures: 16,
    recordingFileName: '',
    status: 'draft' as const,
  });
  const [newNote, setNewNote] = useState({
    source: 'monitor' as const,
    content: '',
    author: '',
    relatedMeasure: '',
  });

  const sortedBatches = [...batches].sort((a, b) => 
    b.rehearsalDate.localeCompare(a.rehearsalDate)
  );

  const batchNotes = selectedBatchId 
    ? notes.filter(n => n.batchId === selectedBatchId)
    : [];

  const handleCreateBatch = () => {
    if (newBatch.title && newBatch.rehearsalDate) {
      addBatch(newBatch);
      setNewBatch({
        title: '',
        rehearsalDate: '',
        songName: '',
        keySignature: '',
        totalMeasures: 16,
        recordingFileName: '',
        status: 'draft',
      });
      setShowNewBatchForm(false);
    }
  };

  const handleAddNote = () => {
    if (selectedBatchId && newNote.content && newNote.author) {
      addNote({
        batchId: selectedBatchId,
        source: newNote.source,
        content: newNote.content,
        author: newNote.author,
        relatedMeasure: newNote.relatedMeasure ? parseInt(newNote.relatedMeasure) : undefined,
      });
      setNewNote({
        source: 'monitor',
        content: '',
        author: '',
        relatedMeasure: '',
      });
    }
  };

  if (!sidebarOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={() => setSidebarOpen(false)}
      />
      
      <div className="relative w-96 h-full bg-white shadow-2xl animate-slide-up flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-cream-200">
          <h2 className="font-serif text-lg font-semibold text-primary">批次管理</h2>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-cream-100 transition-colors"
          >
            <X className="w-5 h-5 text-primary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-primary-600 flex items-center gap-2">
                <Music className="w-4 h-4 text-accent" />
                排练批次
              </h3>
              <button
                onClick={() => setShowNewBatchForm(!showNewBatchForm)}
                className="text-xs text-accent hover:text-accent-600 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                新建
              </button>
            </div>

            {showNewBatchForm && (
              <div className="mb-4 p-3 bg-cream-50 rounded-xl border border-cream-200">
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="批次标题"
                    value={newBatch.title}
                    onChange={e => setNewBatch({ ...newBatch, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                  <input
                    type="date"
                    value={newBatch.rehearsalDate}
                    onChange={e => setNewBatch({ ...newBatch, rehearsalDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                  <input
                    type="text"
                    placeholder="曲目名称"
                    value={newBatch.songName}
                    onChange={e => setNewBatch({ ...newBatch, songName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                  <input
                    type="text"
                    placeholder="调性（如：F大调）"
                    value={newBatch.keySignature}
                    onChange={e => setNewBatch({ ...newBatch, keySignature: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                  <input
                    type="number"
                    placeholder="小节数"
                    value={newBatch.totalMeasures}
                    onChange={e => setNewBatch({ ...newBatch, totalMeasures: parseInt(e.target.value) || 16 })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                  <button
                    onClick={handleCreateBatch}
                    className="w-full btn-secondary text-sm"
                  >
                    <Save className="w-4 h-4 inline mr-1" />
                    创建批次
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {sortedBatches.map(batch => (
                <button
                  key={batch.id}
                  onClick={() => setSelectedBatchId(batch.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all ${
                    selectedBatchId === batch.id
                      ? 'bg-accent/10 border border-accent/30'
                      : 'bg-white border border-cream-200 hover:border-accent/30 hover:bg-accent/5'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-primary">{batch.title}</h4>
                      <p className="text-xs text-primary-500 mt-0.5">{batch.rehearsalDate}</p>
                      <p className="text-xs text-primary-400 mt-0.5 truncate">{batch.songName}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      batch.status === 'final' ? 'bg-green-100 text-green-700' :
                      batch.status === 'reviewed' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {batch.status === 'final' ? '定稿' :
                       batch.status === 'reviewed' ? '已复核' : '草稿'}
                    </span>
                  </div>
                  {batch.keyChanged && (
                    <div className="mt-2 text-[10px] text-accent-600 bg-accent/10 px-2 py-0.5 rounded inline-block">
                      转调：{batch.previousKey} → {batch.keySignature}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-primary-600 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              备注记录
              {selectedBatchId && (
                <span className="text-xs text-primary-400">（当前批次）</span>
              )}
            </h3>

            {selectedBatchId ? (
              <>
                <div className="mb-4 p-3 bg-cream-50 rounded-xl border border-cream-200">
                  <div className="space-y-2">
                    <select
                      value={newNote.source}
                      onChange={e => setNewNote({ ...newNote, source: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                    >
                      <option value="monitor">声部长备注</option>
                      <option value="teacher">老师标注</option>
                      <option value="selection">选曲变更</option>
                    </select>
                    <input
                      type="text"
                      placeholder="记录人"
                      value={newNote.author}
                      onChange={e => setNewNote({ ...newNote, author: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                    />
                    <input
                      type="number"
                      placeholder="相关小节（可选）"
                      value={newNote.relatedMeasure}
                      onChange={e => setNewNote({ ...newNote, relatedMeasure: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                    />
                    <textarea
                      placeholder="备注内容"
                      value={newNote.content}
                      onChange={e => setNewNote({ ...newNote, content: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={!newNote.content || !newNote.author}
                      className="w-full btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4 inline mr-1" />
                      添加备注
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {batchNotes.length === 0 ? (
                    <p className="text-sm text-primary-400 text-center py-4">暂无备注</p>
                  ) : (
                    batchNotes.map(note => (
                      <div key={note.id} className="p-3 bg-white rounded-xl border border-cream-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-primary/10 text-primary-700">
                            {getNoteSourceLabel(note.source)}
                          </span>
                          <span className="text-[10px] text-primary-400">
                            {note.createdAt.slice(0, 10)}
                          </span>
                        </div>
                        <p className="text-sm text-primary-700">{note.content}</p>
                        <p className="text-xs text-primary-500 mt-2">— {note.author}</p>
                        {note.relatedMeasure && (
                          <p className="text-xs text-accent-600 mt-1">相关小节：第{note.relatedMeasure}小节</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-primary-400 text-center py-4">请先选择一个批次</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
