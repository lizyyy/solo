import { useState } from 'react';
import { FileText, Plus, Save } from 'lucide-react';
import { useTrailStore } from '@/store/useStore';

export default function NotesEditor() {
  const notes = useTrailStore((s) => s.notes);
  const points = useTrailStore((s) => s.points);
  const updateNote = useTrailStore((s) => s.updateNote);
  const addNote = useTrailStore((s) => s.addNote);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPointId, setNewPointId] = useState('');
  const [newContent, setNewContent] = useState('');

  const grouped = notes.reduce<Record<string, typeof notes>>((acc, note) => {
    const street = note.street;
    if (!acc[street]) acc[street] = [];
    acc[street].push(note);
    return acc;
  }, {});

  const handleBlur = (noteId: string, content: string) => {
    setSavingId(noteId);
    updateNote(noteId, content);
    setTimeout(() => setSavingId(null), 800);
  };

  const handleAdd = () => {
    if (!newPointId || !newContent.trim()) return;
    const point = points.find((p) => p.id === newPointId);
    if (!point) return;
    addNote(newPointId, point.street, newContent.trim());
    setNewPointId('');
    setNewContent('');
    setShowAddForm(false);
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-200">
        <FileText size={18} className="text-[#1a535c]" />
        <span className="font-semibold text-[#1a535c]">人工备注</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {Object.entries(grouped).map(([street, streetNotes]) => (
          <div key={street}>
            <h3 className="text-sm font-semibold text-[#1a535c] mb-2">{street}</h3>
            <div className="space-y-2">
              {streetNotes.map((note) => {
                const point = points.find((p) => p.id === note.pointId);
                return (
                  <div key={note.id} className="relative">
                    {point && (
                      <div className="text-xs text-[#4ecdc4] mb-1">{point.name}</div>
                    )}
                    {!note.pointId && (
                      <div className="text-xs text-orange-500 mb-1">未关联点位</div>
                    )}
                    <textarea
                      defaultValue={note.content}
                      onBlur={(e) => handleBlur(note.id, e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#1a535c] transition-shadow"
                      placeholder="输入备注内容..."
                    />
                    {savingId === note.id && (
                      <span className="absolute top-1 right-2 flex items-center gap-1 text-xs text-[#4ecdc4]">
                        <Save size={12} />
                        已保存
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && !showAddForm && (
          <div className="py-8 text-center text-sm text-stone-400">暂无备注</div>
        )}

        {showAddForm && (
          <div className="bg-stone-50 rounded-lg p-3 space-y-2 border border-stone-200">
            <div>
              <label className="text-xs text-stone-500 mb-1 block">关联点位 *</label>
              <select
                value={newPointId}
                onChange={(e) => setNewPointId(e.target.value)}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#1a535c]"
              >
                <option value="">请选择点位</option>
                {points.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}（{p.street}）</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">备注内容 *</label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#1a535c]"
                placeholder="输入备注内容..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowAddForm(false); setNewPointId(''); setNewContent(''); }}
                className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                disabled={!newPointId || !newContent.trim()}
                className="flex items-center gap-1 rounded-md bg-[#1a535c] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#154449] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={14} />
                保存备注
              </button>
            </div>
          </div>
        )}

        {!showAddForm && (
          <div className="pt-2 border-t border-stone-200">
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1 rounded-md bg-[#1a535c] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#154449] transition-colors"
            >
              <Plus size={14} />
              添加备注
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
