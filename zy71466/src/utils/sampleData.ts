import type { TensileCurve } from '@/types'

function generateStressStrain(fractureType: string, isAnomaly: boolean): { strain: number[]; stress: number[] } {
  const n = 80 + Math.floor(Math.random() * 40)
  const strain: number[] = []
  const stress: number[] = []

  const baseStrength = 200 + Math.random() * 300
  const anomalyFactor = isAnomaly ? 0.6 + Math.random() * 0.3 : 0.9 + Math.random() * 0.2

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    strain.push(Math.round(t * (5 + Math.random()) * 1000) / 1000)

    let s: number
    if (fractureType === '脆性断裂') {
      s = baseStrength * anomalyFactor * (t < 0.85 ? t / 0.85 * (1 + 0.02 * Math.sin(t * 20)) : (1 - (t - 0.85) / 0.15 * 0.8))
    } else if (fractureType === '延性断裂') {
      s = baseStrength * anomalyFactor * (1 - Math.exp(-5 * t)) * (1 + 0.01 * Math.sin(t * 15))
      if (t > 0.7) s *= 1 - (t - 0.7) / 0.3 * 0.4
    } else if (fractureType === '疲劳断裂') {
      s = baseStrength * anomalyFactor * Math.sin(t * Math.PI * 0.5) * (1 - t * 0.3)
      s += (Math.random() - 0.5) * baseStrength * 0.05
    } else {
      s = baseStrength * anomalyFactor * (1 - (1 - t) ** 2)
    }

    stress.push(Math.max(0, Math.round(s * 100) / 100))
  }

  return { strain, stress }
}

export function generateSampleData(): TensileCurve[] {
  const batches = ['B-2024-01', 'B-2024-02', 'B-2024-03', 'B-2024-04']
  const devices = ['DEV-A01', 'DEV-A02', 'DEV-B01', 'DEV-B03']
  const fractureTypes = ['脆性断裂', '延性断裂', '疲劳断裂', '混合断裂']
  const curves: TensileCurve[] = []

  let id = 1
  batches.forEach((batchNo, bi) => {
    const deviceIdx = bi < 2 ? bi : bi + 1
    const primaryDevice = devices[deviceIdx % devices.length]

    for (let s = 0; s < 8; s++) {
      const isAnomaly = Math.random() < 0.25
      const fractureType = isAnomaly
        ? fractureTypes[Math.floor(Math.random() * fractureTypes.length)]
        : fractureTypes[bi % fractureTypes.length]

      const device = Math.random() < 0.15
        ? devices[Math.floor(Math.random() * devices.length)]
        : primaryDevice

      const { strain, stress } = generateStressStrain(fractureType, isAnomaly)

      curves.push({
        id: `C-${String(id).padStart(3, '0')}`,
        sampleId: `S-${batchNo}-${String(s + 1).padStart(2, '0')}`,
        batchNo,
        deviceId: device,
        strain,
        stress,
        fractureType,
        isAnomaly,
      })
      id++
    }
  })

  return curves
}
