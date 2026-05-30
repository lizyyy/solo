import type { ADSRParams, PeakInfo } from './adsrFitter.js'

export interface AnomalyFlag {
  type: 'onset_misjudgment' | 'noise_interference' | 'parameter_out_of_bounds'
  description: string
  severity: 'low' | 'medium' | 'high'
  affected_param: string
}

export function detectAnomalies(raw: ADSRParams, peakInfo: PeakInfo): AnomalyFlag[] {
  const anomalies: AnomalyFlag[] = []

  if (raw.attack < 0.002) {
    anomalies.push({
      type: 'onset_misjudgment',
      description: `Attack time ${raw.attack.toFixed(4)}s is unrealistically short, likely onset misjudgment`,
      severity: 'high',
      affected_param: 'attack'
    })
  }

  if (raw.sustain > 0.95 && raw.attack > 0.5) {
    anomalies.push({
      type: 'noise_interference',
      description: `Sustain level ${raw.sustain.toFixed(3)} with long attack ${raw.attack.toFixed(3)}s suggests noise floor interference`,
      severity: 'medium',
      affected_param: 'sustain'
    })
  }

  if (raw.attack > 10) {
    anomalies.push({
      type: 'parameter_out_of_bounds',
      description: `Attack time ${raw.attack.toFixed(3)}s exceeds typical synth range (max 10s)`,
      severity: 'high',
      affected_param: 'attack'
    })
  }

  if (raw.decay > 10) {
    anomalies.push({
      type: 'parameter_out_of_bounds',
      description: `Decay time ${raw.decay.toFixed(3)}s exceeds typical synth range (max 10s)`,
      severity: 'high',
      affected_param: 'decay'
    })
  }

  if (raw.sustain > 1) {
    anomalies.push({
      type: 'parameter_out_of_bounds',
      description: `Sustain level ${raw.sustain.toFixed(3)} exceeds valid range (max 1.0)`,
      severity: 'high',
      affected_param: 'sustain'
    })
  }

  if (raw.release > 20) {
    anomalies.push({
      type: 'parameter_out_of_bounds',
      description: `Release time ${raw.release.toFixed(3)}s exceeds typical synth range (max 20s)`,
      severity: 'high',
      affected_param: 'release'
    })
  }

  return anomalies
}
