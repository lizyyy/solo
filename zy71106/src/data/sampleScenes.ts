import { SceneData, PVComponent, Tree, Roof } from '../types';

function generateMonthlyData(baseShadowHours: number): PVComponent['shadowStats']['monthlyData'] {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    shadowHours: baseShadowHours * (1 + Math.sin((i + 1) * Math.PI / 6) * 0.5),
    peakShadowHours: baseShadowHours * 0.3,
  }));
}

const defaultRoof: Roof = {
  width: 30,
  depth: 20,
  height: 10,
  parapetHeight: 1.2,
  slope: 15,
};

const sampleTrees: Tree[] = [
  {
    id: 'tree-1',
    position: { x: -20, y: 0, z: -15 },
    height: 15,
    radius: 4,
  },
  {
    id: 'tree-2',
    position: { x: -18, y: 0, z: 5 },
    height: 12,
    radius: 3.5,
  },
  {
    id: 'tree-3',
    position: { x: 22, y: 0, z: -10 },
    height: 10,
    radius: 3,
  },
  {
    id: 'tree-4',
    position: { x: 25, y: 0, z: 12 },
    height: 8,
    radius: 2.5,
  },
];

function generateComponents(): PVComponent[] {
  const components: PVComponent[] = [];
  const componentWidth = 1.7;
  const componentHeight = 1;
  const spacing = 0.5;

  const rows = 4;
  const cols = 8;
  const startX = -((cols * (componentWidth + spacing) - spacing) / 2);
  const startZ = -((rows * (componentHeight + spacing) - spacing) / 2) + 5;

  let componentIndex = 1;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const group = row < 2 ? 'A区' : 'B区';
      const baseShadowHours = row === 0 ? 2.5 : row === 1 ? 1.8 : row === 2 ? 1.2 : 0.8;

      components.push({
        id: `comp-${componentIndex}`,
        name: `组件 ${componentIndex}`,
        group,
        position: {
          x: startX + col * (componentWidth + spacing),
          y: 10.1,
          z: startZ + row * (componentHeight + spacing),
        },
        size: { width: componentWidth, height: componentHeight },
        rotation: 0,
        shadowStats: {
          totalHours: 12,
          shadowHours: baseShadowHours,
          shadowRate: (baseShadowHours / 12) * 100,
          monthlyData: generateMonthlyData(baseShadowHours),
        },
      });
      componentIndex++;
    }
  }

  return components;
}

export const sampleScene: SceneData = {
  roof: defaultRoof,
  trees: sampleTrees,
  components: generateComponents(),
};

export const sampleScenes: Record<string, SceneData> = {
  '标准院落': sampleScene,
};

export function getSampleSceneNames(): string[] {
  return Object.keys(sampleScenes);
}

export function loadSampleScene(name: string): SceneData | null {
  return sampleScenes[name] || null;
}
