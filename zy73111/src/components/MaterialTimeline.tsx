import type { Material } from '@shared/types';
import {
  Building2, Layers, MessageSquarePlus, Plus, RefreshCcw, User,
} from 'lucide-react';
import { ModifiedBadge, MaterialTypeTag } from '@/components/Tags';

const TYPE_ICON: Record<string, any> = {
  bim_note: Building2,
  boundary_sample: Layers,
  verbal_note: MessageSquarePlus,
  supplement: Plus,
};
const TYPE_COLOR: Record<string, string> = {
  bim_note: 'bg-blue-500',
  boundary_sample: 'bg-emerald-500',
  verbal_note: 'bg-purple-500',
  supplement: 'bg-amber-500',
};

export default function MaterialTimeline({
  materials,
}: {
  materials: Material[];
}) {
  const groups = new Map<string, Material[]>();
  for (const m of materials) {
    if (!groups.has(m.type)) groups.set(m.type, []);
    groups.get(m.type)!.push(m);
  }
  const flat: { type: string; label: string; items: Material[] }[] = [];
  for (const [type, items] of groups) {
    items.sort((a, b) => b.version - a.version);
    flat.push({ type, label: items[0].typeLabel, items });
  }

  return (
    <div className="space-y-5">
      {flat.map((g) => (
        <div key={g.type}>
          <div className="flex items-center gap-2 mb-2.5 pl-1">
            <span
              className={`w-2.5 h-2.5 rounded-full ${TYPE_COLOR[g.type] ?? 'bg-slate-400'}`}
            />
            <span className="text-xs font-semibold text-engineering-navy">
              {g.label}
              {g.items.length > 1 && (
                <span className="ml-1 text-[10px] text-history-gray font-normal">
                  {' '}· 共 {g.items.length} 个版本
                </span>
              )}
            </span>
          </div>
          <div className="pl-5 border-l-2 border-slate-200 space-y-3">
            {g.items.map((m, idx) => {
              const Icon = TYPE_ICON[m.type] ?? User;
              const isLatest = idx === 0;
              return (
                <div
                  key={m.id}
                  className={`relative ${m.isModifiedSinceLast ? 'ring-1 ring-caution-orange/50' : ''} panel`}
                >
                  <div
                    className={`absolute -left-[21px] top-3 w-3 h-3 rounded-full border-2 border-white ${
                      m.isModifiedSinceLast
                        ? 'bg-caution-orange'
                        : isLatest
                          ? 'bg-engineering-navy'
                          : 'bg-slate-300'
                    }`}
                  />
                  <div className="panel-header !py-2">
                    <div className="flex items-center gap-2">
                      <Icon size={13} className="text-slate-500" />
                      <MaterialTypeTag type={m.type} />
                      <span className="text-[11px] font-semibold mono text-slate-600">
                        v{m.version}
                      </span>
                      {m.isModifiedSinceLast && <ModifiedBadge />}
                    </div>
                    <div className="text-[10px] text-history-gray mono flex items-center gap-3">
                      <span>
                        {m.uploaderName} · {m.uploader}
                      </span>
                      <span>
                        {new Date(m.uploadedAt).toLocaleString('zh-CN', { hour12: false })}
                      </span>
                      <span title="内容MD5末4位">MD5:…{m.md5.slice(-4)}</span>
                    </div>
                  </div>
                  <div className="p-3 text-[12px] leading-relaxed whitespace-pre-wrap font-mono text-slate-700">
                    {m.content}
                  </div>
                  {m.isModifiedSinceLast && (
                    <div className="px-3 pb-2">
                      <div className="text-[10px] font-semibold text-caution-orange flex items-center gap-1">
                        <RefreshCcw size={10} />
                        相对上一版改了口径 — 在版本对比中查看字段Diff
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {!materials.length && (
        <div className="text-center py-8 text-sm text-history-gray">（此碰撞点暂无材料档案）</div>
      )}
    </div>
  );
}
