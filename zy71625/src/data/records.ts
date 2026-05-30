import { VinylRecord } from '../types';

export const MOCK_RECORDS: VinylRecord[] = [
  {
    id: 'record-001',
    title: '蓝色多瑙河',
    artist: '约翰·施特劳斯',
    condition: 'poor',
    difficulty: 2,
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=vintage%20vinyl%20record%20cover%20classical%20music%20blue%20danube&image_size=square',
    scratches: [
      { id: 's1', position: 30, angle: 45, severity: 'light', isFalsePositive: false, length: 15, detected: false, repaired: false },
      { id: 's2', position: 55, angle: 120, severity: 'medium', isFalsePositive: false, length: 25, detected: false, repaired: false },
      { id: 's3', position: 70, angle: 200, severity: 'deep', isFalsePositive: false, length: 40, detected: false, repaired: false },
      { id: 's4', position: 40, angle: 280, severity: 'light', isFalsePositive: true, length: 8, detected: false, repaired: false },
    ],
    noises: [
      { id: 'n1', type: 'surface', frequency: 120, amplitude: 45, dataSource: 'system', detectedAt: Date.now(), analyzed: false },
      { id: 'n2', type: 'crackle', frequency: 800, amplitude: 62, dataSource: 'system', detectedAt: Date.now(), analyzed: false },
      { id: 'n3', type: 'pop', frequency: 2000, amplitude: 35, dataSource: 'system', detectedAt: Date.now(), analyzed: false },
    ],
  },
  {
    id: 'record-002',
    title: '月光奏鸣曲',
    artist: '贝多芬',
    condition: 'fair',
    difficulty: 3,
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=vintage%20vinyl%20record%20cover%20beethoven%20moonlight%20sonata&image_size=square',
    scratches: [
      { id: 's5', position: 25, angle: 30, severity: 'medium', isFalsePositive: false, length: 20, detected: false, repaired: false },
      { id: 's6', position: 45, angle: 90, severity: 'deep', isFalsePositive: false, length: 35, detected: false, repaired: false },
      { id: 's7', position: 60, angle: 150, severity: 'medium', isFalsePositive: true, length: 12, detected: false, repaired: false },
      { id: 's8', position: 75, angle: 220, severity: 'deep', isFalsePositive: false, length: 45, detected: false, repaired: false },
      { id: 's9', position: 35, angle: 310, severity: 'light', isFalsePositive: true, length: 6, detected: false, repaired: false },
    ],
    noises: [
      { id: 'n4', type: 'surface', frequency: 150, amplitude: 52, dataSource: 'system', detectedAt: Date.now(), analyzed: false },
      { id: 'n5', type: 'warble', frequency: 440, amplitude: 70, dataSource: 'system', detectedAt: Date.now(), analyzed: false },
      { id: 'n6', type: 'crackle', frequency: 1200, amplitude: 48, dataSource: 'system', detectedAt: Date.now(), analyzed: false },
      { id: 'n7', type: 'distortion', frequency: 3000, amplitude: 80, dataSource: 'system', detectedAt: Date.now(), analyzed: false },
    ],
  },
  {
    id: 'record-003',
    title: '天鹅湖',
    artist: '柴可夫斯基',
    condition: 'good',
    difficulty: 1,
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=vintage%20vinyl%20record%20cover%20tchaikovsky%20swan%20lake&image_size=square',
    scratches: [
      { id: 's10', position: 40, angle: 60, severity: 'light', isFalsePositive: false, length: 10, detected: false, repaired: false },
      { id: 's11', position: 65, angle: 180, severity: 'medium', isFalsePositive: false, length: 18, detected: false, repaired: false },
    ],
    noises: [
      { id: 'n8', type: 'surface', frequency: 100, amplitude: 30, dataSource: 'system', detectedAt: Date.now(), analyzed: false },
      { id: 'n9', type: 'pop', frequency: 1500, amplitude: 25, dataSource: 'system', detectedAt: Date.now(), analyzed: false },
    ],
  },
  {
    id: 'record-004',
    title: '命运交响曲',
    artist: '贝多芬',
    condition: 'poor',
    difficulty: 3,
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=vintage%20vinyl%20record%20cover%20beethoven%20symphony%20fate&image_size=square',
    scratches: [
      { id: 's12', position: 20, angle: 15, severity: 'deep', isFalsePositive: false, length: 50, detected: false, repaired: false },
      { id: 's13', position: 35, angle: 75, severity: 'medium', isFalsePositive: false, length: 22, detected: false, repaired: false },
      { id: 's14', position: 50, angle: 135, severity: 'light', isFalsePositive: true, length: 5, detected: false, repaired: false },
      { id: 's15', position: 65, angle: 210, severity: 'deep', isFalsePositive: false, length: 55, detected: false, repaired: false },
      { id: 's16', position: 80, angle: 300, severity: 'medium', isFalsePositive: true, length: 15, detected: false, repaired: false },
      { id: 's17', position: 45, angle: 345, severity: 'light', isFalsePositive: false, length: 12, detected: false, repaired: false },
    ],
    noises: [
      { id: 'n10', type: 'surface', frequency: 180, amplitude: 65, dataSource: 'system', detectedAt: Date.now(), analyzed: false },
      { id: 'n11', type: 'crackle', frequency: 950, amplitude: 72, dataSource: 'system', detectedAt: Date.now(), analyzed: false },
      { id: 'n12', type: 'pop', frequency: 1800, amplitude: 55, dataSource: 'system', detectedAt: Date.now(), analyzed: false },
      { id: 'n13', type: 'warble', frequency: 520, amplitude: 60, dataSource: 'system', detectedAt: Date.now(), analyzed: false },
      { id: 'n14', type: 'distortion', frequency: 2500, amplitude: 85, dataSource: 'system', detectedAt: Date.now(), analyzed: false },
    ],
  },
];

export const getRandomRecord = (): VinylRecord => {
  const index = Math.floor(Math.random() * MOCK_RECORDS.length);
  return JSON.parse(JSON.stringify(MOCK_RECORDS[index]));
};

export const getRecordById = (id: string): VinylRecord | undefined => {
  const record = MOCK_RECORDS.find(r => r.id === id);
  return record ? JSON.parse(JSON.stringify(record)) : undefined;
};
