import { useState } from "react";
import { ShieldAlert, ShieldCheck, Lock, Unlock, Plus } from "lucide-react";
import { useExplanationStore } from "@/store/useExplanationStore";
import { USERS, ITEMS } from "@/data/sample";
import { formatTime } from "@/utils/matrix";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils";

export function QuarantineZone() {
  const unitMissing = useExplanationStore((s) => s.unitMissing);
  const restoreUnitMissing = useExplanationStore((s) => s.restoreUnitMissing);
  const quarantineCell = useExplanationStore((s) => s.quarantineCell);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [restoreReason, setRestoreReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [newUser, setNewUser] = useState<string>(USERS[0]);
  const [newItem, setNewItem] = useState<string>(ITEMS[0].split(" ")[0]);
  const [newReason, setNewReason] = useState("");

  const active = unitMissing.filter((u) => !u.restored);
  const restored = unitMissing.filter((u) => u.restored);

  const doRestore = (id: string) => {
    if (!restoreReason.trim()) return;
    restoreUnitMissing(id, restoreReason.trim());
    setRestoreId(null);
    setRestoreReason("");
  };

  const doQuarantine = () => {
    if (!newReason.trim()) return;
    quarantineCell(`${newUser}:${newItem}`, newUser, newItem, newReason.trim());
    setNewReason("");
    setAdding(false);
  };

  return (
    <SectionCard
      tone="unit-missing"
      title="单位缺失隔离区"
      subtitle="这类记录不揉进正常结果，单独拎出来复核"
      icon={<ShieldAlert className="h-4 w-4" />}
      action={
        <Button
          size="sm"
          variant="danger"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => setAdding((v) => !v)}
        >
          隔离新记录
        </Button>
      }
    >
      {adding && (
        <div className="mb-3 space-y-2 rounded-md border border-dashed border-unit-missing/50 bg-unit-missing-soft/40 p-3">
          <div className="flex flex-wrap gap-2">
            <select
              value={newUser}
              onChange={(e) => setNewUser(e.target.value)}
              className="rounded-atlas border border-line bg-surface px-2 py-1 font-mono-data text-xs text-ink"
            >
              {USERS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <select
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              className="rounded-atlas border border-line bg-surface px-2 py-1 font-mono-data text-xs text-ink"
            >
              {ITEMS.map((it) => (
                <option key={it} value={it.split(" ")[0]}>
                  {it}
                </option>
              ))}
            </select>
          </div>
          <input
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="为何判定单位缺失（如：外壳百分比与计数混用）"
            className="w-full rounded-atlas border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-unit-missing focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              取消
            </Button>
            <Button size="sm" variant="danger" onClick={doQuarantine}>
              确认隔离
            </Button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {active.map((u) => (
          <li
            key={u.id}
            className="rounded-md border border-unit-missing/40 bg-unit-missing-soft/30 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-unit-missing" />
                  <span className="font-mono-data text-sm font-semibold text-ink">
                    {u.userId} × {u.itemId}
                  </span>
                  <Pill tone="unit-missing">隔离中 · 不计入正常结果</Pill>
                </div>
                <p className="mt-1 text-xs text-ink-soft">{u.reason}</p>
                <p className="mt-1 font-mono-data text-[10px] text-ink-mute">
                  隔离于 {formatTime(u.quarantinedAt)}
                </p>
              </div>
            </div>
            {restoreId === u.id ? (
              <div className="mt-2 space-y-2 border-t border-unit-missing/20 pt-2">
                <input
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  placeholder="恢复理由（如：已补齐量纲，统一为百分比）"
                  className="w-full rounded-atlas border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-normal focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setRestoreId(null)}>
                    取消
                  </Button>
                  <Button size="sm" variant="primary" icon={<Unlock className="h-3.5 w-3.5" />} onClick={() => doRestore(u.id)}>
                    确认恢复
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Unlock className="h-3.5 w-3.5" />}
                  onClick={() => setRestoreId(u.id)}
                >
                  恢复为正常
                </Button>
              </div>
            )}
          </li>
        ))}

        {restored.map((u) => (
          <li
            key={u.id}
            className="rounded-md border border-line bg-surface-2/40 p-3 opacity-80"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-normal" />
              <span className="font-mono-data text-sm font-semibold text-ink-soft">
                {u.userId} × {u.itemId}
              </span>
              <Pill tone="normal">已恢复</Pill>
            </div>
            <p className="mt-1 text-xs text-ink-soft">{u.reason}</p>
            {u.restoreReason && (
              <p className="mt-1 text-xs text-ink-mute">恢复理由：{u.restoreReason}</p>
            )}
          </li>
        ))}

        {unitMissing.length === 0 && (
          <li className="rounded-md border border-dashed border-line py-6 text-center text-xs text-ink-mute">
            暂无隔离记录
          </li>
        )}
      </ul>

      <p className={cn("mt-3 text-[11px] text-ink-mute")}>
        当前隔离 {active.length} 项 · 已恢复 {restored.length} 项。隔离项默认排除出正常结果统计，顶部摘要同步体现。
      </p>
    </SectionCard>
  );
}
