import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useReplayStore } from '@/store/useReplayStore';
import { Button, SectionLabel, Card } from './primitives';

export function SupplementaryNotePanel({ runId }: { runId: string }) {
  const note = useReplayStore((s) => s.notes[runId]);
  const setNote = useReplayStore((s) => s.setSupplementaryNote);
  const [val, setVal] = useState(note?.note ?? '');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setVal(note?.note ?? '');
  }, [runId, note?.note]);

  return (
    <Card>
      <SectionLabel hint="改判后可追加，随 runId 保留不断线">后补说明</SectionLabel>
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="补充说明：复核结论、影响范围、来源行线索…"
        rows={3}
        className="mb-2 w-full resize-none rounded-sm border border-white/10 bg-ink-900/70 p-2 text-xs leading-relaxed text-ink-200 outline-none focus:border-accent/60"
      />
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>
          {savedAt
            ? `已保存 · ${new Date(savedAt).toLocaleString('zh-CN')}`
            : note
              ? `更新于 ${new Date(note.updatedAt).toLocaleString('zh-CN')}`
              : '尚未填写'}
        </span>
        <Button
          variant="subtle"
          onClick={() => {
            setNote(runId, val);
            setSavedAt(Date.now());
          }}
        >
          <Save className="h-3.5 w-3.5" />
          保存
        </Button>
      </div>
    </Card>
  );
}
