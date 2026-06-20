export const EMPTY_PROFILE = {
  name: '',
  aliases: [],
  species: '狗',
  breed: '',
  vaccineStatus: '',
  trainingProgress: '未开始',
  trainingJudge: '待评定',
  latestNote: '',
  photoUrls: [],
  confirmed: false,
  revoked: false,
};

export const EXPORT_FIELDS = [
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

export const FIELD_LABELS = {
  name: '宠物名',
  aliases: '别名',
  species: '种类',
  breed: '品种',
  vaccineStatus: '疫苗状态',
  trainingProgress: '训练进度',
  trainingJudge: '训练评定',
  latestNote: '备注',
  photoUrls: '照片/截图',
  confirmed: '是否确认',
  revoked: '是否撤回',
};

export function formatDate(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function normalizeProfile(input = {}) {
  return {
    ...EMPTY_PROFILE,
    ...input,
    aliases: Array.isArray(input.aliases) ? input.aliases.filter(Boolean) : [],
    photoUrls: Array.isArray(input.photoUrls) ? input.photoUrls.filter(Boolean) : [],
    confirmed: Boolean(input.confirmed),
    revoked: Boolean(input.revoked),
  };
}

export function profileToRowValue(pet, key) {
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
      return String(pet[key] ?? '');
  }
}

function snapshotValue(profile, key) {
  const value = profile[key];
  if (Array.isArray(value)) return value.join(' / ');
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value ?? '');
}

export function computeSnapshotDiffs(event) {
  const keys = Object.keys(FIELD_LABELS);
  return keys.flatMap((key) => {
    const before = snapshotValue(event.snapshotBefore, key);
    const after = snapshotValue(event.snapshotAfter, key);
    if (before === after) return [];
    return [{ field: FIELD_LABELS[key], before: before || '(空)', after: after || '(空)' }];
  });
}

export function derivePets(events) {
  const byPet = new Map();
  for (const event of events) {
    if (!byPet.has(event.petId)) byPet.set(event.petId, []);
    byPet.get(event.petId).push(event);
  }

  const pets = [];
  for (const [petId, petEvents] of byPet) {
    const sorted = [...petEvents].sort((a, b) => a.timestamp - b.timestamp);
    const finalSnapshot = normalizeProfile(sorted.at(-1).snapshotAfter);
    const anomalies = [];

    const seenAliases = new Set();
    for (const alias of finalSnapshot.aliases) {
      const trimmed = alias.trim();
      if (!trimmed) continue;
      if (seenAliases.has(trimmed)) {
        anomalies.push({
          type: 'self_alias_duplicate',
          message: `别名内部重复：「${trimmed}」出现多次`,
        });
      }
      seenAliases.add(trimmed);
    }

    if (finalSnapshot.aliases.includes(finalSnapshot.name)) {
      anomalies.push({
        type: 'self_alias_duplicate',
        message: `别名与主名「${finalSnapshot.name}」重复`,
      });
    }

    const rejudgeCount = sorted.filter((event) => event.type === 'rejudge').length;
    if (rejudgeCount) {
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

    if (sorted.some((event) => event.type === 'revoke') && sorted.filter((event) => event.type === 'import').length > 1) {
      anomalies.push({
        type: 'conflict_history',
        message: '历史含撤回+重新导入，存在版本冲突痕迹',
      });
    }

    pets.push({
      petId,
      ...finalSnapshot,
      anomalies,
      lastModifiedAt: sorted.at(-1).timestamp,
      eventCount: sorted.length,
    });
  }

  const nameToPets = new Map();
  for (const pet of pets) {
    for (const name of [pet.name, ...pet.aliases].map((v) => v.trim()).filter(Boolean)) {
      if (!nameToPets.has(name)) nameToPets.set(name, []);
      nameToPets.get(name).push(pet.petId);
    }
  }

  for (const [name, ids] of nameToPets) {
    if (ids.length <= 1) continue;
    for (const id of ids) {
      const pet = pets.find((item) => item.petId === id);
      const others = ids.filter((other) => other !== id).map((other) => pets.find((item) => item.petId === other).name).join('、');
      pet.anomalies.push({
        type: 'alias_duplicate',
        message: `名称/别名「${name}」与 ${others} 冲突`,
        relatedPetIds: ids.filter((other) => other !== id),
      });
    }
  }

  return pets.sort((a, b) => a.lastModifiedAt - b.lastModifiedAt);
}

export function buildExportRows(pets) {
  return pets.map((pet, index) => ({
    rowIndex: index + 1,
    petId: pet.petId,
    values: Object.fromEntries(EXPORT_FIELDS.map((field) => [field.label, profileToRowValue(pet, field.key)])),
  }));
}

export function computeDiffsBetween(beforePets, afterPets, causeEvent) {
  const beforeMap = new Map(beforePets.map((pet) => [pet.petId, pet]));
  const afterSorted = [...afterPets].sort((a, b) => a.lastModifiedAt - b.lastModifiedAt);
  const rowIndexOf = new Map(afterSorted.map((pet, index) => [pet.petId, index + 1]));

  return afterSorted.flatMap((afterPet) => {
    const beforePet = beforeMap.get(afterPet.petId);
    return EXPORT_FIELDS.flatMap((field) => {
      const oldValue = beforePet ? profileToRowValue(beforePet, field.key) : '';
      const newValue = profileToRowValue(afterPet, field.key);
      if (oldValue === newValue) return [];
      return [{
        petId: afterPet.petId,
        petName: afterPet.name,
        rowIndex: rowIndexOf.get(afterPet.petId),
        field: field.label,
        fieldIndex: field.index,
        oldValue: oldValue || '(空)',
        newValue: newValue || '(空)',
        reason: causeEvent.rejudgeReason || causeEvent.note || causeEvent.source || '',
        eventType: causeEvent.type,
        eventId: causeEvent.id,
        timestamp: causeEvent.timestamp,
      }];
    });
  });
}
