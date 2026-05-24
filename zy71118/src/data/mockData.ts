import { Store, Shelf, SkuSlot, ShelfLayer, HeatmapPoint } from '../types';

const skuColors: Record<string, string> = {
  '饮料': '#3B82F6',
  '零食': '#F59E0B',
  '日用品': '#10B981',
  '洗护': '#8B5CF6',
  '食品': '#EF4444',
};

const skuNames: Record<string, string[]> = {
  '饮料': ['可口可乐', '百事可乐', '雪碧', '农夫山泉', '脉动', '红牛', '王老吉'],
  '零食': ['乐事薯片', '奥利奥', '洽洽瓜子', '三只松鼠', '良品铺子', '卫龙辣条'],
  '日用品': ['卫生纸', '抽纸', '洗衣液', '洗洁精', '垃圾袋', '保鲜膜'],
  '洗护': ['洗发水', '沐浴露', '牙膏', '洗面奶', '护手霜', '香皂'],
  '食品': ['方便面', '火腿肠', '面包', '牛奶', '酸奶', '饼干'],
};

function generateSlots(count: number, category: string, startPos: number = 0): SkuSlot[] {
  const slots: SkuSlot[] = [];
  const names = skuNames[category] || ['商品A', '商品B', '商品C'];
  
  for (let i = 0; i < count; i++) {
    slots.push({
      id: `slot-${category}-${startPos + i}`,
      skuId: `sku-${category}-${i % names.length}`,
      skuName: names[i % names.length],
      category,
      position: startPos + i,
      width: 1,
      isOutOfStock: Math.random() < 0.1,
      color: skuColors[category] || '#6B7280',
    });
  }
  return slots;
}

function generateLayers(category: string, hasGoldenIssue: boolean = false): ShelfLayer[] {
  const layers: ShelfLayer[] = [];
  const heights = [0.3, 0.6, 0.95, 1.3, 1.65, 2.0];
  
  for (let i = 0; i < 6; i++) {
    const isGolden = heights[i] >= 0.85 && heights[i] <= 1.25;
    layers.push({
      index: i,
      height: heights[i],
      isGolden,
      capacity: 8,
      slots: isGolden && hasGoldenIssue 
        ? generateSlots(5, '日用品', i * 10)
        : generateSlots(8, category, i * 10),
    });
  }
  return layers;
}

function generateShelf(
  id: string,
  x: number,
  z: number,
  rotation: number,
  category: string,
  isEndcap: boolean = false,
  hasDuplicate: boolean = false,
  hasGoldenIssue: boolean = false
): Shelf {
  const layers = generateLayers(category, hasGoldenIssue);
  
  if (hasDuplicate) {
    const goldenLayer = layers.find(l => l.isGolden);
    if (goldenLayer && goldenLayer.slots.length > 2) {
      goldenLayer.slots[2].skuId = goldenLayer.slots[0].skuId;
      goldenLayer.slots[2].skuName = goldenLayer.slots[0].skuName;
      goldenLayer.slots[2].color = goldenLayer.slots[0].color;
    }
  }
  
  return {
    id,
    type: isEndcap ? 'endcap' : 'normal',
    x,
    z,
    rotation,
    width: 4,
    height: 2.2,
    depth: 1,
    layers,
    isEndcap,
    isBlocked: isEndcap && id === 'shelf-endcap-1',
  };
}

function generateHeatmap(storeWidth: number, storeDepth: number): HeatmapPoint[] {
  const points: HeatmapPoint[] = [];
  const gridSize = 0.5;
  
  for (let x = -storeWidth / 2 + 1; x < storeWidth / 2 - 1; x += gridSize) {
    for (let z = -storeDepth / 2 + 1; z < storeDepth / 2 - 1; z += gridSize) {
      const distFromCenter = Math.sqrt(x * x + z * z) / Math.max(storeWidth, storeDepth);
      const intensity = Math.max(0, 1 - distFromCenter * 1.5) * (0.3 + Math.random() * 0.7);
      
      const nearAisle = Math.abs(x % 4) < 0.5 || Math.abs(z % 5) < 0.5;
      const finalIntensity = nearAisle ? Math.min(1, intensity * 1.5) : intensity * 0.3;
      
      points.push({ x, z, intensity: finalIntensity });
    }
  }
  return points;
}

export function generateSampleStore(): Store {
  const shelves: Shelf[] = [];
  const categories = ['饮料', '零食', '日用品', '洗护', '食品'];
  
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const x = (col - 0.5) * 10;
      const z = (row - 1) * 6;
      const category = categories[(row * 2 + col) % categories.length];
      const hasDuplicate = row === 1 && col === 0;
      const hasGoldenIssue = row === 0 && col === 1;
      
      shelves.push(generateShelf(
        `shelf-${row}-${col}`,
        x, z, 0, category, false, hasDuplicate, hasGoldenIssue
      ));
    }
  }
  
  shelves.push(generateShelf('shelf-endcap-1', -12, 0, Math.PI / 2, '饮料', true, false, false));
  shelves.push(generateShelf('shelf-endcap-2', 12, 0, -Math.PI / 2, '食品', true, false, true));
  
  const storeWidth = 30;
  const storeDepth = 20;
  
  return {
    id: 'store-sample-001',
    name: '示范门店 - 中关村店',
    width: storeWidth,
    depth: storeDepth,
    shelves,
    heatmapData: generateHeatmap(storeWidth, storeDepth),
  };
}

export const cameraPresets = [
  { name: '俯视全景', position: [0, 25, 20], target: [0, 0, 0] },
  { name: '主通道视角', position: [0, 5, 15], target: [0, 0, 0] },
  { name: '左侧端架', position: [-15, 5, 0], target: [-12, 0, 0] },
  { name: '右侧端架', position: [15, 5, 0], target: [12, 0, 0] },
  { name: '黄金层平视', position: [0, 1, 10], target: [0, 1, 0] },
];
