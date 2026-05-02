import { ExhibitionConfig, ExhibitionElement, ElementType } from '../types';

function validateElementType(type: string): type is ElementType {
  const validTypes: ElementType[] = ['exhibit', 'entrance', 'exit', 'restricted', 'obstacle'];
  return validTypes.includes(type as ElementType);
}

function validateElement(element: unknown): ExhibitionElement {
  if (typeof element !== 'object' || element === null) {
    throw new Error('元素必须是对象类型');
  }

  const elem = element as Record<string, unknown>;

  if (typeof elem.id !== 'string' || elem.id.trim() === '') {
    throw new Error('元素必须包含有效的 id 字段');
  }

  if (typeof elem.type !== 'string' || !validateElementType(elem.type)) {
    throw new Error(`元素 ${elem.id} 的 type 字段无效`);
  }

  if (typeof elem.name !== 'string' || elem.name.trim() === '') {
    throw new Error(`元素 ${elem.id} 必须包含有效的 name 字段`);
  }

  if (typeof elem.position !== 'object' || elem.position === null) {
    throw new Error(`元素 ${elem.id} 必须包含 position 字段`);
  }

  const pos = elem.position as Record<string, unknown>;
  if (typeof pos.x !== 'number' || typeof pos.z !== 'number') {
    throw new Error(`元素 ${elem.id} 的 position 必须包含 x 和 z 坐标`);
  }

  if (typeof elem.dimensions !== 'object' || elem.dimensions === null) {
    throw new Error(`元素 ${elem.id} 必须包含 dimensions 字段`);
  }

  const dim = elem.dimensions as Record<string, unknown>;
  if (typeof dim.width !== 'number' || typeof dim.depth !== 'number' || typeof dim.height !== 'number') {
    throw new Error(`元素 ${elem.id} 的 dimensions 必须包含 width, depth, height`);
  }

  return {
    id: elem.id,
    type: elem.type as ElementType,
    name: elem.name,
    position: {
      x: pos.x,
      z: pos.z,
      y: typeof pos.y === 'number' ? pos.y : 0,
    },
    dimensions: {
      width: dim.width,
      depth: dim.depth,
      height: dim.height,
    },
    rotation: typeof elem.rotation === 'number' ? elem.rotation : 0,
    description: typeof elem.description === 'string' ? elem.description : undefined,
  };
}

export function parseExhibitionJson(jsonString: string): ExhibitionConfig {
  let data: unknown;
  
  try {
    data = JSON.parse(jsonString);
  } catch (e) {
    throw new Error(`JSON 解析失败: ${e instanceof Error ? e.message : '未知错误'}`);
  }

  if (typeof data !== 'object' || data === null) {
    throw new Error('JSON 根必须是对象类型');
  }

  const config = data as Record<string, unknown>;

  if (typeof config.version !== 'string' || config.version.trim() === '') {
    throw new Error('缺少必要字段: version');
  }

  if (typeof config.exhibitionName !== 'string' || config.exhibitionName.trim() === '') {
    throw new Error('缺少必要字段: exhibitionName');
  }

  if (typeof config.venue !== 'string' || config.venue.trim() === '') {
    throw new Error('缺少必要字段: venue');
  }

  if (typeof config.floor !== 'object' || config.floor === null) {
    throw new Error('缺少必要字段: floor');
  }

  const floor = config.floor as Record<string, unknown>;
  if (typeof floor.width !== 'number' || typeof floor.depth !== 'number' || typeof floor.height !== 'number') {
    throw new Error('floor 必须包含 width, depth, height 字段');
  }

  if (!Array.isArray(config.elements)) {
    throw new Error('缺少必要字段: elements (必须是数组)');
  }

  const elements: ExhibitionElement[] = [];
  const idSet = new Set<string>();

  for (let i = 0; i < config.elements.length; i++) {
    try {
      const element = validateElement(config.elements[i]);
      
      if (idSet.has(element.id)) {
        throw new Error(`重复的元素 id: ${element.id}`);
      }
      idSet.add(element.id);
      
      elements.push(element);
    } catch (e) {
      throw new Error(`元素 ${i} 验证失败: ${e instanceof Error ? e.message : '未知错误'}`);
    }
  }

  const entrances = elements.filter(e => e.type === 'entrance');
  const exits = elements.filter(e => e.type === 'exit');

  if (entrances.length === 0) {
    throw new Error('展厅配置中至少需要一个入口 (entrance)');
  }

  if (exits.length === 0) {
    throw new Error('展厅配置中至少需要一个出口 (exit)');
  }

  return {
    version: config.version,
    exhibitionName: config.exhibitionName,
    exhibitionDate: typeof config.exhibitionDate === 'string' ? config.exhibitionDate : new Date().toISOString().split('T')[0],
    venue: config.venue,
    floor: {
      width: floor.width,
      depth: floor.depth,
      height: floor.height,
    },
    elements,
  };
}

export function exportToJson(config: ExhibitionConfig): string {
  return JSON.stringify(config, null, 2);
}
