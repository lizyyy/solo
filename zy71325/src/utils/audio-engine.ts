import type { TrackAudio, AnomalyFragment, DriftSegment } from "@/types"
import { generateId } from "./hash"

const PEAKS_PER_SECOND = 50
const ONSET_THRESHOLD = 0.15
const BEAT_DRIFT_TOLERANCE = 0.05
const DUPLICATE_SIMILARITY_THRESHOLD = 0.85
const FINGERPRINT_WINDOW_SECONDS = 2

export async function decodeAudioFile(file: File): Promise<{
  audioBuffer: AudioBuffer
  waveformPeaks: number[]
}> {
  const arrayBuffer = await file.arrayBuffer()
  const audioCtx = new AudioContext()
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  const waveformPeaks = extractWaveformPeaks(audioBuffer)
  await audioCtx.close()
  return { audioBuffer, waveformPeaks }
}

function extractWaveformPeaks(audioBuffer: AudioBuffer): number[] {
  const channelData = audioBuffer.getChannelData(0)
  const sampleRate = audioBuffer.sampleRate
  const samplesPerPeak = Math.floor(sampleRate / PEAKS_PER_SECOND)
  const peaksCount = Math.floor(channelData.length / samplesPerPeak)
  const peaks: number[] = []

  for (let i = 0; i < peaksCount; i++) {
    let maxVal = 0
    const start = i * samplesPerPeak
    const end = Math.min(start + samplesPerPeak, channelData.length)
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j])
      if (abs > maxVal) maxVal = abs
    }
    peaks.push(maxVal)
  }

  return peaks
}

export function detectOnsetOffset(peaks: number[], threshold = ONSET_THRESHOLD): number {
  const maxPeak = Math.max(...peaks)
  const normalizedThreshold = maxPeak * threshold
  for (let i = 0; i < peaks.length; i++) {
    if (peaks[i] >= normalizedThreshold) {
      return i / PEAKS_PER_SECOND
    }
  }
  return 0
}

export function detectAlignmentAnomalies(
  tracks: TrackAudio[],
  sessionId: string
): AnomalyFragment[] {
  const anomalies: AnomalyFragment[] = []
  if (tracks.length < 2) return anomalies

  const drumsTrack = tracks.find((t) => t.channelType === "drums")
  const referenceTrack = drumsTrack || tracks[0]
  const refOnset = detectOnsetOffset(referenceTrack.waveformPeaks)

  for (const track of tracks) {
    if (track.id === referenceTrack.id) continue
    const trackOnset = detectOnsetOffset(track.waveformPeaks)
    const offsetMs = Math.round((trackOnset - refOnset) * 1000)

    if (Math.abs(offsetMs) > 50) {
      anomalies.push({
        id: generateId(),
        sessionId,
        type: "offset_error",
        startTime: Math.min(refOnset, trackOnset),
        endTime: Math.max(refOnset, trackOnset) + 1,
        trackId: track.id,
        severity: Math.abs(offsetMs) > 500 ? "error" : "warning",
        note: `${track.fileName} 起点偏移 ${offsetMs > 0 ? "+" : ""}${offsetMs}ms (参考轨: ${referenceTrack.fileName})`,
        resolved: false,
      })
    }
  }

  return anomalies
}

export function detectBeatDrift(
  track: TrackAudio,
  sessionId: string
): AnomalyFragment[] {
  const anomalies: AnomalyFragment[] = []
  const peaks = track.waveformPeaks
  if (peaks.length < PEAKS_PER_SECOND * 10) return anomalies

  const energyEnvelope = computeEnergyEnvelope(peaks)
  const peakIndices = findEnergyPeaks(energyEnvelope)

  if (peakIndices.length < 4) return anomalies

  const intervals: number[] = []
  for (let i = 1; i < peakIndices.length; i++) {
    intervals.push(peakIndices[i] - peakIndices[i - 1])
  }

  const medianInterval = median(intervals)
  const driftSegments: DriftSegment[] = []
  let driftStart = -1
  let driftAccum = 0

  for (let i = 0; i < intervals.length; i++) {
    const deviation = Math.abs(intervals[i] - medianInterval) / medianInterval
    if (deviation > BEAT_DRIFT_TOLERANCE) {
      if (driftStart === -1) driftStart = i
      driftAccum += (intervals[i] - medianInterval) / PEAKS_PER_SECOND * 60
    } else {
      if (driftStart !== -1) {
        driftSegments.push({
          startTime: peakIndices[driftStart] / PEAKS_PER_SECOND,
          endTime: peakIndices[i] / PEAKS_PER_SECOND,
          bpmDelta: Math.round(driftAccum * 10) / 10,
        })
        driftStart = -1
        driftAccum = 0
      }
    }
  }

  if (driftStart !== -1) {
    driftSegments.push({
      startTime: peakIndices[driftStart] / PEAKS_PER_SECOND,
      endTime: track.duration,
      bpmDelta: Math.round(driftAccum * 10) / 10,
    })
  }

  for (const seg of driftSegments) {
    anomalies.push({
      id: generateId(),
      sessionId,
      type: "beat_drift",
      startTime: seg.startTime,
      endTime: seg.endTime,
      trackId: track.id,
      severity: Math.abs(seg.bpmDelta) > 10 ? "error" : "warning",
      note: `${track.fileName} 节拍漂移 ${seg.bpmDelta > 0 ? "+" : ""}${seg.bpmDelta} BPM (${seg.startTime.toFixed(1)}s - ${seg.endTime.toFixed(1)}s)`,
      resolved: false,
    })
  }

  return anomalies
}

export function detectDuplicateClips(
  track: TrackAudio,
  sessionId: string
): AnomalyFragment[] {
  const anomalies: AnomalyFragment[] = []
  const peaks = track.waveformPeaks
  const fingerprintWindowSize = Math.floor(PEAKS_PER_SECOND * FINGERPRINT_WINDOW_SECONDS)
  if (peaks.length < fingerprintWindowSize * 3) return anomalies

  const fingerprints = computeFingerprints(peaks, fingerprintWindowSize)

  for (let i = 0; i < fingerprints.length; i++) {
    for (let j = i + 2; j < fingerprints.length; j++) {
      const similarity = cosineSimilarity(fingerprints[i], fingerprints[j])
      if (similarity >= DUPLICATE_SIMILARITY_THRESHOLD) {
        const startTime = i * fingerprintWindowSize / PEAKS_PER_SECOND
        const endTime = (j + 1) * fingerprintWindowSize / PEAKS_PER_SECOND

        const overlapping = anomalies.some(
          (a) => a.startTime < endTime && a.endTime > startTime
        )

        if (!overlapping) {
          anomalies.push({
            id: generateId(),
            sessionId,
            type: "duplicate_clip",
            startTime,
            endTime,
            trackId: track.id,
            severity: "warning",
            note: `${track.fileName} 疑似重复剪辑 (${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s), 相似度 ${(similarity * 100).toFixed(0)}%`,
            resolved: false,
          })
        }
        break
      }
    }
  }

  return anomalies
}

function computeEnergyEnvelope(peaks: number[]): number[] {
  const windowSize = Math.floor(PEAKS_PER_SECOND * 0.1)
  const envelope: number[] = []
  for (let i = 0; i < peaks.length; i++) {
    let sum = 0
    const start = Math.max(0, i - windowSize)
    const end = Math.min(peaks.length, i + windowSize)
    for (let j = start; j < end; j++) {
      sum += peaks[j] * peaks[j]
    }
    envelope.push(Math.sqrt(sum / (end - start)))
  }
  return envelope
}

function findEnergyPeaks(envelope: number[]): number[] {
  const peaks: number[] = []
  const minPeakDistance = Math.floor(PEAKS_PER_SECOND * 0.3)
  const threshold = mean(envelope) * 1.5
  let lastPeak = -minPeakDistance

  for (let i = 1; i < envelope.length - 1; i++) {
    if (
      envelope[i] > threshold &&
      envelope[i] > envelope[i - 1] &&
      envelope[i] > envelope[i + 1] &&
      i - lastPeak >= minPeakDistance
    ) {
      peaks.push(i)
      lastPeak = i
    }
  }

  return peaks
}

function computeFingerprints(peaks: number[], windowSize: number): number[][] {
  const fingerprints: number[][] = []
  const step = Math.floor(windowSize * 0.5)
  for (let i = 0; i + windowSize <= peaks.length; i += step) {
    const fp: number[] = []
    for (let j = 0; j < windowSize; j++) {
      fp.push(peaks[i + j])
    }
    const norm = Math.sqrt(fp.reduce((s, v) => s + v * v, 0))
    if (norm > 0) {
      fingerprints.push(fp.map((v) => v / norm))
    }
  }
  return fingerprints
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
  }
  return dot
}

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function runAllDetections(
  tracks: TrackAudio[],
  sessionId: string
): AnomalyFragment[] {
  const anomalies: AnomalyFragment[] = []

  anomalies.push(...detectAlignmentAnomalies(tracks, sessionId))

  for (const track of tracks) {
    anomalies.push(...detectBeatDrift(track, sessionId))
    anomalies.push(...detectDuplicateClips(track, sessionId))
  }

  return anomalies
}
