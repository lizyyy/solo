import { Html } from '@react-three/drei';
import type { ModelComponent } from '@/shared/types';
import { useChecklistStore } from '@/store/checklistStore';
import { useUiStore } from '@/store/uiStore';
import { statusLabel } from '@/utils/diff';

interface Props {
  component: ModelComponent;
}

export function SelectedBubble({ component }: Props) {
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const currentBatchId = useChecklistStore((s) => s.currentBatchId);
  const batches = useChecklistStore((s) => s.batches);
  const visaForms = useChecklistStore((s) => s.visaForms);
  const matSubs = useChecklistStore((s) => s.materialSubmissions);

  if (selectedId !== component.id) return null;
  const batch = currentBatchId ? batches[currentBatchId] : null;
  const item = batch?.items.find((i) => i.componentId === component.id);
  const issues = batch?.issues.filter((i) => {
    const cid = batch.items.find((it) => it.itemId === i.itemId)?.componentId;
    return cid === component.id;
  });
  const visa = Object.values(visaForms).find((v) => v.componentId === component.id);
  const mat = Object.values(matSubs).find((m) => m.componentId === component.id);

  const center = [
    component.position.x + component.size.x / 2,
    component.position.y + component.size.y / 2 + component.size.y / 2 + 0.6,
    component.position.z + component.size.z / 2,
  ] as const;

  const statusColor =
    item?.matchStatus === 'matched'
      ? 'text-emerald-300'
      : item?.matchStatus === 'mismatched'
        ? 'text-orange-300'
        : 'text-slate-300';

  return (
    <Html position={center} style={{ pointerEvents: 'none' }} distanceFactor={6}>
      <div className="pointer-events-none whitespace-nowrap rounded-md border border-blue-400/60 bg-slate-900/90 px-3 py-2 text-xs text-white shadow-lg backdrop-blur">
        <div className="font-bold text-amber-300" style={{ fontFamily: '"Noto Serif SC", serif' }}>
          {component.name}
        </div>
        <div className="mt-0.5 text-[10px] text-slate-400 font-mono">{component.id}</div>
        {item && (
          <div className={`mt-1 text-[11px] ${statusColor}`}>
            比对状态：{statusLabel[item.matchStatus]}
          </div>
        )}
        {(issues?.length ?? 0) > 0 && (
          <div className="mt-1 text-[10px] text-orange-300">疑点 {issues!.length} 条</div>
        )}
        <div className="mt-1 grid grid-cols-2 gap-x-3 text-[10px] text-slate-400">
          <div>签证单：{visa ? visa.visaNo.slice(0, 14) + '…' : '无'}</div>
          <div>材料：{mat ? mat.batchNo.slice(0, 14) + '…' : '无'}</div>
        </div>
      </div>
    </Html>
  );
}
