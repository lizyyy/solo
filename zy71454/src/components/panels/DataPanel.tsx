import { useState } from 'react';
import { X, Edit2, Save, Clock, Gauge, Music, ChevronDown, ChevronUp } from 'lucide-react';
import usePianoStore from '../../store/usePianoStore';
import PressureChart from './PressureChart';
import EvidenceTimeline from './EvidenceTimeline';
import RelatedKeys from './RelatedKeys';

export default function DataPanel() {
  const { selectedKey, keys, notes, setSelectedKey, addNote, togglePanel, showPanel } = usePianoStore();
  const [isEditing, setIsEditing] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const selectedKeyData = keys.find(k => k.keyNumber === selectedKey);
  const keyNotes = notes.filter(n => n.keyNumber === selectedKey).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (!selectedKey || !selectedKeyData) {
    return (
      <div className="w-96 bg-zinc-900 border-l border-zinc-700 flex flex-col items-center justify-center text-zinc-500">
        <Music size={48} className="mb-4 opacity-30" />
        <p className="text-sm">点击琴键查看详情</p>
      </div>
    );
  }

  const handleSaveNote = () => {
    if (newNote.trim()) {
      addNote(selectedKey, newNote, '当前用户');
      setNewNote('');
      setIsEditing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!showPanel) {
    return null;
  }

  return (
    <div className="w-96 bg-zinc-900 border-l border-zinc-700 flex flex-col h-full">
      <div className="p-4 border-b border-zinc-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${selectedKeyData.isBlack ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-800'}`}>
              {selectedKeyData.noteName}
            </div>
            <div>
              <h3 className="font-semibold text-zinc-100">键号 #{selectedKey}</h3>
              <p className="text-xs text-zinc-500">{selectedKeyData.isBlack ? '黑键' : '白键'} · 第 {selectedKeyData.octave} 八度</p>
            </div>
          </div>
          <button
            onClick={togglePanel}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
              <Gauge size={12} />
              下压力
            </div>
            <div className="text-2xl font-bold text-zinc-100">
              {selectedKeyData.pressure}
              <span className="text-sm font-normal text-zinc-500 ml-1">g</span>
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
              <Clock size={12} />
              回弹时间
            </div>
            <div className="text-2xl font-bold text-zinc-100">
              {selectedKeyData.reboundTime}
              <span className="text-sm font-normal text-zinc-500 ml-1">ms</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <PressureChart keyData={selectedKeyData} />

        <RelatedKeys currentKey={selectedKey} />

        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-zinc-300">调律备注</h4>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 hover:bg-zinc-700 rounded transition-colors text-zinc-400 hover:text-zinc-200"
              >
                <Edit2 size={14} />
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="输入调律备注..."
                className="w-full bg-zinc-900 border border-zinc-600 rounded-lg p-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500 resize-none"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setIsEditing(false); setNewNote(''); }}
                  className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveNote}
                  className="px-3 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center gap-1"
                >
                  <Save size={14} />
                  保存
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {keyNotes.length > 0 ? (
                keyNotes.map((note, idx) => (
                  <div key={note.id} className={`${idx > 0 ? 'pt-2 border-t border-zinc-700' : ''}`}>
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                      <span>{note.author} · {note.version}</span>
                      <span>{formatDate(note.createdAt)}</span>
                    </div>
                    <p className="text-sm text-zinc-300">{note.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-600 italic">暂无备注</p>
              )}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between bg-zinc-800/50 rounded-lg p-3 hover:bg-zinc-800 transition-colors"
          >
            <span className="text-sm font-medium text-zinc-300">操作证据链</span>
            {showHistory ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
          </button>
          {showHistory && <EvidenceTimeline keyNumber={selectedKey} />}
        </div>
      </div>
    </div>
  );
}
