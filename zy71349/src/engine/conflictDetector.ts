import type { ControllerEvent, SoundParameter, MappingEntry, Conflict, TraceEntry } from '@/types/midi';

export function detectConflicts(
  mappings: MappingEntry[],
  controllerEvents: ControllerEvent[],
  soundParameters: SoundParameter[],
  existingConflicts?: Conflict[]
): Conflict[] {
  const now = Date.now();
  const eventMap = new Map<string, ControllerEvent>();
  for (const evt of controllerEvents) {
    eventMap.set(evt.id, evt);
  }

  const paramMap = new Map<string, SoundParameter>();
  for (const param of soundParameters) {
    paramMap.set(param.id, param);
  }

  const conflicts: Conflict[] = [];

  const unresolved = (existingConflicts ?? []).filter(c => c.resolvedAt == null);
  const carryOver = unresolved.filter(existing => {
    const allMappingIdsStillExist = existing.mappingIds.every(id => mappings.some(m => m.id === id));
    if (!allMappingIdsStillExist) return false;

    if (existing.type === 'channel_collision') {
      const eventIds = existing.mappingIds
        .map(id => mappings.find(m => m.id === id))
        .filter(Boolean)
        .map(m => m!.controllerEventId);
      const uniqueEventIds = new Set(eventIds);
      if (uniqueEventIds.size <= 1) return false;
      const paramIds = existing.mappingIds
        .map(id => mappings.find(m => m.id === id))
        .filter(Boolean)
        .map(m => m!.soundParameterId);
      const uniqueParamIds = new Set(paramIds);
      if (uniqueParamIds.size <= 1) return false;
    }

    if (existing.type === 'polarity_reversed') {
      const mapping = mappings.find(m => m.id === existing.mappingIds[0]);
      if (mapping && mapping.polarity !== 'reversed') return false;
    }

    if (existing.type === 'preset_override') {
      const hasManual = existing.mappingIds.some(id => {
        const m = mappings.find(mp => mp.id === id);
        return m && !m.sourcePresetId;
      });
      const hasPreset = existing.mappingIds.some(id => {
        const m = mappings.find(mp => mp.id === id);
        return m && m.sourcePresetId;
      });
      if (!hasManual || !hasPreset) return false;
    }

    return true;
  });

  conflicts.push(...carryOver);

  const byControllerEvent = new Map<string, MappingEntry[]>();
  for (const mapping of mappings) {
    const list = byControllerEvent.get(mapping.controllerEventId) ?? [];
    list.push(mapping);
    byControllerEvent.set(mapping.controllerEventId, list);
  }

  for (const [eventId, group] of byControllerEvent) {
    if (group.length < 2) continue;

    const paramIds = new Set(group.map(m => m.soundParameterId));
    if (paramIds.size <= 1) continue;

    const alreadyCovered = carryOver.some(
      c => c.type === 'channel_collision' &&
        c.mappingIds.length === group.length &&
        c.mappingIds.every(id => group.some(g => g.id === id))
    );
    if (alreadyCovered) continue;

    const evt = eventMap.get(eventId);
    const eventLabel = evt
      ? `${evt.type.toUpperCase()} ${evt.ccNumber != null ? `CC${evt.ccNumber}` : ''} Ch${evt.channel}`
      : eventId;

    const paramNames = group.map(m => {
      const p = paramMap.get(m.soundParameterId);
      return p ? p.name : m.soundParameterId;
    });

    const trace: TraceEntry[] = [
      {
        type: 'event',
        targetId: eventId,
        label: eventLabel
      },
      ...group.map(m => ({
        type: 'mapping' as const,
        targetId: m.id,
        label: `→ ${paramMap.get(m.soundParameterId)?.name ?? m.soundParameterId}`
      }))
    ];

    conflicts.push({
      id: crypto.randomUUID(),
      type: 'channel_collision',
      severity: 'critical',
      mappingIds: group.map(m => m.id),
      description: `Channel collision: ${group.length} mappings on ${eventLabel} target different parameters (${paramNames.join(', ')})`,
      sourceTrace: trace,
      detectedAt: now
    });
  }

  for (const mapping of mappings) {
    if (mapping.polarity !== 'reversed') continue;

    const param = paramMap.get(mapping.soundParameterId);
    const evt = eventMap.get(mapping.controllerEventId);
    const isToggleOrEnum = param?.type === 'toggle' || param?.type === 'enum';
    const isSustainPedal = evt?.type === 'cc' && evt.ccNumber === 64;

    if (!isToggleOrEnum && !isSustainPedal) continue;

    const alreadyCovered = carryOver.some(
      c => c.type === 'polarity_reversed' && c.mappingIds.includes(mapping.id)
    );
    if (alreadyCovered) continue;

    const evtLabel = evt
      ? `${evt.type.toUpperCase()} ${evt.ccNumber != null ? `CC${evt.ccNumber}` : ''} Ch${evt.channel}`
      : mapping.controllerEventId;
    const paramName = param?.name ?? mapping.soundParameterId;

    let reason: string;
    if (isSustainPedal) {
      reason = `Sustain pedal (CC64) on ${evtLabel} should not use reversed polarity`;
    } else {
      reason = `Parameter "${paramName}" is ${param!.type} type and does not support polarity inversion`;
    }

    const trace: TraceEntry[] = [
      {
        type: 'mapping',
        targetId: mapping.id,
        label: `Reversed polarity on ${evtLabel} → ${paramName}`
      },
      {
        type: 'event',
        targetId: mapping.controllerEventId,
        label: evtLabel
      },
      {
        type: 'parameter',
        targetId: mapping.soundParameterId,
        label: paramName
      }
    ];

    if (mapping.sourcePresetId) {
      trace.push({
        type: 'preset',
        targetId: mapping.sourcePresetId,
        label: `From preset ${mapping.sourcePresetId}`
      });
    }

    conflicts.push({
      id: crypto.randomUUID(),
      type: 'polarity_reversed',
      severity: 'warning',
      mappingIds: [mapping.id],
      description: `Polarity reversed: ${reason}`,
      sourceTrace: trace,
      detectedAt: now
    });
  }

  const manualMappings = mappings.filter(m => !m.sourcePresetId);
  const presetMappings = mappings.filter(m => m.sourcePresetId);

  if (manualMappings.length > 0 && presetMappings.length > 0) {
    const presetIds = new Set(presetMappings.map(m => m.sourcePresetId!));
    const hasPresetOverrideConflict = carryOver.some(c => c.type === 'preset_override');

    if (!hasPresetOverrideConflict) {
      const presetLabels = [...presetIds].join(', ');
      const trace: TraceEntry[] = [
        ...manualMappings.map(m => ({
          type: 'mapping' as const,
          targetId: m.id,
          label: `Manual mapping → ${paramMap.get(m.soundParameterId)?.name ?? m.soundParameterId}`
        })),
        ...presetMappings.map(m => ({
          type: 'mapping' as const,
          targetId: m.id,
          label: `Preset mapping (${m.sourcePresetId}) → ${paramMap.get(m.soundParameterId)?.name ?? m.soundParameterId}`
        })),
        ...[...presetIds].map(pid => ({
          type: 'preset' as const,
          targetId: pid,
          label: `Preset ${pid}`
        }))
      ];

      conflicts.push({
        id: crypto.randomUUID(),
        type: 'preset_override',
        severity: 'warning',
        mappingIds: [...manualMappings.map(m => m.id), ...presetMappings.map(m => m.id)],
        description: `Preset override: loading preset(s) [${presetLabels}] would overwrite ${manualMappings.length} manually created mapping(s)`,
        sourceTrace: trace,
        detectedAt: now
      });
    }
  }

  return conflicts;
}
