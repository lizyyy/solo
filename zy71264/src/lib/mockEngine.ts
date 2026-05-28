import {
  RackConfig,
  CRACUnit,
  AirflowSample,
  AnomalyItem,
  ParamSet,
  CompareScore,
} from '@/types'

const RACK_WIDTH = 0.8
const RACK_DEPTH = 1.2
const RACK_HEIGHT = 2.5
const AISLE_BASE_GAP = 2
const ROWS = 4
const COLS = 6

function distance3D(a: [number, number, number], b: [number, number, number]) {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function normalize(v: [number, number, number]): [number, number, number] {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
  if (len === 0) return [0, 0, 0]
  return [v[0] / len, v[1] / len, v[2] / len]
}

function dot(a: [number, number, number], b: [number, number, number]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function generateRacksFromParams(
  globalPowerKw: number,
  rows: number,
  cols: number,
  cracs: CRACUnit[]
): RackConfig[] {
  const racks: RackConfig[] = []
  const missingPowerIdx = rows * 2 + 1
  const highPowerIdx = rows * 3 + 2

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col
      const isColdAisle = row % 2 === 0
      const x = col * (RACK_WIDTH + 0.2)
      const z = row * (RACK_DEPTH + AISLE_BASE_GAP)

      let powerKw = globalPowerKw
      if (idx === missingPowerIdx) {
        powerKw = 0
      } else if (idx === highPowerIdx) {
        powerKw = 15
      }

      const pos: [number, number, number] = [x + RACK_WIDTH / 2, RACK_HEIGHT / 2, z + RACK_DEPTH / 2]
      let minDist = Infinity
      for (const crac of cracs) {
        const d = distance3D(pos, crac.position)
        if (d < minDist) minDist = d
      }

      const baseTemp = 22
      const powerFactor = powerKw * 0.6
      const distanceFactor = minDist * 0.4
      const temperature = Math.round((baseTemp + powerFactor + distanceFactor) * 10) / 10

      racks.push({
        id: `rack-${row}-${col}`,
        row,
        col,
        powerKw,
        temperature,
        label: `R${row + 1}-C${col + 1}`,
        isColdAisle,
      })
    }
  }
  return racks
}

export function generateCRACsFromParams(
  globalAirflowCfm: number,
  count: number,
  rows: number,
  cols: number
): CRACUnit[] {
  const cracs: CRACUnit[] = []
  const totalWidth = cols * (RACK_WIDTH + 0.2)
  const totalDepth = rows * (RACK_DEPTH + AISLE_BASE_GAP)

  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 'left' : 'right'
    const zPos = (i / count) * totalDepth + 2
    const xPos = side === 'left' ? -2 : totalWidth + 2
    const direction: [number, number, number] = side === 'left' ? [1, 0.2, 0] : [-1, 0.2, 0]

    cracs.push({
      id: `crac-${i}`,
      position: [xPos, 2, zPos],
      airflowCfm: globalAirflowCfm,
      direction: normalize(direction),
      temperature: 16,
      label: `CRAC-${side.toUpperCase()}-${i + 1}`,
    })
  }
  return cracs
}

export function generateDefaultParamSet(): ParamSet {
  const globalPowerKw = 5
  const globalAirflowCfm = 5000
  const cracUnits = generateCRACsFromParams(globalAirflowCfm, 2, ROWS, COLS)
  const racks = generateRacksFromParams(globalPowerKw, ROWS, COLS, cracUnits)

  return {
    id: 'default',
    name: '默认配置',
    timestamp: Date.now(),
    racks,
    cracUnits,
    aisleGap: AISLE_BASE_GAP,
    floorPerforation: 0.6,
    globalPowerKw,
    globalAirflowCfm,
  }
}

export function computeAirflowSamples(ps: ParamSet): AirflowSample[] {
  const samples: AirflowSample[] = []
  const totalWidth = COLS * (RACK_WIDTH + 0.2)
  const totalDepth = ROWS * (RACK_DEPTH + AISLE_BASE_GAP)
  const maxHeight = 4

  const xSteps = 10
  const zSteps = 8
  const ySteps = 3

  for (let xi = 0; xi <= xSteps; xi++) {
    for (let zi = 0; zi <= zSteps; zi++) {
      for (let yi = 0; yi <= ySteps; yi++) {
        const x = (xi / xSteps) * totalWidth
        const z = (zi / zSteps) * totalDepth
        const y = (yi / ySteps) * maxHeight + 0.5
        const pos: [number, number, number] = [x, y, z]

        let totalVelocity = 0
        let totalDir: [number, number, number] = [0, 0, 0]
        let totalTemp = 0
        let totalWeight = 0

        for (const crac of ps.cracUnits) {
          const d = distance3D(pos, crac.position)
          if (d > 15) continue

          const airflowFactor = crac.airflowCfm / 5000
          const perforationFactor = lerp(0.4, 1, ps.floorPerforation)
          const attenuation = 1 / (1 + d * 0.15)
          const velocity = crac.airflowCfm * attenuation * perforationFactor * 0.0008

          totalVelocity += velocity
          totalDir = [
            totalDir[0] + crac.direction[0] * velocity,
            totalDir[1] + crac.direction[1] * velocity,
            totalDir[2] + crac.direction[2] * velocity,
          ]

          const temp = lerp(crac.temperature, 35, attenuation)
          totalTemp += temp * velocity
          totalWeight += velocity
        }

        for (const rack of ps.racks) {
          const rackX = rack.col * (RACK_WIDTH + 0.2) + RACK_WIDTH / 2
          const rackZ = rack.row * (RACK_DEPTH + ps.aisleGap) + RACK_DEPTH / 2
          const rackPos: [number, number, number] = [rackX, RACK_HEIGHT / 2, rackZ]
          const dRack = distance3D(pos, rackPos)
          if (dRack < 2 && rack.powerKw > 0) {
            const heatFactor = rack.powerKw / 5
            totalTemp += rack.temperature * heatFactor * 0.3
            totalWeight += heatFactor * 0.3
          }
        }

        const avgTemp = totalWeight > 0 ? totalTemp / totalWeight : 24
        const dir = normalize(totalDir)

        const sample: AirflowSample = {
          position: pos,
          velocity: Math.round(totalVelocity * 100) / 100,
          direction: dir,
          temperature: Math.round(avgTemp * 10) / 10,
        }
        samples.push(sample)
      }
    }
  }

  const highPowerRack = ps.racks.find(r => r.powerKw > 12)
  if (highPowerRack) {
    const rackX = highPowerRack.col * (RACK_WIDTH + 0.2) + RACK_WIDTH / 2
    const rackZ = highPowerRack.row * (RACK_DEPTH + ps.aisleGap) + RACK_DEPTH / 2
    for (let i = 0; i < 3; i++) {
      samples.push({
        position: [rackX + (i - 1) * 0.5, 2, rackZ],
        velocity: 3.5 + i * 0.5,
        direction: [-1, 0.1, 0] as [number, number, number],
        temperature: 42 + i * 2,
      })
    }
  }

  return samples
}

export function detectAnomalies(
  ps: ParamSet,
  samples: AirflowSample[]
): AnomalyItem[] {
  const anomalies: AnomalyItem[] = []
  let anomalyId = 0

  for (const crac of ps.cracUnits) {
    for (const sample of samples) {
      const d = distance3D(sample.position, crac.position)
      if (d > 3 && d < 10) {
        const dotProduct = dot(sample.direction, crac.direction)
        if (dotProduct < -0.7 && sample.velocity > 3) {
          const rackNearby = ps.racks.find(r => {
            const rx = r.col * (RACK_WIDTH + 0.2) + RACK_WIDTH / 2
            const rz = r.row * (RACK_DEPTH + ps.aisleGap) + RACK_DEPTH / 2
            return distance3D(sample.position, [rx, RACK_HEIGHT / 2, rz]) < 3
          })

          const severity = sample.velocity > 3 ? 'critical' : 'warning'
          anomalies.push({
            id: `anomaly-${anomalyId++}`,
            type: 'reversed_airflow',
            severity,
            cracId: crac.id,
            rackId: rackNearby?.id,
            position: sample.position,
            description: `${crac.label} 下游检测到反向气流`,
            explanation: `在位置 (${sample.position[0].toFixed(1)}, ${sample.position[1].toFixed(1)}, ${sample.position[2].toFixed(1)}) 气流方向与 ${crac.label} 送风方向相反（点积=${dotProduct.toFixed(2)}）。${
              rackNearby ? `可能由 ${rackNearby.label} 局部热空气回流导致。` : '可能由机柜布局阻挡或相邻机柜排风干扰导致。'
            }`,
          })
        }
      }
    }
  }

  for (const rack of ps.racks) {
    if (rack.powerKw <= 0) {
      const rackX = rack.col * (RACK_WIDTH + 0.2) + RACK_WIDTH / 2
      const rackZ = rack.row * (RACK_DEPTH + ps.aisleGap) + RACK_DEPTH / 2
      anomalies.push({
        id: `anomaly-${anomalyId++}`,
        type: 'missing_power',
        severity: 'warning',
        rackId: rack.id,
        position: [rackX, RACK_HEIGHT / 2, rackZ],
        description: `${rack.label} 功耗数据缺失`,
        explanation: `${rack.label} 功耗读数为 0 kW。可能原因：机柜已下架但配置未更新、PDU通信故障、或传感器未上电。建议：1) 核实该机柜实际运行状态；2) 检查PDU监控连接；3) 若已下架从配置中移除。`,
      })
    }
  }

  for (const rack of ps.racks) {
    if (rack.temperature > 35 && rack.powerKw > 0) {
      const rackX = rack.col * (RACK_WIDTH + 0.2) + RACK_WIDTH / 2
      const rackZ = rack.row * (RACK_DEPTH + ps.aisleGap) + RACK_DEPTH / 2
      const rackPos: [number, number, number] = [rackX, RACK_HEIGHT / 2, rackZ]

      let minCracDist = Infinity
      for (const crac of ps.cracUnits) {
        const d = distance3D(rackPos, crac.position)
        if (d < minCracDist) minCracDist = d
      }

      if (minCracDist > 8) {
        const severity = rack.temperature > 40 ? 'critical' : 'warning'
        const betweenRacks = ps.racks.filter(r => {
          if (r.id === rack.id) return false
          const rx = r.col * (RACK_WIDTH + 0.2) + RACK_WIDTH / 2
          const rz = r.row * (RACK_DEPTH + ps.aisleGap) + RACK_DEPTH / 2
          const midX = (rackX + ps.cracUnits[0].position[0]) / 2
          const midZ = (rackZ + ps.cracUnits[0].position[2]) / 2
          return Math.abs(rx - midX) < 1 && Math.abs(rz - midZ) < 1
        })

        anomalies.push({
          id: `anomaly-${anomalyId++}`,
          type: 'hotspot_occluded',
          severity,
          rackId: rack.id,
          position: rackPos,
          description: `${rack.label} 温度 ${rack.temperature}°C，冷气路径被遮挡`,
          explanation: `${rack.label} 温度 ${rack.temperature}°C 超阈值，距最近 CRAC ${minCracDist.toFixed(1)}m。${
            betweenRacks.length > 0
              ? `气流路径被 ${betweenRacks.map(r => r.label).join('、')} 阻挡，导致送风无法有效到达。`
              : '机柜处于送风死角，地板开孔率不足或通道布局不合理。'
          } 建议：${severity === 'critical' ? '立即' : '择期'}调整机柜布局或增加局部通风。`,
        })
      }
    }
  }

  return anomalies
}

export function computeScore(
  ps: ParamSet,
  anomalies: AnomalyItem[]
): CompareScore {
  const activeRacks = ps.racks.filter(r => r.powerKw > 0)
  const avgTemp = activeRacks.reduce((s, r) => s + r.temperature, 0) / activeRacks.length
  const idealTemp = 22
  const tempDeviation = Math.abs(avgTemp - idealTemp)
  const coolingEfficiency = Math.max(0, 100 - tempDeviation * 4)

  const hotspotCount = activeRacks.filter(r => r.temperature > 30).length
  const hotspotScore = Math.max(0, 100 - hotspotCount * 12)

  const avgVelocity =
    ps.racks.length > 0
      ? activeRacks.reduce((s, r) => {
          const rx = r.col * (RACK_WIDTH + 0.2) + RACK_WIDTH / 2
          const rz = r.row * (RACK_DEPTH + ps.aisleGap) + RACK_DEPTH / 2
          let minD = Infinity
          for (const crac of ps.cracUnits) {
            const d = distance3D([rx, RACK_HEIGHT / 2, rz], crac.position)
            if (d < minD) minD = d
          }
          return s + minD
        }, 0) / activeRacks.length
      : 0

  const targetVelocity = 5
  let airflowUtilization = Math.max(0, 100 - Math.abs(avgVelocity - targetVelocity) * 8)
  airflowUtilization *= lerp(0.5, 1, ps.floorPerforation)

  const criticalAnomalies = anomalies.filter(a => a.severity === 'critical').length
  const warningAnomalies = anomalies.filter(a => a.severity === 'warning').length
  const penalty = criticalAnomalies * 8 + warningAnomalies * 3

  const overallScore = Math.max(
    0,
    Math.round(
      coolingEfficiency * 0.4 + hotspotScore * 0.35 + airflowUtilization * 0.25 - penalty
    )
  )

  const details = `
冷却效率：${coolingEfficiency.toFixed(1)} / 100
  - 平均机柜温度：${avgTemp.toFixed(1)}°C（理想 ${idealTemp}°C，偏差 ${tempDeviation.toFixed(1)}°C）

热点控制：${hotspotScore.toFixed(1)} / 100
  - 超温机柜（>30°C）：${hotspotCount} 台，每台扣 12 分

风量利用率：${airflowUtilization.toFixed(1)} / 100
  - 机柜平均距CRAC：${avgVelocity.toFixed(1)}m
  - 地板开孔率加成：${(ps.floorPerforation * 100).toFixed(0)}%

异常扣分：-${penalty}
  - 严重异常：${criticalAnomalies} 项 × 8
  - 警告异常：${warningAnomalies} 项 × 3

综合评分：${overallScore} / 100
  `.trim()

  return {
    coolingEfficiency: Math.round(coolingEfficiency * 10) / 10,
    hotspotCount,
    airflowUtilization: Math.round(airflowUtilization * 10) / 10,
    overallScore,
    details,
  }
}
