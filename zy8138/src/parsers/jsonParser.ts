import type { Scene, Prop, PropAppearance, ImportResult } from '../types';

export function parseScenesJson(content: string): ImportResult<Scene[]> {
  const result: ImportResult<Scene[]> = {
    success: false,
    errors: [],
    warnings: [],
  };

  try {
    const parsed = JSON.parse(content);
    const scenes: Scene[] = [];

    if (!Array.isArray(parsed)) {
      result.errors.push('JSON data must be an array of scenes');
      return result;
    }

    for (let i = 0; i < parsed.length; i++) {
      const sceneData = parsed[i];
      
      if (!sceneData.id || !sceneData.sceneNumber) {
        result.errors.push(`Scene at index ${i} is missing required fields: id or sceneNumber`);
        continue;
      }

      const scene: Scene = {
        id: sceneData.id,
        sceneNumber: sceneData.sceneNumber,
        description: sceneData.description || '',
        date: sceneData.date || new Date().toISOString().split('T')[0],
        timeOfDay: sceneData.timeOfDay || 'DAY',
        location: sceneData.location || '',
        interiorExterior: sceneData.interiorExterior === 'EXT' ? 'EXT' : 'INT',
        plannedShootDate: sceneData.plannedShootDate || new Date().toISOString().split('T')[0],
        actualShootDate: sceneData.actualShootDate,
        reshootDate: sceneData.reshootDate,
        notes: sceneData.notes,
      };

      scenes.push(scene);
    }

    if (scenes.length === 0 && result.errors.length === 0) {
      result.warnings.push('No scenes were parsed from the JSON file');
    }

    result.data = scenes;
    result.success = result.errors.length === 0;
  } catch (error) {
    result.errors.push(`Failed to parse JSON: ${(error as Error).message}`);
  }

  return result;
}

export function parsePropsJson(content: string): ImportResult<{ props: Prop[]; appearances: PropAppearance[] }> {
  const result: ImportResult<{ props: Prop[]; appearances: PropAppearance[] }> = {
    success: false,
    errors: [],
    warnings: [],
  };

  try {
    const parsed = JSON.parse(content);
    
    if (!parsed.props || !Array.isArray(parsed.props)) {
      result.errors.push('JSON must contain a "props" array');
      return result;
    }

    const props: Prop[] = [];
    const appearances: PropAppearance[] = [];

    for (let i = 0; i < parsed.props.length; i++) {
      const propData = parsed.props[i];
      
      if (!propData.id || !propData.propNumber || !propData.name) {
        result.errors.push(`Prop at index ${i} is missing required fields: id, propNumber, or name`);
        continue;
      }

      const prop: Prop = {
        id: propData.id,
        propNumber: propData.propNumber,
        name: propData.name,
        description: propData.description || '',
        category: propData.category || 'General',
        responsiblePerson: propData.responsiblePerson || '',
        status: propData.status || 'Available',
        currentLocation: propData.currentLocation || '',
        photos: propData.photos || [],
        notes: propData.notes,
      };

      props.push(prop);
    }

    if (parsed.appearances && Array.isArray(parsed.appearances)) {
      for (let i = 0; i < parsed.appearances.length; i++) {
        const appearanceData = parsed.appearances[i];
        
        if (!appearanceData.id || !appearanceData.propId || !appearanceData.sceneId) {
          result.errors.push(`PropAppearance at index ${i} is missing required fields: id, propId, or sceneId`);
          continue;
        }

        const appearance: PropAppearance = {
          id: appearanceData.id,
          propId: appearanceData.propId,
          sceneId: appearanceData.sceneId,
          position: appearanceData.position || '',
          state: appearanceData.state || '',
          condition: appearanceData.condition || 'Good',
          photos: appearanceData.photos || [],
          notes: appearanceData.notes,
          timestamp: appearanceData.timestamp || Date.now(),
        };

        appearances.push(appearance);
      }
    }

    if (props.length === 0 && result.errors.length === 0) {
      result.warnings.push('No props were parsed from the JSON file');
    }

    result.data = { props, appearances };
    result.success = result.errors.length === 0;
  } catch (error) {
    result.errors.push(`Failed to parse JSON: ${(error as Error).message}`);
  }

  return result;
}
