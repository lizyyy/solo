import { TreeData } from '../types';

function generateTrees(count: number, terrainWidth: number, terrainHeight: number): TreeData[] {
  const trees: TreeData[] = [];
  const types: TreeData['type'][] = ['pine', 'oak', 'birch'];
  
  for (let i = 0; i < count; i++) {
    trees.push({
      id: `tree-${i}`,
      position: {
        x: (Math.random() - 0.5) * terrainWidth * 0.9,
        y: 0,
        z: (Math.random() - 0.5) * terrainHeight * 0.9
      },
      height: 5 + Math.random() * 10,
      type: types[Math.floor(Math.random() * types.length)]
    });
  }
  
  return trees;
}

export const TREES: TreeData[] = generateTrees(200, 100, 100);
