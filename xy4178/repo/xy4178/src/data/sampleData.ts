import { v4 as uuidv4 } from 'uuid'
import { Segment, Crane, Obstacle, TidalWindow, Keyframe } from '@/types'

export const sampleSegments: Segment[] = [
  {
    id: uuidv4(),
    name: '上层建筑分段-SB01',
    dimensions: {
      length: 20,
      width: 15,
      height: 12
    },
    weight: 180,
    centerOfGravity: { x: 0, y: 0, z: 0 },
    liftingPoints: [
      { x: -8, y: 6, z: -5 },
      { x: 8, y: 6, z: -5 },
      { x: 8, y: 6, z: 5 },
      { x: -8, y: 6, z: 5 }
    ],
    initialPosition: { x: -60, y: 6, z: 0 },
    targetPosition: { x: 25, y: 6, z: 0 },
    color: '#4CAF50',
    notes: '驾驶舱模块，含精密设备'
  }
]

export const sampleCrane: Crane = {
  id: uuidv4(),
  name: '码头吊车-1号',
  position: { x: 0, y: 0, z: 0 },
  maxRadius: 50,
  minRadius: 5,
  maxHeight: 80,
  maxLiftCapacity: 500,
  capacityCurve: [
    { radius: 5, capacity: 500 },
    { radius: 15, capacity: 450 },
    { radius: 25, capacity: 350 },
    { radius: 35, capacity: 250 },
    { radius: 45, capacity: 180 },
    { radius: 50, capacity: 150 }
  ],
  boomLength: 60,
  jibLength: 0,
  slewSpeed: 1,
  hoistSpeed: 0.5,
  color: '#FF9800'
}

export const sampleObstacles: Obstacle[] = [
  {
    id: uuidv4(),
    name: '临时支架-A',
    type: 'temporary_support',
    dimensions: {
      length: 8,
      width: 8,
      height: 4
    },
    position: { x: -30, y: 2, z: 10 },
    rotation: 0,
    isPermanent: false,
    color: '#F44336',
    description: '吊装前需移除的临时支撑结构'
  },
  {
    id: uuidv4(),
    name: '临时支架-B',
    type: 'temporary_support',
    dimensions: {
      length: 6,
      width: 6,
      height: 5
    },
    position: { x: 15, y: 2.5, z: -15 },
    rotation: 0,
    isPermanent: false,
    color: '#F44336',
    description: '位于目标位置附近的临时支架'
  },
  {
    id: uuidv4(),
    name: '转运路线-主通道',
    type: 'transport_route',
    dimensions: {
      length: 80,
      width: 12,
      height: 0.5
    },
    position: { x: -20, y: 0.25, z: -40 },
    rotation: 0,
    isPermanent: true,
    color: '#2196F3',
    description: '主要物料转运通道，吊装时注意避让'
  },
  {
    id: uuidv4(),
    name: '现有结构-码头控制室',
    type: 'existing_structure',
    dimensions: {
      length: 12,
      width: 8,
      height: 15
    },
    position: { x: 50, y: 7.5, z: 30 },
    rotation: 0,
    isPermanent: true,
    color: '#9C27B0',
    description: '码头控制塔，需确保吊臂不会扫到'
  }
]

export const sampleTidalWindows: TidalWindow[] = [
  {
    id: uuidv4(),
    startTime: new Date(Date.now() + 1 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
    minHeight: 5,
    maxHeight: 8,
    safeClearance: 2,
    description: '早间高潮窗口，推荐吊装时段'
  },
  {
    id: uuidv4(),
    startTime: new Date(Date.now() + 13 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 16 * 60 * 60 * 1000),
    minHeight: 5.5,
    maxHeight: 8.5,
    safeClearance: 2,
    description: '晚间高潮窗口，备选吊装时段'
  }
]

export const sampleKeyframes: Keyframe[] = [
  {
    id: uuidv4(),
    timestamp: Date.now() + 1 * 60 * 60 * 1000,
    position: { x: -60, y: 8, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    hookHeight: 25,
    boomAngle: 60,
    radius: 60,
    label: '起吊点'
  },
  {
    id: uuidv4(),
    timestamp: Date.now() + 1 * 60 * 60 * 1000 + 15 * 60 * 1000,
    position: { x: -40, y: 25, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    hookHeight: 35,
    boomAngle: 50,
    radius: 40,
    label: '越过障碍物'
  },
  {
    id: uuidv4(),
    timestamp: Date.now() + 1 * 60 * 60 * 1000 + 30 * 60 * 1000,
    position: { x: 0, y: 30, z: 0 },
    rotation: { x: 0, y: 90, z: 0 },
    hookHeight: 40,
    boomAngle: 45,
    radius: 0,
    label: '回转定位'
  },
  {
    id: uuidv4(),
    timestamp: Date.now() + 1 * 60 * 60 * 1000 + 45 * 60 * 1000,
    position: { x: 25, y: 10, z: 0 },
    rotation: { x: 0, y: 90, z: 0 },
    hookHeight: 25,
    boomAngle: 55,
    radius: 25,
    label: '落位'
  }
]

export const sampleSegmentsCSV = `name,长度,宽度,高度,重量,重心X,重心Y,重心Z,吊点数量,吊点1X,吊点1Y,吊点1Z,吊点2X,吊点2Y,吊点2Z,吊点3X,吊点3Y,吊点3Z,吊点4X,吊点4Y,吊点4Z,初始位置X,初始位置Y,初始位置Z,目标位置X,目标位置Y,目标位置Z,color,备注
上层建筑分段-SB01,20,15,12,180,0,0,0,4,-8,6,-5,8,6,-5,8,6,5,-8,6,5,-60,6,0,25,6,0,#4CAF50,驾驶舱模块，含精密设备
`

export const sampleObstaclesCSV = `name,类型,长度,宽度,高度,位置X,位置Y,位置Z,旋转角度,是否永久,描述
临时支架-A,temporary_support,8,8,4,-30,2,10,0,false,吊装前需移除的临时支撑结构
临时支架-B,temporary_support,6,6,5,15,2.5,-15,0,false,位于目标位置附近的临时支架
转运路线-主通道,transport_route,80,12,0.5,-20,0.25,-40,0,true,主要物料转运通道，吊装时注意避让
现有结构-码头控制室,existing_structure,12,8,15,50,7.5,30,0,true,码头控制塔，需确保吊臂不会扫到
`

export const sampleTidalWindowsCSV = `开始时间,结束时间,最小潮位,最大潮位,安全净空,描述
${new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString()},${new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()},5,8,2,早间高潮窗口，推荐吊装时段
${new Date(Date.now() + 13 * 60 * 60 * 1000).toISOString()},${new Date(Date.now() + 16 * 60 * 60 * 1000).toISOString()},5.5,8.5,2,晚间高潮窗口，备选吊装时段
`

export const sampleCraneCSV = `name,位置X,位置Y,位置Z,最大半径,最小半径,最大高度,最大起重量,吊臂长度,曲线点数,曲线1半径,曲线1能力,曲线2半径,曲线2能力,曲线3半径,曲线3能力,曲线4半径,曲线4能力,曲线5半径,曲线5能力,曲线6半径,曲线6能力
码头吊车-1号,0,0,0,50,5,80,500,60,6,5,500,15,450,25,350,35,250,45,180,50,150
`

export const downloadSampleCSV = (type: 'segments' | 'obstacles' | 'tidal' | 'crane'): void => {
  const csvData = {
    segments: sampleSegmentsCSV,
    obstacles: sampleObstaclesCSV,
    tidal: sampleTidalWindowsCSV,
    crane: sampleCraneCSV
  }
  const filenames = {
    segments: '示例_分段数据.csv',
    obstacles: '示例_障碍物数据.csv',
    tidal: '示例_潮位窗口.csv',
    crane: '示例_吊车参数.csv'
  }
  
  const blob = new Blob([csvData[type]], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filenames[type]
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
