export const sampleTrails = {
  qingcheng: {
    name: '青城山步道',
    description: '青城天下幽，道家名山徒步路线',
    trailPoints: generateTrailPoints(150, {
      startElev: 700,
      maxElev: 1260,
      complexity: 0.6,
      xRange: 2000,
      zRange: 1500
    }),
    supplyStations: [
      { id: 's1', name: '山门补给站', type: 'water', distance: 0.5, services: ['饮用水', '简易医疗'] },
      { id: 's2', name: '天师洞驿站', type: 'full', distance: 3.2, services: ['餐饮', '住宿', '医疗'] },
      { id: 's3', name: '上清宫补给点', type: 'snack', distance: 6.8, services: ['零食', '热水'] },
      { id: 's4', name: '老君阁休息站', type: 'view', distance: 8.5, services: ['观景台', '休息区'] }
    ],
    riskSegments: [
      { id: 'r1', name: '千级台阶段', level: 'medium', startDist: 1.2, endDist: 2.0, description: '陡峭石阶，注意防滑' },
      { id: 'r2', name: '悬崖栈道', level: 'high', startDist: 4.5, endDist: 5.2, description: '临崖路段，雨天关闭', closedInRain: true },
      { id: 'r3', name: '密林穿越区', level: 'low', startDist: 6.0, endDist: 6.5, description: '蚊虫较多，建议使用驱蚊液' },
      { id: 'r4', name: '山顶风口', level: 'medium', startDist: 8.0, endDist: 8.8, description: '风力较大，注意保暖' }
    ],
    elevationMarkers: [
      { distance: 0, elevation: 700, label: '山门起点' },
      { distance: 2.5, elevation: 920, label: '天师洞平台' },
      { distance: 5.0, elevation: 1050, label: '朝阳洞' },
      { distance: 7.5, elevation: 1180, label: '上清宫' },
      { distance: 8.8, elevation: 1260, label: '老君阁顶点' }
    ]
  },
  huangshan: {
    name: '黄山步道',
    description: '五岳归来不看山，黄山归来不看岳',
    trailPoints: generateTrailPoints(200, {
      startElev: 800,
      maxElev: 1864,
      complexity: 0.8,
      xRange: 2500,
      zRange: 2000
    }),
    supplyStations: [
      { id: 's1', name: '慈光阁站', type: 'full', distance: 0.3, services: ['餐饮', '住宿', '缆车'] },
      { id: 's2', name: '半山寺', type: 'snack', distance: 3.5, services: ['热水', '零食'] },
      { id: 's3', name: '玉屏楼宾馆', type: 'full', distance: 7.0, services: ['餐饮', '住宿', '医疗'] },
      { id: 's4', name: '光明顶服务区', type: 'full', distance: 11.0, services: ['餐饮', '住宿', '观景'] },
      { id: 's5', name: '白鹅岭', type: 'snack', distance: 14.5, services: ['零食', '饮用水'] }
    ],
    riskSegments: [
      { id: 'r1', name: '天都峰坡道', level: 'high', startDist: 5.0, endDist: 6.2, description: '险峻攀登路段，恐高者慎行', closedInRain: true },
      { id: 'r2', name: '一线天', level: 'medium', startDist: 6.8, endDist: 7.1, description: '狭窄通道，单向通行' },
      { id: 'r3', name: '鳌鱼背', level: 'high', startDist: 9.5, endDist: 9.8, description: '山脊窄路，两侧悬崖', closedInRain: true },
      { id: 'r4', name: '西海大峡谷', level: 'medium', startDist: 12.0, endDist: 13.5, description: '深度落差大，注意体力分配' }
    ],
    elevationMarkers: [
      { distance: 0, elevation: 800, label: '慈光阁起点' },
      { distance: 4.0, elevation: 1200, label: '半山寺' },
      { distance: 7.2, elevation: 1680, label: '玉屏楼' },
      { distance: 11.0, elevation: 1860, label: '光明顶' },
      { distance: 15.5, elevation: 1650, label: '白鹅岭终点' }
    ]
  },
  emei: {
    name: '峨眉山步道',
    description: '秀甲天下，佛教名山朝圣之路',
    trailPoints: generateTrailPoints(250, {
      startElev: 500,
      maxElev: 3077,
      complexity: 0.7,
      xRange: 3000,
      zRange: 2500
    }),
    supplyStations: [
      { id: 's1', name: '报国寺客运站', type: 'full', distance: 0.2, services: ['餐饮', '住宿', '车票'] },
      { id: 's2', name: '清音阁', type: 'snack', distance: 5.0, services: ['零食', '饮用水'] },
      { id: 's3', name: '洪椿坪', type: 'full', distance: 10.0, services: ['餐饮', '住宿', '医疗'] },
      { id: 's4', name: '洗象池', type: 'snack', distance: 18.0, services: ['热水', '简餐'] },
      { id: 's5', name: '雷洞坪', type: 'full', distance: 25.0, services: ['餐饮', '住宿', '缆车'] },
      { id: 's6', name: '金顶', type: 'full', distance: 28.5, services: ['餐饮', '住宿', '观景'] }
    ],
    riskSegments: [
      { id: 'r1', name: '九十九道拐', level: 'high', startDist: 7.0, endDist: 8.5, description: '连续急弯陡坡，注意膝盖保护', closedInRain: false },
      { id: 'r2', name: '猴区路段', level: 'medium', startDist: 9.0, endDist: 10.5, description: '野生猴群出没，请勿投喂' },
      { id: 'r3', name: '钻天坡', level: 'high', startDist: 14.0, endDist: 15.5, description: '陡峭长坡，建议登山杖', closedInRain: true },
      { id: 'r4', name: '云海结冰区', level: 'high', startDist: 26.0, endDist: 28.0, description: '高海拔路段，可能有积雪结冰', closedInRain: true }
    ],
    elevationMarkers: [
      { distance: 0, elevation: 500, label: '报国寺起点' },
      { distance: 5.0, elevation: 750, label: '清音阁' },
      { distance: 10.0, elevation: 1100, label: '洪椿坪' },
      { distance: 18.0, elevation: 2070, label: '洗象池' },
      { distance: 25.0, elevation: 2430, label: '雷洞坪' },
      { distance: 28.5, elevation: 3077, label: '金顶终点' }
    ]
  }
};

function generateTrailPoints(count, options) {
  const { startElev, maxElev, complexity, xRange, zRange } = options;
  const points = [];
  const elevGain = maxElev - startElev;
  
  for (let i = 0; i < count; i++) {
    const progress = i / (count - 1);
    
    const baseX = progress * xRange - xRange / 2;
    const baseZ = Math.sin(progress * Math.PI * 2 * complexity) * zRange * 0.4;
    
    const noiseX = (Math.sin(progress * 13) * 0.5 + Math.sin(progress * 7) * 0.3) * 80;
    const noiseZ = (Math.cos(progress * 11) * 0.5 + Math.cos(progress * 5) * 0.3) * 60;
    
    const x = baseX + noiseX;
    const z = baseZ + noiseZ;
    
    const baseElev = startElev + elevGain * (1 - Math.pow(1 - progress, 1.5));
    const elevNoise = Math.sin(progress * 8) * 30 + Math.cos(progress * 15) * 20 + Math.sin(progress * 3) * 50;
    const elevation = Math.max(startElev, Math.min(maxElev, baseElev + elevNoise));
    
    points.push({
      x,
      y: elevation,
      z,
      elevation,
      distance: progress * (count / 10)
    });
  }
  
  return points;
}

export const weatherConfig = {
  sunny: { icon: '☀️', title: '晴朗', desc: '适合徒步', color: 0xffdd00, fog: 0.01 },
  cloudy: { icon: '⛅', title: '多云', desc: '适宜出行', color: 0xaaaaaa, fog: 0.02 },
  rainy: { icon: '🌧️', title: '小雨', desc: '注意防滑', color: 0x4488ff, fog: 0.05 },
  stormy: { icon: '⛈️', title: '暴雨', desc: '建议折返', color: 0x333366, fog: 0.08 }
};
