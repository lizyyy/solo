export function detectBPM(samples: number[], sampleRate: number): { bpm: number, confidence: number } {
  const windowSize = Math.floor(sampleRate * 0.01)
  const amplitudes: number[] = []

  for (let i = 0; i < samples.length; i += windowSize) {
    let sumSquares = 0
    const end = Math.min(i + windowSize, samples.length)
    for (let j = i; j < end; j++) {
      sumSquares += samples[j] * samples[j]
    }
    amplitudes.push(Math.sqrt(sumSquares / (end - i)))
  }

  if (amplitudes.length < 2) {
    return { bpm: 0, confidence: 0 }
  }

  const mean = amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length
  const threshold = mean * 1.5

  const peaks: number[] = []
  const minPeakDistance = Math.floor(sampleRate * 0.1 / windowSize)

  for (let i = 1; i < amplitudes.length - 1; i++) {
    if (
      amplitudes[i] > threshold &&
      amplitudes[i] > amplitudes[i - 1] &&
      amplitudes[i] >= amplitudes[i + 1]
    ) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minPeakDistance) {
        peaks.push(i)
      }
    }
  }

  if (peaks.length < 2) {
    return { bpm: 0, confidence: 0 }
  }

  const intervals: number[] = []
  for (let i = 1; i < peaks.length; i++) {
    const intervalSamples = (peaks[i] - peaks[i - 1]) * windowSize
    const intervalSeconds = intervalSamples / sampleRate
    intervals.push(intervalSeconds)
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
  let bpm = 60 / avgInterval

  while (bpm > 200) bpm /= 2
  while (bpm < 60) bpm *= 2

  if (intervals.length < 2) {
    return { bpm: Math.round(bpm * 10) / 10, confidence: 0.3 }
  }

  const variance = intervals.reduce((sum, iv) => sum + (iv - avgInterval) ** 2, 0) / intervals.length
  const stdDev = Math.sqrt(variance)
  const cv = stdDev / avgInterval
  const confidence = Math.max(0, Math.min(1, 1 - cv * 2))

  return { bpm: Math.round(bpm * 10) / 10, confidence: Math.round(confidence * 100) / 100 }
}
