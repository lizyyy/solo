import type {
  TestRound,
  AnalysisResult,
  DragCoefficientDrift,
  ResonanceWindow,
  CalibrationAlert,
  AnomalySpike,
  RiskItem
} from '@/types'

function generateId(): string {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

function calculateDragCoefficient(
  force: number,
  windSpeed: number,
  airDensity: number,
  referenceArea: number
): number {
  if (windSpeed === 0 || referenceArea === 0) return 0
  const dynamicPressure = 0.5 * airDensity * windSpeed * windSpeed
  return force / (dynamicPressure * referenceArea)
}

function calculateStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1))
}

function getSeverity(percentage: number): 'low' | 'medium' | 'high' {
  if (percentage >= 10) return 'high'
  if (percentage >= 5) return 'medium'
  return 'low'
}

export function detectDragCoefficientDrift(
  testRound: TestRound,
  baselineWindowSize: number = 50,
  driftThresholdPercentage: number = 5
): DragCoefficientDrift[] {
  const drifts: DragCoefficientDrift[] = []
  const { forceData, windSpeedProfile, airDensity, referenceArea } = testRound
  
  if (forceData.length === 0 || windSpeedProfile.length === 0) {
    return drifts
  }

  const cdValues: { timestamp: number; cd: number; windSpeed: number }[] = []
  
  for (const forcePoint of forceData) {
    const closestWindPoint = windSpeedProfile.reduce((prev, curr) => {
      return Math.abs(curr.timestamp - forcePoint.timestamp) < Math.abs(prev.timestamp - forcePoint.timestamp)
        ? curr : prev
    })
    
    const cd = calculateDragCoefficient(
      forcePoint.fz,
      closestWindPoint.speed,
      airDensity,
      referenceArea
    )
    
    cdValues.push({
      timestamp: forcePoint.timestamp,
      cd,
      windSpeed: closestWindPoint.speed
    })
  }

  if (cdValues.length < baselineWindowSize * 2) {
    return drifts
  }

  const baselineValues = cdValues.slice(0, baselineWindowSize).map(v => v.cd)
  const baselineMean = baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length
  const baselineStd = calculateStandardDeviation(baselineValues)

  const windowSize = Math.floor(baselineWindowSize / 2)
  
  for (let i = baselineWindowSize; i < cdValues.length - windowSize; i += Math.floor(windowSize / 2)) {
    const windowValues = cdValues.slice(i, i + windowSize)
    const windowMean = windowValues.map(v => v.cd).reduce((a, b) => a + b, 0) / windowValues.length
    
    const driftAmount = windowMean - baselineMean
    const driftPercentage = Math.abs(driftAmount / baselineMean) * 100
    
    if (driftPercentage >= driftThresholdPercentage) {
      drifts.push({
        id: generateId(),
        testRoundId: testRound.id,
        driftAmount,
        driftPercentage,
        baselineValue: baselineMean,
        currentValue: windowMean,
        startTime: windowValues[0].timestamp,
        endTime: windowValues[windowValues.length - 1].timestamp,
        severity: getSeverity(driftPercentage),
        isRejected: false
      })
    }
  }

  return drifts.sort((a, b) => b.driftPercentage - a.driftPercentage)
}

export function detectResonanceWindows(
  testRound: TestRound,
  supportNaturalFrequency: number = 0,
  frequencyBandwidth: number = 2
): ResonanceWindow[] {
  const windows: ResonanceWindow[] = []
  const { forceData, windSpeedProfile } = testRound
  
  if (forceData.length < 100) {
    return windows
  }

  const fzValues = forceData.map(f => f.fz)
  const sampleRate = calculateSampleRate(forceData)
  
  if (sampleRate <= 0) {
    return windows
  }

  const windowSize = Math.min(1024, Math.pow(2, Math.floor(Math.log2(forceData.length))))
  const stepSize = Math.floor(windowSize / 2)

  for (let i = 0; i < forceData.length - windowSize; i += stepSize) {
    const windowData = fzValues.slice(i, i + windowSize)
    const spectrum = performFFT(windowData, sampleRate)
    
    let resonanceDetected = false
    let maxAmplitude = 0
    let resonanceFreqStart = 0
    let resonanceFreqEnd = 0

    for (let j = 0; j < spectrum.frequencies.length; j++) {
      const freq = spectrum.frequencies[j]
      const amp = spectrum.amplitudes[j]
      
      if (supportNaturalFrequency > 0) {
        if (Math.abs(freq - supportNaturalFrequency) <= frequencyBandwidth && amp > 0.1) {
          resonanceDetected = true
          if (amp > maxAmplitude) {
            maxAmplitude = amp
            resonanceFreqStart = freq - frequencyBandwidth
            resonanceFreqEnd = freq + frequencyBandwidth
          }
        }
      } else {
        if (amp > 0.3) {
          resonanceDetected = true
          if (amp > maxAmplitude) {
            maxAmplitude = amp
            resonanceFreqStart = freq - 1
            resonanceFreqEnd = freq + 1
          }
        }
      }
    }

    if (resonanceDetected) {
      const windowForceData = forceData.slice(i, i + windowSize)
      const startTimestamp = windowForceData[0].timestamp
      const endTimestamp = windowForceData[windowForceData.length - 1].timestamp
      
      const relevantWindSpeeds = windSpeedProfile.filter(
        w => w.timestamp >= startTimestamp && w.timestamp <= endTimestamp
      )
      
      const windSpeedMin = relevantWindSpeeds.length > 0
        ? Math.min(...relevantWindSpeeds.map(w => w.speed))
        : 0
      const windSpeedMax = relevantWindSpeeds.length > 0
        ? Math.max(...relevantWindSpeeds.map(w => w.speed))
        : 0

      const severity: 'low' | 'medium' | 'high' = maxAmplitude > 0.5 ? 'high' : maxAmplitude > 0.3 ? 'medium' : 'low'

      windows.push({
        id: generateId(),
        testRoundId: testRound.id,
        frequencyStart: resonanceFreqStart,
        frequencyEnd: resonanceFreqEnd,
        amplitude: maxAmplitude,
        windSpeedRange: { min: windSpeedMin, max: windSpeedMax },
        confidence: maxAmplitude,
        severity,
        isRejected: false
      })
    }
  }

  return windows.sort((a, b) => b.amplitude - a.amplitude)
}

function calculateSampleRate(data: { timestamp: number }[]): number {
  if (data.length < 2) return 0
  let totalDiff = 0
  for (let i = 1; i < data.length; i++) {
    totalDiff += data[i].timestamp - data[i - 1].timestamp
  }
  const avgDiff = totalDiff / (data.length - 1)
  return avgDiff > 0 ? 1000 / avgDiff : 0
}

function performFFT(data: number[], sampleRate: number): { frequencies: number[]; amplitudes: number[] } {
  const n = data.length
  const frequencies: number[] = []
  const amplitudes: number[] = []
  
  const mean = data.reduce((a, b) => a + b, 0) / n
  const normalized = data.map(v => v - mean)
  
  const maxFreq = sampleRate / 2
  const freqStep = sampleRate / n
  
  for (let k = 0; k < n / 2; k++) {
    let real = 0
    let imag = 0
    
    for (let t = 0; t < n; t++) {
      const angle = -2 * Math.PI * k * t / n
      real += normalized[t] * Math.cos(angle)
      imag += normalized[t] * Math.sin(angle)
    }
    
    const amplitude = Math.sqrt(real * real + imag * imag) / n
    const frequency = k * freqStep
    
    if (frequency <= maxFreq) {
      frequencies.push(frequency)
      amplitudes.push(amplitude)
    }
  }
  
  const maxAmplitude = Math.max(...amplitudes, 1)
  const normalizedAmplitudes = amplitudes.map(a => a / maxAmplitude)
  
  return { frequencies, amplitudes: normalizedAmplitudes }
}

export function checkCalibrationExpiration(
  testRound: TestRound,
  warningDaysThreshold: number = 30
): CalibrationAlert[] {
  const alerts: CalibrationAlert[] = []
  const { sensorCalibrations, testDate } = testRound
  
  if (sensorCalibrations.length === 0) {
    return alerts
  }

  const testDateObj = new Date(testDate)
  
  for (const calibration of sensorCalibrations) {
    const expirationDate = new Date(calibration.expirationDate)
    const timeDiff = expirationDate.getTime() - testDateObj.getTime()
    const daysUntilExpiration = Math.ceil(timeDiff / (1000 * 60 * 60 * 24))
    
    if (daysUntilExpiration <= warningDaysThreshold) {
      alerts.push({
        id: generateId(),
        testRoundId: testRound.id,
        sensorId: calibration.sensorId,
        sensorName: calibration.sensorName,
        daysUntilExpiration,
        calibrationDate: calibration.calibrationDate,
        expirationDate: calibration.expirationDate,
        isExpired: daysUntilExpiration <= 0,
        isRejected: false
      })
    }
  }

  return alerts.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration)
}

export function detectAnomalySpikes(
  testRound: TestRound,
  thresholdMultiplier: number = 3,
  windowSize: number = 50
): AnomalySpike[] {
  const spikes: AnomalySpike[] = []
  const { forceData, windSpeedProfile } = testRound
  
  if (forceData.length < windowSize * 2) {
    return spikes
  }

  const forceTypes: Array<'fx' | 'fy' | 'fz' | 'mx' | 'my' | 'mz'> = ['fx', 'fy', 'fz', 'mx', 'my', 'mz']

  for (const forceType of forceTypes) {
    const values = forceData.map(f => f[forceType])
    
    for (let i = windowSize; i < values.length; i++) {
      const windowValues = values.slice(i - windowSize, i)
      const windowMean = windowValues.reduce((a, b) => a + b, 0) / windowValues.length
      const windowStd = calculateStandardDeviation(windowValues)
      
      const currentValue = values[i]
      const deviation = Math.abs(currentValue - windowMean)
      const deviationThreshold = thresholdMultiplier * windowStd
      
      if (deviation > deviationThreshold && windowStd > 0) {
        const deviationPercentage = (deviation / Math.abs(windowMean || 1)) * 100
        
        const currentTimestamp = forceData[i].timestamp
        const closestWindPoint = windSpeedProfile.reduce((prev, curr) => {
          return Math.abs(curr.timestamp - currentTimestamp) < Math.abs(prev.timestamp - currentTimestamp)
            ? curr : prev
        }, windSpeedProfile[0] || { timestamp: 0, speed: 0 })

        const severity: 'low' | 'medium' | 'high' = 
          deviationPercentage > 50 ? 'high' : 
          deviationPercentage > 20 ? 'medium' : 'low'

        spikes.push({
          id: generateId(),
          testRoundId: testRound.id,
          timestamp: currentTimestamp,
          forceType,
          value: currentValue,
          baselineValue: windowMean,
          deviation,
          deviationPercentage,
          windSpeedAtTime: closestWindPoint.speed,
          severity,
          isRejected: false
        })
        
        i += Math.floor(windowSize / 2)
      }
    }
  }

  return spikes.sort((a, b) => b.deviationPercentage - a.deviationPercentage)
}

export function analyzeTestRound(
  testRound: TestRound,
  options?: {
    baselineWindowSize?: number
    driftThresholdPercentage?: number
    supportNaturalFrequency?: number
    frequencyBandwidth?: number
    warningDaysThreshold?: number
    spikeThresholdMultiplier?: number
    spikeWindowSize?: number
  }
): AnalysisResult {
  const opts = {
    baselineWindowSize: 50,
    driftThresholdPercentage: 5,
    supportNaturalFrequency: 0,
    frequencyBandwidth: 2,
    warningDaysThreshold: 30,
    spikeThresholdMultiplier: 3,
    spikeWindowSize: 50,
    ...options
  }

  const dragCoefficientDrifts = detectDragCoefficientDrift(
    testRound,
    opts.baselineWindowSize,
    opts.driftThresholdPercentage
  )

  const resonanceWindows = detectResonanceWindows(
    testRound,
    opts.supportNaturalFrequency,
    opts.frequencyBandwidth
  )

  const calibrationAlerts = checkCalibrationExpiration(
    testRound,
    opts.warningDaysThreshold
  )

  const anomalySpikes = detectAnomalySpikes(
    testRound,
    opts.spikeThresholdMultiplier,
    opts.spikeWindowSize
  )

  const hasCritical = 
    dragCoefficientDrifts.some(d => d.severity === 'high') ||
    resonanceWindows.some(r => r.severity === 'high') ||
    calibrationAlerts.some(c => c.isExpired) ||
    anomalySpikes.some(s => s.severity === 'high')

  const hasWarning = 
    dragCoefficientDrifts.some(d => d.severity === 'medium') ||
    resonanceWindows.some(r => r.severity === 'medium') ||
    calibrationAlerts.length > 0 ||
    anomalySpikes.some(s => s.severity === 'medium')

  const overallStatus: 'normal' | 'warning' | 'critical' = 
    hasCritical ? 'critical' : hasWarning ? 'warning' : 'normal'

  const summaryParts: string[] = []
  
  if (dragCoefficientDrifts.length > 0) {
    summaryParts.push(`检测到 ${dragCoefficientDrifts.length} 处阻力系数漂移`)
  }
  if (resonanceWindows.length > 0) {
    summaryParts.push(`检测到 ${resonanceWindows.length} 个共振窗口`)
  }
  if (calibrationAlerts.length > 0) {
    const expired = calibrationAlerts.filter(c => c.isExpired).length
    summaryParts.push(`${expired > 0 ? expired + ' 个传感器已过期校准, ' : ''}${calibrationAlerts.length - expired} 个校准即将过期`)
  }
  if (anomalySpikes.length > 0) {
    summaryParts.push(`检测到 ${anomalySpikes.length} 个异常尖峰`)
  }

  const summary = summaryParts.length > 0 
    ? summaryParts.join('; ') 
    : '未检测到异常，测试数据正常'

  return {
    testRoundId: testRound.id,
    analysisDate: new Date().toISOString(),
    dragCoefficientDrifts,
    resonanceWindows,
    calibrationAlerts,
    anomalySpikes,
    overallStatus,
    summary
  }
}

export function generateRiskItems(
  testRound: TestRound,
  analysisResult: AnalysisResult
): RiskItem[] {
  const riskItems: RiskItem[] = []

  for (const drift of analysisResult.dragCoefficientDrifts) {
    riskItems.push({
      id: generateId(),
      testRoundId: testRound.id,
      testNumber: testRound.testNumber,
      category: 'drift',
      description: `阻力系数漂移 ${drift.driftPercentage.toFixed(2)}%，基线值 ${drift.baselineValue.toFixed(4)}，当前值 ${drift.currentValue.toFixed(4)}`,
      severity: drift.severity,
      status: 'pending'
    })
  }

  for (const resonance of analysisResult.resonanceWindows) {
    riskItems.push({
      id: generateId(),
      testRoundId: testRound.id,
      testNumber: testRound.testNumber,
      category: 'resonance',
      description: `共振窗口 ${resonance.frequencyStart.toFixed(1)}Hz - ${resonance.frequencyEnd.toFixed(1)}Hz，振幅 ${resonance.amplitude.toFixed(3)}，风速范围 ${resonance.windSpeedRange.min.toFixed(1)} - ${resonance.windSpeedRange.max.toFixed(1)} m/s`,
      severity: resonance.severity,
      status: 'pending'
    })
  }

  for (const alert of analysisResult.calibrationAlerts) {
    riskItems.push({
      id: generateId(),
      testRoundId: testRound.id,
      testNumber: testRound.testNumber,
      category: 'calibration',
      description: `传感器 ${alert.sensorName} (${alert.sensorId}) 校准${alert.isExpired ? '已过期' : `将在 ${alert.daysUntilExpiration} 天后过期`}，有效期至 ${alert.expirationDate}`,
      severity: alert.isExpired ? 'high' : 'medium',
      status: 'pending'
    })
  }

  for (const spike of analysisResult.anomalySpikes) {
    const forceTypeNames: Record<string, string> = {
      fx: 'X向力', fy: 'Y向力', fz: 'Z向力',
      mx: 'X向力矩', my: 'Y向力矩', mz: 'Z向力矩'
    }
    riskItems.push({
      id: generateId(),
      testRoundId: testRound.id,
      testNumber: testRound.testNumber,
      category: 'spike',
      description: `${forceTypeNames[spike.forceType] || spike.forceType} 异常尖峰，值 ${spike.value.toFixed(4)}，基线 ${spike.baselineValue.toFixed(4)}，偏差 ${spike.deviationPercentage.toFixed(2)}%，当时风速 ${spike.windSpeedAtTime.toFixed(1)} m/s`,
      severity: spike.severity,
      status: 'pending'
    })
  }

  return riskItems
}
