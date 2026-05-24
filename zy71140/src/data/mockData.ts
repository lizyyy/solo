import type { ColdStorage, Layer, Slot, SKU } from '../types';

export const sampleColdStorage: ColdStorage = {
  id: 'cs-001',
  name: 'A区一号冷库',
  dimensions: { width: 20, height: 12, depth: 15 },
};

export const sampleLayers: Layer[] = [
  {
    id: 'layer-1',
    name: '冷冻层 (-18°C)',
    level: 1,
    tempRange: '-20°C ~ -15°C',
    color: '#0ea5e9',
    minTemp: -20,
    maxTemp: -15,
  },
  {
    id: 'layer-2',
    name: '冷冻层 (-12°C)',
    level: 2,
    tempRange: '-15°C ~ -10°C',
    color: '#06b6d4',
    minTemp: -15,
    maxTemp: -10,
  },
  {
    id: 'layer-3',
    name: '冷藏层 (0°C)',
    level: 3,
    tempRange: '-2°C ~ 4°C',
    color: '#14b8a6',
    minTemp: -2,
    maxTemp: 4,
  },
  {
    id: 'layer-4',
    name: '保鲜层 (5°C)',
    level: 4,
    tempRange: '2°C ~ 8°C',
    color: '#10b981',
    minTemp: 2,
    maxTemp: 8,
  },
];

function generateSlots(): Slot[] {
  const slots: Slot[] = [];
  const cols = 5;
  const rows = 4;
  const layers = 4;

  for (let l = 0; l < layers; l++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const slotId = `slot-${l + 1}-${r + 1}-${c + 1}`;
        const isOccupied = Math.random() > 0.3;
        const isMisplaced = isOccupied && Math.random() > 0.85;
        const isConflict = isOccupied && Math.random() > 0.92;

        slots.push({
          id: slotId,
          code: `L${l + 1}-R${r + 1}-C${c + 1}`,
          position: {
            x: (c - cols / 2 + 0.5) * 3.5,
            y: l * 2.5 + 1,
            z: (r - rows / 2 + 0.5) * 3,
          },
          layerId: `layer-${l + 1}`,
          status: isConflict ? 'conflict' : isMisplaced ? 'misplaced' : 'normal',
          isOccupied,
        });
      }
    }
  }
  return slots;
}

function generateSKUs(slots: Slot[]): SKU[] {
  const skus: SKU[] = [];
  const today = new Date();

  const skuTemplates = [
    { name: '进口牛肉', code: 'BEEF', category: '肉类' },
    { name: '三文鱼', code: 'SALM', category: '海鲜' },
    { name: '速冻饺子', code: 'DUM-', category: '速冻食品' },
    { name: '冰淇淋', code: 'ICEC', category: '冷冻甜品' },
    { name: '鲜牛奶', code: 'MILK', category: '乳制品' },
    { name: '新鲜蔬菜', code: 'VEG-', category: '蔬菜' },
    { name: '水果拼盘', code: 'FRUI', category: '水果' },
    { name: '海鲜大虾', code: 'SHRI', category: '海鲜' },
  ];

  let skuIndex = 1;
  slots.forEach((slot) => {
    if (slot.isOccupied) {
      const template = skuTemplates[Math.floor(Math.random() * skuTemplates.length)];
      const daysToExpiry = Math.floor(Math.random() * 180);
      const expiryDate = new Date(today);
      expiryDate.setDate(today.getDate() + daysToExpiry);

      const inboundDate = new Date(today);
      inboundDate.setDate(today.getDate() - Math.floor(Math.random() * 60));

      skus.push({
        id: `sku-${String(skuIndex).padStart(4, '0')}`,
        name: template.name,
        code: `${template.code}${String(skuIndex).padStart(4, '0')}`,
        batchNo: `B${new Date().getFullYear()}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        expiryDate: expiryDate.toISOString().split('T')[0],
        inboundDate: inboundDate.toISOString().split('T')[0],
        slotId: slot.id,
        layerId: slot.layerId,
        quantity: Math.floor(Math.random() * 50) + 10,
        category: template.category,
      });
      skuIndex++;
    }
  });

  return skus;
}

export const sampleSlots = generateSlots();
export const sampleSKUs = generateSKUs(sampleSlots);

export function getInitialState() {
  return {
    coldStorage: sampleColdStorage,
    layers: sampleLayers,
    slots: sampleSlots,
    skus: sampleSKUs,
    selectedLayerIds: sampleLayers.map((l) => l.id),
    selectedSlotId: null,
    searchQuery: '',
    expiryFilterDays: 30,
    cameraView: 'overview' as const,
    timestamp: Date.now(),
    leftPanelOpen: true,
    rightPanelOpen: true,
  };
}
