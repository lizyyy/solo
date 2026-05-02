import type { Bay, ParsingError } from '@/types';

export async function parseBaysJson(content: string): Promise<{ bays: Bay[]; errors: ParsingError[] }> {
  const errors: ParsingError[] = [];
  let data: unknown;

  try {
    data = JSON.parse(content);
  } catch {
    errors.push({ field: 'json', message: 'Invalid JSON format' });
    return { bays: [], errors };
  }

  if (!Array.isArray(data)) {
    errors.push({ field: 'root', message: 'Expected an array of bays' });
    return { bays: [], errors };
  }

  const bays: Bay[] = [];

  for (let i = 0; i < data.length; i++) {
    const item = data[i] as Record<string, unknown>;
    
    if (typeof item.id !== 'string') {
      errors.push({ field: 'id', message: 'Bay id must be a string', rowIndex: i });
      continue;
    }
    
    if (typeof item.name !== 'string') {
      errors.push({ field: 'name', message: 'Bay name must be a string', rowIndex: i });
      continue;
    }

    const position = item.position as Record<string, unknown>;
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number' || typeof position.z !== 'number') {
      errors.push({ field: 'position', message: 'Invalid position format', rowIndex: i });
      continue;
    }

    const dimensions = item.dimensions as Record<string, unknown>;
    if (!dimensions || typeof dimensions.width !== 'number' || typeof dimensions.height !== 'number' || typeof dimensions.depth !== 'number') {
      errors.push({ field: 'dimensions', message: 'Invalid dimensions format', rowIndex: i });
      continue;
    }

    if (typeof item.maxWeight !== 'number' || item.maxWeight <= 0) {
      errors.push({ field: 'maxWeight', message: 'maxWeight must be a positive number', rowIndex: i });
      continue;
    }

    bays.push({
      id: item.id,
      name: item.name,
      position: { x: position.x, y: position.y, z: position.z },
      dimensions: { width: dimensions.width, height: dimensions.height, depth: dimensions.depth },
      maxWeight: item.maxWeight,
      isDeck: item.isDeck === true,
    });
  }

  return { bays, errors };
}