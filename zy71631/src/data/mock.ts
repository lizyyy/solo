import type {
  Seat,
  Speaker,
  SeatMeasurement,
  Anomaly,
  AudienceZone,
  FrequencyBand,
} from '@/types'
import { FREQUENCY_BANDS } from '@/types'

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T']
const SEATS_PER_ROW = 10

function generateZones(): AudienceZone[] {
  return [
    { id: 'zone-vip', name: 'VIP贵宾区', color: '#e6b422' },
    { id: 'zone-a', name: 'A类观众区', color: '#58A6FF' },
    { id: 'zone-b', name: 'B类观众区', color: '#7ee787' },
    { id: 'zone-c', name: 'C类观众区', color: '#d2a8ff' },
  ]
}

function getZoneForRow(rowIndex: number): string {
  if (rowIndex < 4) return 'zone-vip'
  if (rowIndex < 8) return 'zone-a'
  if (rowIndex < 12) return 'zone-b'
  return 'zone-c'
}

function generateSeats(): Seat[] {
  const seats: Seat[] = []
  const theaterWidth = 16
  const theaterDepth = 10
  const rowSpacing = 1.1
  const seatSpacing = theaterWidth / (SEATS_PER_ROW + 1)

  for (let r = 0; r < ROWS.length; r++) {
    const z = -4 - r * rowSpacing
    const rowY = r * 0.45
    const curveFactor = Math.sin((r / ROWS.length) * Math.PI) * 0.5

    for (let s = 0; s < SEATS_PER_ROW; s++) {
      const x = (s - (SEATS_PER_ROW - 1) / 2) * seatSpacing
      const curvedX = x + curveFactor * x * 0.3

      seats.push({
        id: `seat-${ROWS[r]}-${s + 1}`,
        rowLabel: ROWS[r],
        seatNumber: s + 1,
        x: curvedX,
        y: rowY,
        z: z + (Math.random() - 0.5) * 0.05,
        zoneId: getZoneForRow(r),
      })
    }
  }

  return seats
}

function generateSpeakers(): Speaker[] {
  return [
    { id: 'spk-main-l1', label: '主阵列L-1', x: -5.8, y: 5.2, z: -3.8, rotationY: Math.PI * 0.15, model: 'LA112', delayMs: 0, zoneId: 'stage' },
    { id: 'spk-main-l2', label: '主阵列L-2', x: -4.2, y: 6.0, z: -3.8, rotationY: Math.PI * 0.08, model: 'LA112', delayMs: 0, zoneId: 'stage' },
    { id: 'spk-main-r1', label: '主阵列R-1', x: 5.8, y: 5.2, z: -3.8, rotationY: -Math.PI * 0.15, model: 'LA112', delayMs: 0, zoneId: 'stage' },
    { id: 'spk-main-r2', label: '主阵列R-2', x: 4.2, y: 6.0, z: -3.8, rotationY: -Math.PI * 0.08, model: 'LA112', delayMs: 0, zoneId: 'stage' },
    { id: 'spk-delay-l', label: '延时塔L', x: -5.2, y: 7.5, z: -10, rotationY: Math.PI * 0.05, model: 'LA108', delayMs: 28, zoneId: 'zone-b' },
    { id: 'spk-delay-r', label: '延时塔R', x: 5.2, y: 7.5, z: -10, rotationY: -Math.PI * 0.05, model: 'LA108', delayMs: 15, zoneId: 'zone-b' },
    { id: 'spk-sub-l', label: '超低L', x: -3.2, y: 0.6, z: -3.2, rotationY: 0, model: 'KS21', delayMs: 0, zoneId: 'stage' },
    { id: 'spk-sub-r', label: '超低R', x: 3.2, y: 0.6, z: -3.2, rotationY: 0, model: 'KS21', delayMs: 0, zoneId: 'stage' },
  ]
}

function calculateDistance(seat: Seat, speaker: Speaker): number {
  const dx = seat.x - speaker.x
  const dy = seat.y - speaker.y
  const dz = seat.z - speaker.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function calculateBaseSPL(seat: Seat, speakers: Speaker[]): number {
  let totalEnergy = 0
  for (const spk of speakers) {
    const dist = calculateDistance(seat, spk)
    if (dist < 0.5) continue
    const attenuation = 20 * Math.log10(dist / 1)
    const baseSPL = 110 - attenuation
    totalEnergy += Math.pow(10, baseSPL / 20)
  }
  return 20 * Math.log10(totalEnergy)
}

function getFreqAdjustment(band: FrequencyBand, dist: number, rowIndex: number): number {
  const bandIndex = FREQUENCY_BANDS.indexOf(band)
  
  if (bandIndex <= 2) {
    return -2 + Math.random() * 4
  } else if (bandIndex <= 4) {
    return -1 + Math.random() * 3
  } else if (bandIndex <= 6) {
    const airAbsorption = dist * 0.15
    return -2 - airAbsorption + Math.random() * 3
  } else {
    const airAbsorption = dist * 0.35
    const rowDamping = rowIndex > 10 ? -3 : 0
    return -3 - airAbsorption + rowDamping + Math.random() * 2
  }
}

function getDataSource(seatIndex: number): string {
  const rand = Math.random()
  if (rand < 0.4) return '模拟计算'
  if (rand < 0.8) return '现场测量-A设备'
  return '手动输入'
}

function getMeasurementTime(): string {
  const now = Date.now()
  const offset = Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
  return new Date(now - offset).toISOString()
}

function generateMeasurements(seats: Seat[], speakers: Speaker[]): SeatMeasurement[] {
  const measurements: SeatMeasurement[] = []
  const occlusionSeats = new Set(['seat-C-10', 'seat-C-9', 'seat-D-1', 'seat-D-2', 'seat-H-5', 'seat-H-6'])

  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i]
    const dist = calculateDistance(seat, speakers[0])
    const rowIndex = ROWS.indexOf(seat.rowLabel)

    for (const band of FREQUENCY_BANDS) {
      let baseSPL = calculateBaseSPL(seat, speakers)
      baseSPL += getFreqAdjustment(band, dist, rowIndex)

      if (occlusionSeats.has(seat.id) && FREQUENCY_BANDS.indexOf(band) >= 5) {
        baseSPL -= 4 + Math.random() * 8
      }

      if (rowIndex >= 12 && FREQUENCY_BANDS.indexOf(band) >= 7) {
        baseSPL -= 2 + Math.random() * 4
      }

      baseSPL = Math.max(45, Math.min(105, baseSPL))

      measurements.push({
        seatId: seat.id,
        frequencyBand: band,
        splDB: Math.round(baseSPL * 10) / 10,
        dataSource: getDataSource(i),
        measuredAt: getMeasurementTime(),
      })
    }
  }

  return measurements
}

function generateAnomalies(
  seats: Seat[],
  speakers: Speaker[],
  measurements: SeatMeasurement[],
): Anomaly[] {
  const anomalies: Anomaly[] = []
  let anomalyId = 0

  for (const seat of seats) {
    const seatMeasurements = measurements.filter((m) => m.seatId === seat.id)
    seatMeasurements.sort(
      (a, b) => FREQUENCY_BANDS.indexOf(a.frequencyBand as FrequencyBand) - FREQUENCY_BANDS.indexOf(b.frequencyBand as FrequencyBand),
    )

    for (let i = 0; i < seatMeasurements.length - 1; i++) {
      const diff = Math.abs(seatMeasurements[i + 1].splDB - seatMeasurements[i].splDB)
      if (diff > 12) {
        anomalies.push({
          id: `anomaly-${++anomalyId}`,
          type: 'frequency_mismatch',
          severity: diff > 18 ? 'error' : 'warning',
          message: `座位${seat.rowLabel}${seat.seatNumber}在${seatMeasurements[i].frequencyBand}与${seatMeasurements[i + 1].frequencyBand}之间声压差${diff.toFixed(1)}dB，频段过渡异常`,
          seatId: seat.id,
          frequencyBand: seatMeasurements[i + 1].frequencyBand,
          dataSource: '自动检测',
        })
      }
    }

    const midBand = seatMeasurements.find((m) => m.frequencyBand === '2kHz')
    const lowBand = seatMeasurements.find((m) => m.frequencyBand === '125Hz')
    if (midBand && lowBand) {
      const drop = lowBand.splDB - midBand.splDB
      if (drop > 8) {
        anomalies.push({
          id: `anomaly-${++anomalyId}`,
          type: 'seat_occlusion',
          severity: 'error',
          message: `座位${seat.rowLabel}${seat.seatNumber}被前排遮挡，2kHz相对于125Hz衰减${drop.toFixed(1)}dB，高频能量损失明显`,
          seatId: seat.id,
          frequencyBand: '2kHz',
          dataSource: '自动检测',
        })
      }
    }
  }

  const mainSpeakers = speakers.filter((s) => s.id.includes('main'))
  const delaySpeakers = speakers.filter((s) => s.id.includes('delay'))

  for (const main of mainSpeakers) {
    for (const delay of delaySpeakers) {
      if (delay.delayMs < main.delayMs + 10) {
        anomalies.push({
          id: `anomaly-${++anomalyId}`,
          type: 'delay_inversion',
          severity: 'error',
          message: `${delay.label}的延时(${delay.delayMs}ms)小于${main.label}(${main.delayMs}ms)，存在延时反向风险，可能导致声音抵消`,
          speakerId: delay.id,
          frequencyBand: '500Hz',
          dataSource: '自动检测',
        })
      }
    }
  }

  return anomalies
}

export function generateAllData(): {
  seats: Seat[]
  speakers: Speaker[]
  measurements: SeatMeasurement[]
  anomalies: Anomaly[]
  zones: AudienceZone[]
} {
  const zones = generateZones()
  const seats = generateSeats()
  const speakers = generateSpeakers()
  const measurements = generateMeasurements(seats, speakers)
  const anomalies = generateAnomalies(seats, speakers, measurements)

  return { seats, speakers, measurements, anomalies, zones }
}
