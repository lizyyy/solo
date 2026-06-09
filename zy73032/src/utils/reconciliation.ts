import type {
  Schedule,
  Pet,
  PetAlias,
  MedicalRecord,
  AliasConflict,
  ScheduleStatus,
} from "@/types";

export interface ReconcileInput {
  schedules: Schedule[];
  pets: Pet[];
  aliases: PetAlias[];
  medicalRecords: MedicalRecord[];
}

export function detectAliasConflicts(input: ReconcileInput): AliasConflict[] {
  const { schedules, pets, aliases, medicalRecords } = input;
  const result: AliasConflict[] = [];

  const aliasToPet = new Map<string, string>();
  aliases.forEach((a) => {
    if (a.petId) aliasToPet.set(a.aliasName.trim(), a.petId);
  });
  pets.forEach((p) => {
    if (!aliasToPet.has(p.canonicalName.trim())) {
      aliasToPet.set(p.canonicalName.trim(), p.id);
    }
  });

  const collected = new Map<
    string,
    {
      matchedPetIds: Set<string>;
      sourceRecords: AliasConflict["sourceRecords"];
      affectedScheduleIds: string[];
      affectedMedicalIds: string[];
    }
  >();

  const ensure = (name: string) => {
    const key = name.trim();
    if (!collected.has(key)) {
      collected.set(key, {
        matchedPetIds: new Set<string>(),
        sourceRecords: [],
        affectedScheduleIds: [],
        affectedMedicalIds: [],
      });
    }
    return collected.get(key)!;
  };

  schedules.forEach((s) => {
    const name = s.petName.trim();
    const bucket = ensure(name);
    bucket.affectedScheduleIds.push(s.id);
    const petId = aliasToPet.get(name);
    if (petId) bucket.matchedPetIds.add(petId);
    else bucket.sourceRecords.push({
      type: "CSV",
      id: s.id,
      label: `排程「${s.courseName}」${s.courseDate}`,
    });
  });

  medicalRecords.forEach((m) => {
    const name = m.petName.trim();
    const bucket = ensure(name);
    bucket.affectedMedicalIds.push(m.id);
    const petId = aliasToPet.get(name);
    if (petId) bucket.matchedPetIds.add(petId);
    else bucket.sourceRecords.push({
      type: "MEDICAL_FORM",
      id: m.id,
      label: `病历「${m.diagnosis}」${m.visitDate}`,
    });
  });

  collected.forEach((v, aliasName) => {
    const isUnbound = v.matchedPetIds.size === 0;
    const isAmbiguous = v.matchedPetIds.size > 1;
    const hasCrossSource =
      v.sourceRecords.filter((r) => r.type === "CSV").length > 0 &&
      v.sourceRecords.filter((r) => r.type === "MEDICAL_FORM").length > 0;
    if (isUnbound || isAmbiguous || (hasCrossSource && v.matchedPetIds.size === 0)) {
      if (v.affectedScheduleIds.length === 0 && v.affectedMedicalIds.length === 0) return;
      result.push({
        aliasName,
        matchedPetIds: Array.from(v.matchedPetIds),
        sourceRecords: v.sourceRecords,
        affectedScheduleIds: v.affectedScheduleIds,
        affectedMedicalIds: v.affectedMedicalIds,
      });
    }
  });

  return result.sort((a, b) => b.affectedScheduleIds.length - a.affectedScheduleIds.length);
}

export function normalizeScheduleStatuses(
  schedules: Schedule[],
  conflicts: AliasConflict[]
): Schedule[] {
  const anomalyNames = new Set(conflicts.map((c) => c.aliasName.trim()));
  return schedules.map((s) => {
    const name = s.petName.trim();
    let next: ScheduleStatus = s.status;
    if (anomalyNames.has(name) && s.status !== "WITHDRAWN") {
      next = "ANOMALY";
    } else if (s.status === "ANOMALY" && !anomalyNames.has(name)) {
      next = "PENDING";
    }
    if (s.status === next) return s;
    return {
      ...s,
      status: next,
      anomalyReason:
        next === "ANOMALY" ? "宠物别名未绑定或存在冲突，已隔离出汇总" : undefined,
    };
  });
}

export function summarizeConflicts(conflicts: AliasConflict[]): {
  schedulesExcluded: number;
  medicalExcluded: number;
  namesAffected: number;
} {
  const sSet = new Set<string>();
  const mSet = new Set<string>();
  conflicts.forEach((c) => {
    c.affectedScheduleIds.forEach((id) => sSet.add(id));
    c.affectedMedicalIds.forEach((id) => mSet.add(id));
  });
  return {
    schedulesExcluded: sSet.size,
    medicalExcluded: mSet.size,
    namesAffected: conflicts.length,
  };
}
