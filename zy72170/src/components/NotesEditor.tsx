import { useState } from 'react';
import { FileText, Plus, Save } from 'lucide-react';
import { useTrailStore } from '@/store/useStore';

export default function NotesEditor() {
  const notes = useTrailStore((s) => s.notes);
  const updateNote = useTrailStore((s) => s.updateNote);
  const addNote = useTrailStore((s) => s.addNote);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newStreet, setNewStreet] = useState('');

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
    const street = newStreet.trim() || '默认街道';
    addNote('', street, '');
    setNewStreet('');
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
              {streetNotes.map((note) => (
                <div key={note.id} className="relative">
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
              ))}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <div className="py-8 text-center text-sm text-stone-400">暂无备注</div>
        )}
        <div className="flex items-center gap-2 pt-2 border-t border-stone-200">
          <input
            value={newStreet}
            onChange={(e) => setNewStreet(e.target.value)}
            placeholder="街道名称（可选）"
            className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#1a535c]"
          />
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 rounded-md bg-[#1a535c] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#154449] transition-colors"
          >
            <Plus size={14} />
            添加备注
          </button>
        </div>
      </div>
    </div>
  );
}
