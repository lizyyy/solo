export const OptionStatus = {
  PENDING: 'pending',
  NORMAL: 'normal',
  WARNING: 'warning',
  ANOMALY: 'anomaly',
  REVOKED: 'revoked'
}

export const StatusFlow = [
  { key: 'imported', label: '已导入' },
  { key: 'interpolated', label: '已插值' },
  { key: 'verified', label: '已校验' },
  { key: 'published', label: '已发布' }
]

export function createOptionRecord(data) {
  const now = Date.now()
  return {
    id: data.id || `OPT_${now}_${Math.random().toString(36).slice(2, 8)}`,
    contractCode: data.contractCode,
    underlying: data.underlying || '510300',
    strikePrice: Number(data.strikePrice),
    expiryDate: data.expiryDate,
    expiryDays: Number(data.expiryDays) || calcExpiryDays(data.expiryDate),
    iv: Number(data.iv),
    volume: Number(data.volume) || 0,
    openInterest: Number(data.openInterest) || 0,
    status: OptionStatus.PENDING,
    isInterpolated: !!data.isInterpolated,
    anomalyScore: 0,
    anomalyReason: null,
    statusFlow: ['imported'],
    createdAt: data.createdAt || now,
    updatedAt: now,
    history: data.history || []
  }
}

function calcExpiryDays(expiryDate) {
  if (!expiryDate) return 30
  const exp = new Date(expiryDate)
  const now = new Date()
  return Math.max(1, Math.ceil((exp - now) / (1000 * 60 * 60 * 24)))
}

export function detectAnomaly(record, allRecords) {
  const sameStrike = allRecords.filter(r => 
    r.strikePrice === record.strikePrice && r.status !== OptionStatus.REVOKED
  )
  const sameExpiry = allRecords.filter(r => 
    r.expiryDays === record.expiryDays && r.status !== OptionStatus.REVOKED
  )
  
  let score = 0
  const reasons = []
  
  if (sameExpiry.length >= 3) {
    const ivs = sameExpiry.map(r => r.iv).sort((a, b) => a - b)
    const q1 = ivs[Math.floor(ivs.length * 0.25)]
    const q3 = ivs[Math.floor(ivs.length * 0.75)]
    const iqr = q3 - q1
    const upper = q3 + 1.5 * iqr
    const lower = q1 - 1.5 * iqr
    
    if (record.iv > upper || record.iv < lower) {
      score += 50
      reasons.push('IV偏离同到期四分位区间')
    }
  }
  
  if (sameStrike.length >= 2) {
    const avgIv = sameStrike.reduce((s, r) => s + r.iv, 0) / sameStrike.length
    const deviation = Math.abs(record.iv - avgIv) / avgIv
    if (deviation > 0.3) {
      score += 30
      reasons.push(`IV偏离同行权价均值${(deviation * 100).toFixed(1)}%`)
    }
  }
  
  if (record.iv < 0.01 || record.iv > 2.0) {
    score += 40
    reasons.push('IV数值超出合理范围')
  }
  
  if (record.expiryDays <= 0 || record.expiryDays > 730) {
    score += 20
    reasons.push('到期日异常')
  }
  
  return {
    score,
    reasons,
    status: score >= 60 ? OptionStatus.ANOMALY : 
            score >= 30 ? OptionStatus.WARNING : 
            OptionStatus.NORMAL
  }
}

export function bilinearInterpolate(points, x, y) {
  const sorted = [...points].sort((a, b) => {
    const dx = Math.abs(a.x - x) - Math.abs(b.x - x)
    if (dx !== 0) return dx
    return Math.abs(a.y - y) - Math.abs(b.y - y)
  })
  
  if (sorted.length < 3) return null
  
  const neighbors = sorted.slice(0, 4)
  const distances = neighbors.map(p => Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2))
  const maxDist = Math.max(...distances) || 1
  
  if (maxDist > 0.3) return null
  
  const weights = distances.map(d => 1 / (d + 0.001))
  const weightSum = weights.reduce((a, b) => a + b, 0)
  
  const interpolatedValue = neighbors.reduce((sum, p, i) => {
    return sum + p.value * (weights[i] / weightSum)
  }, 0)
  
  return interpolatedValue
}

export function generateSurfaceGrid(options, gridSize = 20) {
  if (!options || options.length === 0) return null
  
  const validOptions = options.filter(o => o.status !== OptionStatus.REVOKED)
  if (validOptions.length === 0) return null
  
  const strikes = [...new Set(validOptions.map(o => o.strikePrice))].sort((a, b) => a - b)
  const expiries = [...new Set(validOptions.map(o => o.expiryDays))].sort((a, b) => a - b)
  
  if (strikes.length < 2 || expiries.length < 2) return null
  
  const minStrike = strikes[0]
  const maxStrike = strikes[strikes.length - 1]
  const minExpiry = expiries[0]
  const maxExpiry = expiries[expiries.length - 1]
  
  const rangeStrike = maxStrike - minStrike || 1
  const rangeExpiry = maxExpiry - minExpiry || 1
  
  const points = validOptions.map(o => ({
    x: (o.expiryDays - minExpiry) / rangeExpiry,
    y: (o.strikePrice - minStrike) / rangeStrike,
    value: o.iv,
    raw: o
  }))
  
  const grid = []
  const anomalies = []
  const gridStrikes = []
  const gridExpiries = []
  
  for (let i = 0; i < gridSize; i++) {
    gridExpiries.push(minExpiry + (i / (gridSize - 1)) * rangeExpiry)
  }
  for (let j = 0; j < gridSize; j++) {
    gridStrikes.push(minStrike + (j / (gridSize - 1)) * rangeStrike)
  }
  
  for (let i = 0; i < gridSize; i++) {
    const row = []
    const normX = i / (gridSize - 1)
    const expiry = gridExpiries[i]
    
    for (let j = 0; j < gridSize; j++) {
      const normY = j / (gridSize - 1)
      const strike = gridStrikes[j]
      
      const exactPoint = validOptions.find(o => 
        Math.abs(o.strikePrice - strike) < 0.01 && Math.abs(o.expiryDays - expiry) < 0.5
      )
      
      let iv, isInterpolated, source
      
      if (exactPoint) {
        iv = exactPoint.iv
        isInterpolated = false
        source = exactPoint
        
        if (exactPoint.status === OptionStatus.ANOMALY || exactPoint.status === OptionStatus.WARNING) {
          anomalies.push({
            x: normX,
            y: normY,
            iv,
            strike,
            expiry,
            record: exactPoint
          })
        }
      } else {
        iv = bilinearInterpolate(points, normX, normY)
        isInterpolated = true
        source = null
        
        if (iv === null) {
          iv = findNearestIV(points, normX, normY)
        }
      }
      
      row.push({
        iv: iv || 0.2,
        isInterpolated,
        source,
        strike,
        expiry,
        normX,
        normY
      })
    }
    grid.push(row)
  }
  
  return {
    grid,
    anomalies,
    strikes: gridStrikes,
    expiries: gridExpiries,
    minStrike,
    maxStrike,
    minExpiry,
    maxExpiry,
    rangeStrike,
    rangeExpiry,
    rawPoints: points
  }
}

function findNearestIV(points, x, y) {
  let minDist = Infinity
  let nearest = 0.2
  
  for (const p of points) {
    const dist = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2)
    if (dist < minDist) {
      minDist = dist
      nearest = p.value
    }
  }
  
  return nearest
}
