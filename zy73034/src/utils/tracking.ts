import type { DerivedPet, PetEvent, PetProfile, ExportDiff, Anomaly } from '@/types';

export const EVENT_TYPE_LABEL: Record<PetEvent['type'], string> = {
  import: '导入',
  confirm: '确认',
  revoke: '撤回',
  addendum: '补录备注',
  rejudge: '人工改判',
};

export const EVENT_SOURCE_LABEL: Record<string, string> = {
  vaccine_photo: '疫苗本照片',
  owner_supplement: '主人临时补充',
  manual: '人工操作',
  reimport: '重新导入（旧版本作废）',
};

export const EXPORT_FIELDS: { key: keyof PetProfile | 'anomalies' | 'petId' | 'lastModifiedAt'; label: string; index: number }[] = [
  { key: 'petId', label: '宠物编号', index: 0 },
  { key: 'name', label: '宠物名', index: 1 },
  { key: 'aliases', label: '别名', index: 2 },
  { key: 'species', label: '种类', index: 3 },
  { key: 'breed', label: '品种', index: 4 },
  { key: 'vaccineStatus', label: '疫苗状态', index: 5 },
  { key: 'trainingProgress', label: '训练进度', index: 6 },
  { key: 'trainingJudge', label: '训练评定', index: 7 },
  { key: 'latestNote', label: '最新备注', index: 8 },
  { key: 'confirmed', label: '是否确认', index: 9 },
  { key: 'revoked', label: '是否撤回', index: 10 },
  { key: 'anomalies', label: '异常标记', index: 11 },
  { key: 'lastModifiedAt', label: '最后更新时间', index: 12 },
];

export function profileToRowValue(
  pet: DerivedPet,
  key: (typeof EXPORT_FIELDS)[number]['key'],
): string {
  switch (key) {
    case 'petId':
      return pet.petId;
    case 'aliases':
      return pet.aliases.join(' / ');
    case 'confirmed':
      return pet.confirmed ? '是' : '否';
    case 'revoked':
      return pet.revoked ? '是' : '否';
    case 'anomalies':
      return pet.anomalies.map((a) => a.message).join('；');
    case 'lastModifiedAt':
      return formatDate(pet.lastModifiedAt);
    default:
      return String((pet as any)[key] ?? '');
  }
}

export function snapshotValue(p: PetProfile, key: keyof PetProfile): string {
  if (key === 'aliases') return p.aliases.join(' / ');
  if (key === 'confirmed') return p.confirmed ? '是' : '否';
  if (key === 'revoked') return p.revoked ? '是' : '否';
  return String((p as any)[key] ?? '');
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function derivePets(events: PetEvent[]): DerivedPet[] {
  const byPet = new Map<string, PetEvent[]>();
  for (const e of events) {
    if (!byPet.has(e.petId)) byPet.set(e.petId, []);
    byPet.get(e.petId)!.push(e);
  }
  const pets: DerivedPet[] = [];
  for (const [petId, petEvents] of byPet) {
    const sorted = [...petEvents].sort((a, b) => a.timestamp - b.timestamp);
    const finalSnapshot = sorted[sorted.length - 1].snapshotAfter;
    const lastModifiedAt = sorted[sorted.length - 1].timestamp;
    const anomalies: Anomaly[] = [];

    const aliasSet = new Set<string>();
    for (const a of finalSnapshot.aliases) {
      const k = a.trim();
      if (!k) continue;
      if (aliasSet.has(k)) {
        anomalies.push({
          type: 'self_alias_duplicate',
          message: `别名内部重复：「${k}」出现多次`,
        });
      }
      aliasSet.add(k);
    }
    if (finalSnapshot.aliases.includes(finalSnapshot.name)) {
      anomalies.push({
        type: 'self_alias_duplicate',
        message: `别名与主名「${finalSnapshot.name}」重复`,
      });
    }

    if (sorted.some((e) => e.type === 'rejudge')) {
      const rejudgeCount = sorted.filter((e) => e.type === 'rejudge').length;
      anomalies.push({
        type: 'manual_rejudge',
        message: `存在 ${rejudgeCount} 次人工改判记录`,
      });
    }
    if (!finalSnapshot.confirmed) {
      anomalies.push({
        type: 'pending_confirm',
        message: '尚未完成确认',
      });
    }
    if (sorted.some((e) => e.type === 'revoke') && sorted.some((e) => e.type === 'import')) {
      const hasRevoke = sorted.some((e) => e.type === 'revoke');
      const hasReimport = sorted.filter((e) => e.type === 'import').length > 1;
      if (hasRevoke && hasReimport) {
        anomalies.push({
          type: 'conflict_history',
          message: '历史含撤回+重新导入，存在版本冲突痕迹',
        });
      }
    }

    pets.push({
      petId,
      ...finalSnapshot,
      anomalies,
      lastModifiedAt,
      eventCount: sorted.length,
    });
  }

  const aliasToPets = new Map<string, string[]>();
  for (const pet of pets) {
    const names = [pet.name, ...pet.aliases].map((s) => s.trim()).filter(Boolean);
    for (const n of names) {
      if (!aliasToPets.has(n)) aliasToPets.set(n, []);
      aliasToPets.get(n)!.push(pet.petId);
    }
  }
  for (const [name, ids] of aliasToPets) {
    if (ids.length > 1) {
      for (const id of ids) {
        const pet = pets.find((p) => p.petId === id)!;
        if (!pet.anomalies.some((a) => a.type === 'alias_duplicate' && a.message.includes(name))) {
          const others = ids.filter((x) => x !== id).map((x) => pets.find((p) => p.petId === x)!.name).join('、');
          pet.anomalies.push({
            type: 'alias_duplicate',
            message: `名称/别名「${name}」与 ${others} 冲突`,
            relatedPetIds: ids.filter((x) => x !== id),
          });
        }
      }
    }
  }

  return pets.sort((a, b) => a.lastModifiedAt - b.lastModifiedAt);
}

export function profileEquals(a: PetProfile, b: PetProfile): boolean {
  const keys: (keyof PetProfile)[] = [
    'name', 'aliases', 'species', 'breed', 'vaccineStatus',
    'trainingProgress', 'trainingJudge', 'latestNote', 'photoUrls',
    'confirmed', 'revoked',
  ];
  for (const k of keys) {
    const va = Array.isArray((a as any)[k]) ? JSON.stringify((a as any)[k]) : String((a as any)[k]);
    const vb = Array.isArray((b as any)[k]) ? JSON.stringify((b as any)[k]) : String((b as any)[k]);
    if (va !== vb) return false;
  }
  return true;
}

export function computeDiffsBetween(
  before: DerivedPet[],
  after: DerivedPet[],
  causeEvents: PetEvent[],
): ExportDiff[] {
  const diffs: ExportDiff[] = [];
  const afterMap = new Map(after.map((p) => [p.petId, p]));
  const beforeMap = new Map(before.map((p) => [p.petId, p]));
  const sortedAfter = [...after].sort((a, b) => a.lastModifiedAt - b.lastModifiedAt);
  const rowIndexOf = new Map(sortedAfter.map((p, idx) => [p.petId, idx + 1]));

  const eventsByPet = new Map<string, PetEvent[]>();
  for (const e of causeEvents) {
    if (!eventsByPet.has(e.petId)) eventsByPet.set(e.petId, []);
    eventsByPet.get(e.petId)!.push(e);
  }

  for (const pet of sortedAfter) {
    const rowIdx = rowIndexOf.get(pet.petId)!;
    const beforePet = beforeMap.get(pet.petId);
    const petEvents = eventsByPet.get(pet.petId) ?? [];
    for (const field of EXPORT_FIELDS) {
      const oldVal = beforePet ? profileToRowValue(beforePet, field.key) : '';
      const newVal = profileToRowValue(pet, field.key);
      if (oldVal !== newVal) {
        const latestEvent = petEvents.length
          ? petEvents.reduce((a, b) => (a.timestamp > b.timestamp ? a : b))
          : null;
        diffs.push({
          petId: pet.petId,
          petName: pet.name,
          rowIndex: rowIdx,
          field: field.label,
          fieldIndex: field.index,
          oldValue: oldVal || '(空)',
          newValue: newVal || '(空)',
          reason: latestEvent
            ? (latestEvent.type === 'rejudge'
                ? (latestEvent as any).rejudgeReason || latestEvent.note || ''
                : latestEvent.note || latestEvent.source || '')
            : '',
          eventType: latestEvent?.type ?? 'import',
          eventId: latestEvent?.id ?? '',
          timestamp: latestEvent?.timestamp ?? pet.lastModifiedAt,
        });
      }
    }
  }

  for (const pet of before) {
    if (!afterMap.has(pet.petId)) {
      diffs.push({
        petId: pet.petId,
        petName: pet.name,
        rowIndex: -1,
        field: '整行',
        fieldIndex: -1,
        oldValue: `存在（行 ${before.indexOf(pet) + 1}）`,
        newValue: '(已删除)',
        reason: '本次操作删除了该宠物行',
        eventType: 'revoke',
        eventId: '',
        timestamp: Date.now(),
      });
    }
  }

  return diffs;
}

export function computeSnapshotDiffs(event: PetEvent): { field: string; before: string; after: string }[] {
  const out: { field: string; before: string; after: string }[] = [];
  const keys: (keyof PetProfile)[] = [
    'name', 'aliases', 'species', 'breed', 'vaccineStatus',
    'trainingProgress', 'trainingJudge', 'latestNote', 'confirmed', 'revoked',
  ];
  const labelFor: Record<string, string> = {
    name: '宠物名', aliases: '别名', species: '种类', breed: '品种',
    vaccineStatus: '疫苗状态', trainingProgress: '训练进度',
    trainingJudge: '训练评定', latestNote: '备注',
    confirmed: '是否确认', revoked: '是否撤回',
  };
  for (const k of keys) {
    const b = snapshotValue(event.snapshotBefore, k);
    const a = snapshotValue(event.snapshotAfter, k);
    if (b !== a) out.push({ field: labelFor[k] || k, before: b || '(空)', after: a || '(空)' });
  }
  if (event.snapshotBefore.photoUrls.length !== event.snapshotAfter.photoUrls.length) {
    out.push({
      field: '照片留影',
      before: `${event.snapshotBefore.photoUrls.length} 张`,
      after: `${event.snapshotAfter.photoUrls.length} 张`,
    });
  }
  return out;
}
