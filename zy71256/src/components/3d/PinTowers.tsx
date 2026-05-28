import { useMemo } from 'react';
import { useChipStore } from '@/store/chipStore';
import { useFilterStore } from '@/store/filterStore';
import { useSelectionStore } from '@/store/selectionStore';
import PinTower from './PinTower';

export default function PinTowers() {
  const pins = useChipStore((s) => s.pins);
  const voltageDomains = useChipStore((s) => s.voltageDomains);
  const conflicts = useChipStore((s) => s.conflicts);
  const activeDomainIds = useFilterStore((s) => s.activeDomainIds);
  const selectedPinId = useSelectionStore((s) => s.selectedPinId);
  const hoveredPinId = useSelectionStore((s) => s.hoveredPinId);
  const focusedConflictId = useSelectionStore((s) => s.focusedConflictId);

  const domainColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of voltageDomains) {
      map.set(d.id, d.color);
    }
    return map;
  }, [voltageDomains]);

  const conflictedPinIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of conflicts) {
      for (const pid of c.pinIds) {
        set.add(pid);
      }
    }
    return set;
  }, [conflicts]);

  const focusedPinIds = useMemo(() => {
    if (!focusedConflictId) return new Set<string>();
    const conflict = conflicts.find((c) => c.id === focusedConflictId);
    if (!conflict) return new Set<string>();
    return new Set(conflict.pinIds);
  }, [conflicts, focusedConflictId]);

  return (
    <>
      {pins.map((pin) => (
        <PinTower
          key={pin.id}
          pin={pin}
          domainColor={domainColorMap.get(pin.voltageDomainId) ?? '#888888'}
          isConflicted={conflictedPinIds.has(pin.id)}
          isFiltered={
            activeDomainIds.size === 0 || activeDomainIds.has(pin.voltageDomainId)
          }
          isSelected={selectedPinId === pin.id}
          isHovered={hoveredPinId === pin.id}
          isConflictFocused={focusedPinIds.has(pin.id)}
        />
      ))}
    </>
  );
}
