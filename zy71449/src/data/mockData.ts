import type { TyphoonEvent, TyphoonPathPoint, Region, Policy, Claim } from '@/types'

export const typhoonEvents: TyphoonEvent[] = [
  {
    id: 'ty-mangkhut-2018',
    name: '山竹 (Mangkhut)',
    category: 'Super Typhoon',
    startDate: '2018-09-11T00:00:00Z',
    endDate: '2018-09-17T00:00:00Z',
  },
  {
    id: 'ty-hato-2017',
    name: '天鸽 (Hato)',
    category: 'Typhoon',
    startDate: '2017-08-19T00:00:00Z',
    endDate: '2017-08-24T00:00:00Z',
  },
  {
    id: 'ty-mangkhut-revisit',
    name: '山竹复盘 (Mangkhut Revisit)',
    category: 'Post-Event Analysis',
    startDate: '2018-09-14T00:00:00Z',
    endDate: '2018-09-18T00:00:00Z',
  },
]

export const typhoonPathPoints: TyphoonPathPoint[] = (() => {
  const points: TyphoonPathPoint[] = []
  const baseDate = new Date('2018-09-11T00:00:00Z')

  for (let i = 0; i < 30; i++) {
    const t = i / 29
    const lat = 14 + t * 20 + Math.sin(t * Math.PI * 2) * 2
    const lon = 135 - t * 10 + Math.cos(t * Math.PI * 3) * 1.5
    const windSpeed = 80 + Math.sin(t * Math.PI) * 100
    const pressure = 920 + Math.sin(t * Math.PI) * 40

    points.push({
      id: `tp-mangkhut-${i}`,
      typhoonId: 'ty-mangkhut-2018',
      latitude: Math.round(lat * 100) / 100,
      longitude: Math.round(lon * 100) / 100,
      timestamp: new Date(baseDate.getTime() + i * 6 * 3600 * 1000).toISOString(),
      windSpeed: Math.round(windSpeed),
      pressure: Math.round(pressure),
    })
  }

  const baseDate2 = new Date('2017-08-19T00:00:00Z')
  for (let i = 0; i < 20; i++) {
    const t = i / 19
    const lat = 15 + t * 16 + Math.sin(t * Math.PI * 2) * 1.5
    const lon = 128 - t * 8 + Math.cos(t * Math.PI * 2) * 1
    const windSpeed = 60 + Math.sin(t * Math.PI) * 80
    const pressure = 940 + Math.sin(t * Math.PI) * 30

    points.push({
      id: `tp-hato-${i}`,
      typhoonId: 'ty-hato-2017',
      latitude: Math.round(lat * 100) / 100,
      longitude: Math.round(lon * 100) / 100,
      timestamp: new Date(baseDate2.getTime() + i * 6 * 3600 * 1000).toISOString(),
      windSpeed: Math.round(windSpeed),
      pressure: Math.round(pressure),
    })
  }

  const misalignDate = new Date('2018-09-10T00:00:00Z')
  for (let i = 0; i < 10; i++) {
    const t = i / 9
    points.push({
      id: `tp-revisit-${i}`,
      typhoonId: 'ty-mangkhut-revisit',
      latitude: Math.round((18 + t * 8) * 100) / 100,
      longitude: Math.round((125 - t * 5) * 100) / 100,
      timestamp: new Date(misalignDate.getTime() + i * 8 * 3600 * 1000).toISOString(),
      windSpeed: Math.round(70 + t * 60),
      pressure: Math.round(960 - t * 30),
    })
  }

  return points
})()

export const regions: Region[] = [
  { id: 'reg-gd', name: '广东', code: 'GD', latitude: 23.13, longitude: 113.26 },
  { id: 'reg-gx', name: '广西', code: 'GX', latitude: 22.82, longitude: 108.37 },
  { id: 'reg-hn', name: '海南', code: 'HN', latitude: 20.02, longitude: 110.35 },
  { id: 'reg-fj', name: '福建', code: 'FJ', latitude: 26.07, longitude: 119.30 },
  { id: 'reg-zj', name: '浙江', code: 'ZJ', latitude: 30.27, longitude: 120.15 },
  { id: 'reg-sh', name: '上海', code: 'SH', latitude: 31.23, longitude: 121.47 },
  { id: 'reg-js', name: '江苏', code: 'JS', latitude: 32.06, longitude: 118.80 },
  { id: 'reg-tw', name: '台湾', code: 'TW', latitude: 23.70, longitude: 120.96 },
]

export const policies: Policy[] = (() => {
  const list: Policy[] = []
  const types = ['property', 'cargo', 'business_interruption', 'engineering']
  const typhoonIds = ['ty-mangkhut-2018', 'ty-hato-2017', 'ty-mangkhut-revisit']
  const regionIds = regions.map(r => r.id)

  let id = 0
  for (const tyId of typhoonIds) {
    for (const rId of regionIds) {
      const count = 5 + Math.floor(Math.random() * 8)
      for (let i = 0; i < count; i++) {
        id++
        list.push({
          id: `pol-${String(id).padStart(4, '0')}`,
          regionId: rId,
          typhoonId: tyId,
          insuredAmount: Math.round((500000 + Math.random() * 9500000) / 10000) * 10000,
          premium: Math.round((5000 + Math.random() * 95000) / 100) * 100,
          effectiveDate: '2018-01-01T00:00:00Z',
          policyType: types[Math.floor(Math.random() * types.length)],
        })
      }
    }
  }

  return list
})()

export const claims: Claim[] = (() => {
  const list: Claim[] = []
  const typhoonIds = ['ty-mangkhut-2018', 'ty-hato-2017', 'ty-mangkhut-revisit']
  const regionIds = regions.map(r => r.id)
  const statuses = ['settled', 'pending', 'rejected']
  const sources = ['direct_report', 'adjuster_assessment', 'satellite_estimate', 'agency_submission']

  let id = 0
  for (const tyId of typhoonIds) {
    for (const rId of regionIds) {
      const count = 3 + Math.floor(Math.random() * 6)
      for (let i = 0; i < count; i++) {
        id++
        const isExtreme = Math.random() < 0.08
        const baseAmount = 100000 + Math.random() * 2000000
        const claimAmount = isExtreme
          ? Math.round((baseAmount * 5) / 10000) * 10000
          : Math.round(baseAmount / 10000) * 10000

        const tyEvent = typhoonEvents.find(e => e.id === tyId)
        const startMs = new Date(tyEvent!.startDate).getTime()
        const endMs = new Date(tyEvent!.endDate).getTime()
        const isMisaligned = Math.random() < 0.05
        const claimTime = isMisaligned
          ? startMs - 2 * 86400000 + Math.random() * 86400000
          : startMs + Math.random() * (endMs - startMs)

        list.push({
          id: `clm-${String(id).padStart(4, '0')}`,
          policyId: `pol-${String(Math.floor(Math.random() * 80) + 1).padStart(4, '0')}`,
          regionId: rId,
          typhoonId: tyId,
          claimAmount,
          claimDate: new Date(claimTime).toISOString(),
          claimStatus: statuses[Math.floor(Math.random() * statuses.length)],
          source: sources[Math.floor(Math.random() * sources.length)],
        })
      }
    }
  }

  return list
})()
