import { TrackElement, MagneticField, ToolDefinition } from '../types';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: 'tool-track-start',
    type: 'track',
    subType: 'start',
    name: '粒子源',
    description: '粒子发射起点',
    icon: 'Zap',
    defaultProps: { width: 80, height: 80, rotation: 0 },
  },
  {
    id: 'tool-track-end',
    type: 'track',
    subType: 'end',
    name: '终点靶',
    description: '粒子到达目标',
    icon: 'Target',
    defaultProps: { width: 80, height: 80, rotation: 0 },
  },
  {
    id: 'tool-track-straight',
    type: 'track',
    subType: 'straight',
    name: '直线轨道',
    description: '直线路径段',
    icon: 'Minus',
    defaultProps: { width: 120, height: 80, rotation: 0 },
  },
  {
    id: 'tool-track-curve-left',
    type: 'track',
    subType: 'curve-left',
    name: '左弯轨道',
    description: '向左弯曲路径',
    icon: 'CornerDownLeft',
    defaultProps: { width: 120, height: 120, rotation: 0 },
  },
  {
    id: 'tool-track-curve-right',
    type: 'track',
    subType: 'curve-right',
    name: '右弯轨道',
    description: '向右弯曲路径',
    icon: 'CornerDownRight',
    defaultProps: { width: 120, height: 120, rotation: 0 },
  },
  {
    id: 'tool-magnetic-into',
    type: 'magnetic',
    subType: 'into',
    name: '磁场⊗',
    description: '垂直纸面向里',
    icon: 'ArrowDownToLine',
    defaultProps: { width: 160, height: 120, strength: 3, direction: 'into' },
  },
  {
    id: 'tool-magnetic-outof',
    type: 'magnetic',
    subType: 'outof',
    name: '磁场⊙',
    description: '垂直纸面向外',
    icon: 'ArrowUpFromLine',
    defaultProps: { width: 160, height: 120, strength: 3, direction: 'outof' },
  },
];

export function getToolById(id: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((tool) => tool.id === id);
}

export function getSourceToolName(element: TrackElement | MagneticField): string {
  const tool = getToolById(element.sourceToolId);
  return tool?.name || '未知来源';
}

export function getSourceTool(element: TrackElement | MagneticField): ToolDefinition | undefined {
  return getToolById(element.sourceToolId);
}

export function traceElementSource(
  element: TrackElement | MagneticField
): {
  tool: ToolDefinition | undefined;
  toolId: string;
  elementId: string;
  elementType: string;
} {
  return {
    tool: getToolById(element.sourceToolId),
    toolId: element.sourceToolId,
    elementId: element.id,
    elementType: 'type' in element ? element.type : 'magnetic',
  };
}

export function getTrackTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    start: '粒子源（起点）',
    end: '终点靶',
    straight: '直线轨道',
    'curve-left': '左弯轨道',
    'curve-right': '右弯轨道',
  };
  return descriptions[type] || type;
}

export function getMagneticDirectionDescription(direction: string): string {
  const descriptions: Record<string, string> = {
    into: '垂直纸面向里 (⊗)',
    outof: '垂直纸面向外 (⊙)',
    left: '水平向左',
    right: '水平向右',
    up: '竖直向上',
    down: '竖直向下',
  };
  return descriptions[direction] || direction;
}

export function getMagneticDirectionSymbol(direction: string): string {
  const symbols: Record<string, string> = {
    into: '⊗',
    outof: '⊙',
    left: '←',
    right: '→',
    up: '↑',
    down: '↓',
  };
  return symbols[direction] || '?';
}

export function createElementFromTool(
  toolId: string,
  x: number,
  y: number,
  generateId: () => string
): TrackElement | MagneticField | null {
  const tool = getToolById(toolId);
  if (!tool) return null;

  const baseId = generateId();

  if (tool.type === 'track') {
    return {
      id: baseId,
      type: tool.subType as TrackElement['type'],
      x,
      y,
      rotation: (tool.defaultProps.rotation as number) || 0,
      sourceToolId: toolId,
      width: (tool.defaultProps.width as number) || 120,
      height: (tool.defaultProps.height as number) || 80,
    };
  }

  if (tool.type === 'magnetic') {
    return {
      id: baseId,
      x,
      y,
      width: (tool.defaultProps.width as number) || 160,
      height: (tool.defaultProps.height as number) || 120,
      strength: (tool.defaultProps.strength as number) || 3,
      direction: tool.defaultProps.direction as MagneticField['direction'],
      sourceToolId: toolId,
    };
  }

  return null;
}

export function getToolIconName(toolId: string): string {
  const tool = getToolById(toolId);
  return tool?.icon || 'HelpCircle';
}
