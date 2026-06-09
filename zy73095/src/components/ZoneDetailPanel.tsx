import { useState } from 'react';
import { X, User, CalendarDays, Plus, Link2Off, CheckCircle2 } from 'lucide-react';
import { useReviewStore } from '@/store/reviewStore';
import { SOURCE_COLORS, SOURCE_LABELS, STATUS_COLORS, STATUS_LABELS, type Material } from '@/types';
import { computeZoneStatusFromMaterials } from '@/utils/conclusion';

function MaterialCard({ m }: { m: Material }) {
  const color = SOURCE_COLORS[m.source];
  return (
    <div
      className="border p-3 space-y-2"
      style={{ borderLeftWidth: 3, borderLeftColor: color, background: 'rgba(15,23,42,0.5)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="eng-tag text-[10px]"
              style={{ borderColor: color, color }}
            >
              {SOURCE_LABELS[m.source]}
            </span>
            {m.affectsConclusion && (
              <span className="eng-tag border-eng-warn text-eng-warn text-[10px]">
                影响结论
              </span>
            )}
          </div>
          <div className="text-sm text-eng-text mt-1 break-words">{m.title}</div>
        </div>
        {m.affectsConclusion && (
          <Link2Off size={14} className="text-eng-warn mt-0.5 shrink-0" />
        )}
      </div>
      <div className="text-xs text-eng-dim leading-relaxed whitespace-pre-wrap">{m.content}</div>
      <div className="flex items-center gap-3 text-[10px] text-eng-muted font-mono">
        <span className="flex items-center gap-1">
          <CalendarDays size={11} /> {new Date(m.recordedAt).toLocaleString('zh-CN', { hour12: false })}
        </span>
        <span className="flex items-center gap-1">
          <User size={11} /> {m.operator}
        </span>
      </div>
    </div>
  );
}

export default function ZoneDetailPanel() {
  const {
    selectedZone,
    sourceFilter,
    showDetailPanel,
    toggleDetailPanel,
    selectZone,
    addSupplementaryNote,
  } = useReviewStore();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [operator, setOperator] = useState('施工·阿乔');
  const [showForm, setShowForm] = useState(false);

  if (!selectedZone) return null;

  const visibleMaterials = selectedZone.materials.filter((m) => sourceFilter[m.source]);
  const hiddenCount = selectedZone.materials.length - visibleMaterials.length;
  const currentStatus = computeZoneStatusFromMaterials(selectedZone.materials, sourceFilter);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    addSupplementaryNote(selectedZone.id, title.trim(), content.trim(), operator.trim() || '未署名');
    setTitle('');
    setContent('');
    setShowForm(false);
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-20 bg-black/40 transition-opacity ${
          showDetailPanel ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => {
          toggleDetailPanel(false);
          selectZone(null);
        }}
      />

      <aside
        className={`fixed right-0 top-0 bottom-0 z-30 w-[380px] eng-panel overflow-hidden flex flex-col transition-transform ${
          showDetailPanel ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="px-4 py-3 border-b border-eng-border flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base text-eng-warn">{selectedZone.id}</span>
              <span
                className="eng-tag text-[10px]"
                style={{
                  borderColor: STATUS_COLORS[selectedZone.status],
                  color: STATUS_COLORS[selectedZone.status],
                }}
              >
                原始：{STATUS_LABELS[selectedZone.status]}
              </span>
            </div>
            <div className="text-sm text-eng-text mt-1">{selectedZone.name}</div>
            <div className="text-[10px] font-mono text-eng-muted mt-0.5">
              楼层 {selectedZone.floor < 0 ? 'B' + Math.abs(selectedZone.floor) : 'F' + selectedZone.floor} · 尺寸{' '}
              {selectedZone.size.map((n) => n.toFixed(1)).join('×')} m
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-eng-muted">当前筛选下判定：</span>
              <span
                className="eng-tag text-[11px] flex items-center gap-1"
                style={{
                  borderColor:
                    currentStatus === 'unreviewed'
                      ? '#475569'
                      : STATUS_COLORS[currentStatus as keyof typeof STATUS_COLORS],
                  color:
                    currentStatus === 'unreviewed'
                      ? '#94A3B8'
                      : STATUS_COLORS[currentStatus as keyof typeof STATUS_COLORS],
                }}
              >
                <CheckCircle2 size={11} />
                {currentStatus === 'unreviewed' ? '未复核' : STATUS_LABELS[currentStatus as keyof typeof STATUS_COLORS]}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              toggleDetailPanel(false);
              selectZone(null);
            }}
            className="eng-btn py-1 px-2"
          >
            <X size={14} />
          </button>
        </header>

        <div className="px-4 py-3 border-b border-eng-border flex items-center justify-between">
          <div>
            <div className="text-sm text-eng-text">关联材料</div>
            <div className="text-[10px] text-eng-muted font-mono">
              显示 {visibleMaterials.length} / 共 {selectedZone.materials.length}
              {hiddenCount > 0 && ` · ${hiddenCount} 条被筛选隐藏`}
            </div>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="eng-btn-primary eng-btn text-xs flex items-center gap-1"
          >
            <Plus size={13} /> 补录备注
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="border-b border-eng-border p-4 space-y-2 bg-eng-panel2/40"
          >
            <div className="text-xs text-eng-muted mb-1">新增后补备注（将立即重算结论并写入历史）</div>
            <input
              className="eng-input"
              placeholder="备注标题，如：现场测量记录补录"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="eng-input min-h-[72px] resize-none"
              placeholder="详细内容……"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <input
              className="eng-input"
              placeholder="操作人"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="eng-btn text-xs"
              >
                取消
              </button>
              <button type="submit" className="eng-btn-primary eng-btn text-xs">
                提交并重新判定
              </button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {visibleMaterials.length === 0 ? (
            <div className="eng-panel p-4 text-center text-xs text-eng-muted">
              当前筛选条件下无可见材料。请调整左侧「材料来源筛选」开关。
            </div>
          ) : (
            visibleMaterials.map((m) => <MaterialCard key={m.id} m={m} />)
          )}

          {visibleMaterials.some((m) => m.affectsConclusion) && (
            <div className="mt-4 border-2 border-dashed border-eng-warn/50 p-3 text-xs space-y-1.5 bg-eng-warn/5">
              <div className="text-eng-warn font-bold flex items-center gap-1">
                <Link2Off size={13} /> 结论影响链
              </div>
              <div className="text-eng-dim leading-relaxed">
                本分区共{' '}
                <span className="text-eng-warn font-mono">
                  {visibleMaterials.filter((m) => m.affectsConclusion).length}
                </span>{' '}
                条材料直接影响结论：
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-eng-muted pl-1">
                {visibleMaterials
                  .filter((m) => m.affectsConclusion)
                  .map((m) => (
                    <li key={m.id}>
                      <span style={{ color: SOURCE_COLORS[m.source] }}>{SOURCE_LABELS[m.source]}</span>
                      <span className="text-eng-dim">：{m.title}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
