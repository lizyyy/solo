import type {
  ConclusionStatus,
  Material,
  MaterialSource,
  PageSummary,
  SourceFilterSet,
  VersionNode,
  Zone,
} from '@/types';

export function computeZoneStatusFromMaterials(
  materials: Material[],
  filter: SourceFilterSet
): ConclusionStatus | 'unreviewed' {
  const visible = materials.filter((m) => filter[m.source]);
  if (visible.length === 0) return 'unreviewed';

  const affecting = visible.filter((m) => m.affectsConclusion);
  if (affecting.length === 0) return 'pending';

  const hasRejecting = affecting.some((m) => m.source === 'cad_old');
  if (hasRejecting) return 'rejected';

  const hasOralOnly = affecting.every((m) => m.source === 'note_oral');
  if (hasOralOnly && affecting.length <= 1) return 'pending';

  return 'passed';
}

export function aggregateOverallConclusion(
  statuses: ConclusionStatus[]
): PageSummary['overallConclusion'] {
  if (statuses.some((s) => s === 'rejected')) return '驳回';
  if (statuses.some((s) => s === 'pending')) return '待定';
  if (statuses.every((s) => s === 'passed')) return '通过';
  return '待定';
}

export function countInfluencingBySource(
  zones: Zone[],
  filter: SourceFilterSet
): { source: MaterialSource; count: number }[] {
  const tally: Record<MaterialSource, number> = {
    cad_old: 0,
    note_added: 0,
    note_oral: 0,
  };
  zones.forEach((z) => {
    z.materials.forEach((m) => {
      if (m.affectsConclusion && filter[m.source]) {
        tally[m.source] += 1;
      }
    });
  });
  return (Object.keys(tally) as MaterialSource[])
    .filter((s) => tally[s] > 0)
    .map((s) => ({ source: s, count: tally[s] }))
    .sort((a, b) => b.count - a.count);
}

export function computePageSummary(
  currentVersion: VersionNode,
  zonesVisible: Zone[],
  filter: SourceFilterSet
): PageSummary {
  const statuses: ConclusionStatus[] = [];
  let reviewed = 0;
  let pending = 0;
  let rejected = 0;

  zonesVisible.forEach((z) => {
    const s = computeZoneStatusFromMaterials(z.materials, filter);
    if (s === 'unreviewed') return;
    statuses.push(s);
    reviewed += 1;
    if (s === 'pending') pending += 1;
    if (s === 'rejected') rejected += 1;
  });

  return {
    currentVersion: `${currentVersion.tag} · ${currentVersion.label}`,
    totalZones: zonesVisible.length,
    reviewedCount: reviewed,
    pendingCount: pending,
    rejectedCount: rejected,
    overallConclusion: aggregateOverallConclusion(statuses),
    keyInfluencingMaterials: countInfluencingBySource(zonesVisible, filter),
    hasCoordinateOffset: currentVersion.coordinateOffset > 0,
    offsetMm: currentVersion.coordinateOffset,
  };
}

export function isZoneVisibleInVersion(z: Zone, versionTag: string): boolean {
  return z.versionTags.includes(versionTag);
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
