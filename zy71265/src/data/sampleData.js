export function generateSampleData() {
  const baseTime = Date.now() - 3600000 * 2;
  
  const artworks = [
    { id: 'art_001', name: '星空', x: -15, z: -12, floor: 1, width: 4, height: 3, rotation: 0, color: 0x8b5cf6, interactionRadius: 3 },
    { id: 'art_002', name: '向日葵', x: -15, z: 0, floor: 1, width: 3, height: 2.5, rotation: 0, color: 0xf59e0b, interactionRadius: 3 },
    { id: 'art_003', name: '蒙娜丽莎', x: -15, z: 12, floor: 1, width: 2.5, height: 3.5, rotation: 0, color: 0xec4899, interactionRadius: 3 },
    { id: 'art_004', name: '呐喊', x: 0, z: -13, floor: 1, width: 3, height: 2.5, rotation: 0, color: 0x10b981, interactionRadius: 3 },
    { id: 'art_005', name: '记忆的永恒', x: 15, z: -12, floor: 1, width: 3.5, height: 2.5, rotation: Math.PI, color: 0x6366f1, interactionRadius: 3 },
    { id: 'art_006', name: '戴珍珠耳环的少女', x: 15, z: 0, floor: 1, width: 2.5, height: 3, rotation: Math.PI, color: 0xf43f5e, interactionRadius: 3 },
    { id: 'art_007', name: '维纳斯的诞生', x: 15, z: 12, floor: 1, width: 4, height: 3, rotation: Math.PI, color: 0x0ea5e9, interactionRadius: 3 },
    { id: 'art_008', name: '最后的晚餐', x: -15, z: -12, floor: 2, width: 5, height: 3, rotation: 0, color: 0xa855f7, interactionRadius: 3 },
    { id: 'art_009', name: '创造亚当', x: 0, z: -13, floor: 2, width: 5, height: 3, rotation: 0, color: 0xf97316, interactionRadius: 3 },
    { id: 'art_010', name: '星月夜', x: 15, z: -12, floor: 2, width: 4, height: 3, rotation: Math.PI, color: 0x22d3ee, interactionRadius: 3 }
  ];

  const visitors = [];
  const deviceIds = [
    'device_001', 'device_002', 'device_003', 'device_004', 'device_005',
    'device_006', 'device_007', 'device_008', 'device_009', 'device_010',
    'device_011', 'device_012', 'device_013', 'device_014', 'device_015',
    'device_016', 'device_017', 'device_018', 'device_019', 'device_020'
  ];

  const pathTemplates = [
    [
      { x: 0, z: 14, floor: 1 },
      { x: -10, z: 12, floor: 1 },
      { x: -15, z: 12, floor: 1 },
      { x: -15, z: 0, floor: 1 },
      { x: -15, z: -12, floor: 1 },
      { x: 0, z: -13, floor: 1 },
      { x: 15, z: -12, floor: 1 },
      { x: 15, z: 0, floor: 1 },
      { x: 15, z: 12, floor: 1 },
      { x: 5, z: 14, floor: 1 }
    ],
    [
      { x: 0, z: 14, floor: 1 },
      { x: 10, z: 12, floor: 1 },
      { x: 15, z: 12, floor: 1 },
      { x: 15, z: 0, floor: 1 },
      { x: 15, z: -12, floor: 1 },
      { x: 0, z: -13, floor: 1 },
      { x: -15, z: -12, floor: 1 },
      { x: -15, z: 0, floor: 1 },
      { x: -15, z: 12, floor: 1 },
      { x: -5, z: 14, floor: 1 }
    ],
    [
      { x: 0, z: 14, floor: 1 },
      { x: 0, z: 5, floor: 1 },
      { x: 0, z: -5, floor: 1 },
      { x: 0, z: -13, floor: 1 },
      { x: 0, z: -5, floor: 1 },
      { x: 0, z: 5, floor: 1 },
      { x: 5, z: 14, floor: 1 }
    ],
    [
      { x: 0, z: 14, floor: 1 },
      { x: -8, z: 10, floor: 1 },
      { x: -15, z: 12, floor: 1 },
      { x: -15, z: 5, floor: 1 },
      { x: -8, z: 0, floor: 1 },
      { x: -15, z: -5, floor: 1 },
      { x: -15, z: -12, floor: 1 },
      { x: -8, z: -10, floor: 1 },
      { x: 0, z: -13, floor: 1 },
      { x: 8, z: -10, floor: 1 },
      { x: 15, z: -12, floor: 1 },
      { x: 15, z: -5, floor: 1 },
      { x: 8, z: 0, floor: 1 },
      { x: 15, z: 5, floor: 1 },
      { x: 15, z: 12, floor: 1 },
      { x: 8, z: 10, floor: 1 },
      { x: 0, z: 14, floor: 1 }
    ],
    [
      { x: 0, z: 14, floor: 1 },
      { x: -5, z: 10, floor: 1 },
      { x: -10, z: 5, floor: 1 },
      { x: -5, z: 0, floor: 1 },
      { x: -10, z: -5, floor: 1 },
      { x: -5, z: -10, floor: 1 },
      { x: 0, z: -5, floor: 1 },
      { x: 5, z: -10, floor: 1 },
      { x: 10, z: -5, floor: 1 },
      { x: 5, z: 0, floor: 1 },
      { x: 10, z: 5, floor: 1 },
      { x: 5, z: 10, floor: 1 },
      { x: 0, z: 14, floor: 1 }
    ]
  ];

  const pathTemplates2 = [
    [
      { x: 0, z: 14, floor: 1 },
      { x: 0, z: 5, floor: 1 },
      { x: 0, z: -5, floor: 1 },
      { x: 0, z: -13, floor: 1 },
      { x: 0, z: -5, floor: 1 },
      { x: 0, z: 5, floor: 1 },
      { x: 0, z: 14, floor: 2 },
      { x: -8, z: 10, floor: 2 },
      { x: -15, z: -12, floor: 2 },
      { x: 0, z: -13, floor: 2 },
      { x: 15, z: -12, floor: 2 },
      { x: 8, z: 10, floor: 2 },
      { x: 0, z: 14, floor: 1 }
    ],
    [
      { x: 0, z: 14, floor: 1 },
      { x: -15, z: 12, floor: 1 },
      { x: -15, z: 0, floor: 1 },
      { x: -15, z: -12, floor: 1 },
      { x: 0, z: -13, floor: 1 },
      { x: 0, z: 14, floor: 2 },
      { x: -15, z: -12, floor: 2 },
      { x: 0, z: -13, floor: 2 },
      { x: 15, z: -12, floor: 2 },
      { x: 0, z: 14, floor: 1 }
    ]
  ];

  for (let i = 0; i < 25; i++) {
    const batch = i < 8 ? '1' : i < 16 ? '2' : '3';
    const templateIndex = i < 20 ? Math.floor(Math.random() * pathTemplates.length) : Math.floor(Math.random() * pathTemplates2.length);
    const template = i < 20 ? pathTemplates[templateIndex] : pathTemplates2[templateIndex];
    
    const baseOffset = i * 120000;
    const speedVariation = 0.8 + Math.random() * 0.4;
    const deviceId = deviceIds[i % deviceIds.length];
    
    const path = [];
    let currentTime = baseTime + baseOffset;
    
    for (let j = 0; j < template.length; j++) {
      const point = template[j];
      const steps = 3 + Math.floor(Math.random() * 3);
      
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        const nextPoint = template[(j + 1) % template.length];
        
        const x = point.x + (nextPoint.x - point.x) * t + (Math.random() - 0.5) * 2;
        const z = point.z + (nextPoint.z - point.z) * t + (Math.random() - 0.5) * 2;
        
        const stayChance = Math.random();
        const stayDuration = stayChance < 0.3 ? 5000 + Math.random() * 20000 : 2000 + Math.random() * 5000;
        
        path.push({
          x: Math.max(-18, Math.min(18, x)),
          z: Math.max(-14, Math.min(14, z)),
          floor: point.floor,
          timestamp: currentTime
        });
        
        currentTime += stayDuration * speedVariation;
      }
    }

    visitors.push({
      id: `visitor_${String(i + 1).padStart(3, '0')}`,
      deviceId: deviceId,
      batch: batch,
      path: path
    });
  }

  visitors.push({
    id: 'visitor_duplicate',
    deviceId: 'device_001',
    batch: '3',
    path: [
      { x: 0, z: 14, floor: 1, timestamp: baseTime + 800000 },
      { x: -5, z: 10, floor: 1, timestamp: baseTime + 805000 },
      { x: -10, z: 5, floor: 1, timestamp: baseTime + 810000 },
      { x: -15, z: 12, floor: 1, timestamp: baseTime + 820000 },
      { x: -5, z: 14, floor: 1, timestamp: baseTime + 840000 }
    ]
  });

  return {
    name: '2026年5月28日 观展数据 (示例)',
    artworks: artworks,
    visitors: visitors
  };
}

export function downloadSampleData() {
  const data = generateSampleData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'gallery-sample-data.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
