import Papa from 'papaparse';
import type { Prop, Scene, PropAppearance, ImportResult } from '../types';

export function parsePropsCsv(content: string): ImportResult<{ props: Prop[]; appearances: PropAppearance[] }> {
  const result: ImportResult<{ props: Prop[]; appearances: PropAppearance[] }> = {
    success: false,
    errors: [],
    warnings: [],
  };

  try {
    const parseResult = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parseResult.errors.length > 0) {
      result.errors = parseResult.errors.map(e => e.message);
      return result;
    }

    const props: Prop[] = [];
    const appearances: PropAppearance[] = [];
    const propIds = new Set<string>();

    for (let i = 0; i < parseResult.data.length; i++) {
      const row = parseResult.data[i] as Record<string, string>;
      
      const propId = row['propId'] || row['id'];
      const propNumber = row['propNumber'];
      const name = row['name'];

      if (!propId || !propNumber || !name) {
        result.errors.push(`Row ${i + 1} is missing required fields: propId, propNumber, or name`);
        continue;
      }

      if (propIds.has(propId)) {
        result.warnings.push(`Duplicate propId '${propId}' at row ${i + 1}, skipping`);
        continue;
      }

      propIds.add(propId);

      const prop: Prop = {
        id: propId,
        propNumber: propNumber,
        name: name,
        description: row['description'] || '',
        category: row['category'] || 'General',
        responsiblePerson: row['responsiblePerson'] || row['responsible'] || '',
        status: row['status'] || 'Available',
        currentLocation: row['currentLocation'] || row['location'] || '',
        photos: row['photos'] ? row['photos'].split(',').map(p => p.trim()).filter(Boolean) : [],
        notes: row['notes'],
      };

      props.push(prop);

      if (row['sceneId'] && row['position']) {
        const appearance: PropAppearance = {
          id: `appearance-${propId}-${row['sceneId']}`,
          propId: propId,
          sceneId: row['sceneId'],
          position: row['position'],
          state: row['state'] || '',
          condition: row['condition'] || 'Good',
          photos: row['appearancePhotos'] ? row['appearancePhotos'].split(',').map(p => p.trim()).filter(Boolean) : [],
          notes: row['appearanceNotes'],
          timestamp: Date.now(),
        };
        appearances.push(appearance);
      }
    }

    if (props.length === 0 && result.errors.length === 0) {
      result.warnings.push('No props were parsed from the CSV file');
    }

    result.data = { props, appearances };
    result.success = result.errors.length === 0;
  } catch (error) {
    result.errors.push(`Failed to parse CSV: ${(error as Error).message}`);
  }

  return result;
}

export function parseScenesCsv(content: string): ImportResult<Scene[]> {
  const result: ImportResult<Scene[]> = {
    success: false,
    errors: [],
    warnings: [],
  };

  try {
    const parseResult = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parseResult.errors.length > 0) {
      result.errors = parseResult.errors.map(e => e.message);
      return result;
    }

    const scenes: Scene[] = [];

    for (let i = 0; i < parseResult.data.length; i++) {
      const row = parseResult.data[i] as Record<string, string>;
      
      const id = row['id'];
      const sceneNumber = row['sceneNumber'];

      if (!id || !sceneNumber) {
        result.errors.push(`Row ${i + 1} is missing required fields: id or sceneNumber`);
        continue;
      }

      const scene: Scene = {
        id: id,
        sceneNumber: sceneNumber,
        description: row['description'] || '',
        date: row['date'] || new Date().toISOString().split('T')[0],
        timeOfDay: row['timeOfDay'] || 'DAY',
        location: row['location'] || '',
        interiorExterior: (row['interiorExterior']?.toUpperCase() === 'EXT' ? 'EXT' : 'INT') as 'INT' | 'EXT',
        plannedShootDate: row['plannedShootDate'] || row['plannedDate'] || new Date().toISOString().split('T')[0],
        actualShootDate: row['actualShootDate'] || row['actualDate'],
        reshootDate: row['reshootDate'],
        notes: row['notes'],
      };

      scenes.push(scene);
    }

    if (scenes.length === 0 && result.errors.length === 0) {
      result.warnings.push('No scenes were parsed from the CSV file');
    }

    result.data = scenes;
    result.success = result.errors.length === 0;
  } catch (error) {
    result.errors.push(`Failed to parse CSV: ${(error as Error).message}`);
  }

  return result;
}
