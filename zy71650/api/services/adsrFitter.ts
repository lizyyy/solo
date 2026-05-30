export interface ADSRParams {
  attack: number
  decay: number
  sustain: number
  release: number
}

export interface PeakInfo {
  peakAmplitude: number
  peakSample: number
  steadyStateAmplitude: number
  steadyStateStart: number
  steadyStateEnd: number
  releaseEnd: number
}

function computeRMSEnvelope(samples: number[], sampleRate: number, onsetSample: number): { amplitudes: number[], sampleIndices: number[] } {
  const windowSize = Math.floor(sampleRate * 0.01)
  const amplitudes: number[] = []
  const sampleIndices: number[] = []

  for (let i = onsetSample; i < samples.length; i += windowSize) {
    let sumSquares = 0
    const end = Math.min(i + windowSize, samples.length)
    for (let j = i; j < end; j++) {
      sumSquares += samples[j] * samples[j]
    }
    amplitudes.push(Math.sqrt(sumSquares / (end - i)))
    sampleIndices.push(i)
  }

  return { amplitudes, sampleIndices }
}

function findPeak(amplitudes: number[], sampleIndices: number[]): { peakAmplitude: number, peakSample: number } {
  let peakAmplitude = 0
  let peakIndex = 0
  for (let i = 0; i < amplitudes.length; i++) {
    if (amplitudes[i] > peakAmplitude) {
      peakAmplitude = amplitudes[i]
      peakIndex = i
    }
  }
  return { peakAmplitude, peakSample: sampleIndices[peakIndex] }
}

function findSteadyState(amplitudes: number[], peakIndex: number): { steadyStateAmplitude: number, steadyStateStart: number, steadyStateEnd: number } {
  if (peakIndex >= amplitudes.length - 1) {
    return {
      steadyStateAmplitude: amplitudes[amplitudes.length - 1] || 0,
      steadyStateStart: peakIndex,
      steadyStateEnd: amplitudes.length - 1
    }
  }

  let steadyStateStart = peakIndex + 1
  const threshold = amplitudes[peakIndex] * 0.02

  for (let i = peakIndex + 1; i < amplitudes.length; i++) {
    const derivative = Math.abs(amplitudes[i] - amplitudes[i - 1])
    if (derivative < threshold && amplitudes[i] < amplitudes[peakIndex] * 0.9) {
      steadyStateStart = i
      break
    }
    if (i === amplitudes.length - 1) {
      steadyStateStart = peakIndex + 1
    }
  }

  let sum = 0
  let count = 0
  const noiseFloor = amplitudes[peakIndex] * 0.05
  let steadyStateEnd = amplitudes.length - 1

  for (let i = steadyStateStart; i < amplitudes.length; i++) {
    if (amplitudes[i] < noiseFloor) {
      steadyStateEnd = i
      break
    }
    sum += amplitudes[i]
    count++
  }

  if (count === 0) {
    count = 1
    sum = amplitudes[steadyStateStart] || 0
  }

  return {
    steadyStateAmplitude: sum / count,
    steadyStateStart,
    steadyStateEnd
  }
}

function findReleaseEnd(amplitudes: number[], steadyStateEnd: number): number {
  if (steadyStateEnd >= amplitudes.length - 1) {
    return amplitudes.length - 1
  }
  return steadyStateEnd
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function fitADSR(samples: number[], sampleRate: number, onsetSample: number): { raw: ADSRParams, peakInfo: PeakInfo } {
  const { amplitudes, sampleIndices } = computeRMSEnvelope(samples, sampleRate, onsetSample)

  const { peakAmplitude, peakSample } = findPeak(amplitudes, sampleIndices)
  const peakIndex = sampleIndices.indexOf(peakSample)

  const { steadyStateAmplitude, steadyStateStart: ssStartIdx, steadyStateEnd: ssEndIdx } = findSteadyState(amplitudes, peakIndex)

  const steadyStateStart = sampleIndices[ssStartIdx] || peakSample
  const steadyStateEnd = sampleIndices[ssEndIdx] || sampleIndices[sampleIndices.length - 1]

  const releaseEndIdx = findReleaseEnd(amplitudes, ssEndIdx)
  const releaseEnd = sampleIndices[releaseEndIdx] || sampleIndices[sampleIndices.length - 1]

  let attack = (peakSample - onsetSample) / sampleRate
  let decay = (steadyStateStart - peakSample) / sampleRate
  let sustain = peakAmplitude > 0 ? steadyStateAmplitude / peakAmplitude : 0
  let release = (releaseEnd - steadyStateEnd) / sampleRate

  attack = clamp(attack, 0.001, 10)
  decay = clamp(decay, 0.001, 10)
  sustain = clamp(sustain, 0, 1)
  release = clamp(release, 0.001, 20)

  return {
    raw: { attack, decay, sustain, release },
    peakInfo: {
      peakAmplitude,
      peakSample,
      steadyStateAmplitude,
      steadyStateStart,
      steadyStateEnd,
      releaseEnd
    }
  }
}
