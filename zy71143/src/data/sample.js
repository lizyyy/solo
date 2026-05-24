export const sampleSceneData = {
  ride: {
    name: '极速过山车',
    position: { x: 15, y: 0, z: -10 }
  },
  
  queue: {
    path: [
      { x: -25, z: 20 },
      { x: -15, z: 20 },
      { x: -15, z: 15 },
      { x: -20, z: 15 },
      { x: -20, z: 10 },
      { x: -10, z: 10 },
      { x: -10, z: 5 },
      { x: -15, z: 5 },
      { x: -15, z: 0 },
      { x: -5, z: 0 },
      { x: -5, z: -5 },
      { x: 5, z: -5 }
    ]
  },
  
  screens: [
    {
      name: '主提示屏 A',
      position: { x: 0, z: 15 },
      width: 4,
      height: 2.5,
      rotation: 0
    },
    {
      name: '提示屏 B',
      position: { x: -20, z: 5 },
      width: 3,
      height: 2,
      rotation: Math.PI / 4
    },
    {
      name: '提示屏 C',
      position: { x: -10, z: -5 },
      width: 3,
      height: 2,
      rotation: -Math.PI / 6
    }
  ],
  
  obstacles: [
    {
      name: '立柱 1',
      shape: 'cylinder',
      position: { x: -12, z: 12 },
      radius: 0.8,
      height: 4,
      color: 0x8b5cf6
    },
    {
      name: '立柱 2',
      shape: 'cylinder',
      position: { x: -5, z: 8 },
      radius: 0.6,
      height: 4,
      color: 0x8b5cf6
    },
    {
      name: '信息亭',
      shape: 'box',
      position: { x: -18, z: 0 },
      width: 3,
      height: 2.5,
      depth: 2,
      color: 0xf59e0b
    },
    {
      name: '装饰墙',
      shape: 'box',
      position: { x: -8, z: -2 },
      width: 1,
      height: 3,
      depth: 4,
      color: 0x06b6d4
    }
  ],
  
  viewpoints: [
    { name: 'VP01-起点', position: { x: -25, z: 20 }, eyeHeight: 1.6 },
    { name: 'VP02-转角1', position: { x: -15, z: 18 }, eyeHeight: 1.6 },
    { name: 'VP03-中段', position: { x: -18, z: 12 }, eyeHeight: 1.6 },
    { name: 'VP04-折返点', position: { x: -12, z: 8 }, eyeHeight: 1.6 },
    { name: 'VP05-中段2', position: { x: -15, z: 3 }, eyeHeight: 1.6 },
    { name: 'VP06-近终点', position: { x: -8, z: 0 }, eyeHeight: 1.6 },
    { name: 'VP07-终点前', position: { x: -3, z: -3 }, eyeHeight: 1.6 },
    { name: 'VP08-终点', position: { x: 3, z: -5 }, eyeHeight: 1.6 }
  ]
}
