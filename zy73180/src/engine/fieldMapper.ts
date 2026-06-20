import { FIELD_SYNONYMS, TARGET_FIELDS, type TargetField, type FieldMapping } from '@/types';

export function autoMapFields(rawFields: string[]): Record<string, TargetField | null> {
  const mapping: Record<string, TargetField | null> = {};

  for (const rawField of rawFields) {
    const lowerField = rawField.toLowerCase().trim();
    let matched: TargetField | null = null;

    if (FIELD_SYNONYMS[rawField]) {
      matched = FIELD_SYNONYMS[rawField];
    } else if (FIELD_SYNONYMS[lowerField]) {
      matched = FIELD_SYNONYMS[lowerField];
    } else {
      for (const [synonym, target] of Object.entries(FIELD_SYNONYMS)) {
        if (synonym.toLowerCase().includes(lowerField) || lowerField.includes(synonym.toLowerCase())) {
          matched = target;
          break;
        }
      }
    }

    mapping[rawField] = matched;
  }

  return mapping;
}

export function applyMapping(rawData: Record<string, any>, mapping: FieldMapping): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [rawField, targetField] of Object.entries(mapping.mappings)) {
    if (rawField in rawData) {
      result[targetField] = rawData[rawField];
    }
  }

  result._rawData = rawData;
  result._mappingId = mapping.id;

  return result;
}

export function getUnmappedFields(rawFields: string[], mapping: FieldMapping): string[] {
  return rawFields.filter(field => !(field in mapping.mappings));
}

export function getMissingTargetFields(mapping: FieldMapping): TargetField[] {
  const mappedTargets = new Set(Object.values(mapping.mappings));
  return TARGET_FIELDS.filter(field => !mappedTargets.has(field));
}

export function createNewMapping(name: string, autoMappings: Record<string, TargetField | null>): FieldMapping {
  const mappings: Record<string, string> = {};
  for (const [rawField, targetField] of Object.entries(autoMappings)) {
    if (targetField) {
      mappings[rawField] = targetField;
    }
  }

  return {
    id: `mapping_${Date.now()}`,
    name,
    mappings,
    createdAt: new Date().toISOString(),
  };
}

export function updateMappingField(
  mapping: FieldMapping,
  rawField: string,
  targetField: TargetField | null
): FieldMapping {
  const newMappings = { ...mapping.mappings };

  if (targetField) {
    newMappings[rawField] = targetField;
  } else {
    delete newMappings[rawField];
  }

  return {
    ...mapping,
    mappings: newMappings,
  };
}
