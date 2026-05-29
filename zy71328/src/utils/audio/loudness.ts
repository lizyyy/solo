export function calculateIntegratedLufs(audioData: Float32Array, sampleRate: number): number {
  const filtered = applyKWeighting(audioData, sampleRate);
  const squared = filtered.map(v => v * v);
  const mean = squared.reduce((a, b) => a + b, 0) / squared.length;
  return 10 * Math.log10(mean + 1e-10);
}

export function calculateLoudnessRange(lufsValues: number[]): number {
  if (lufsValues.length === 0) return 0;
  const sorted = [...lufsValues].filter(v => v > -70).sort((a, b) => a - b);
  if (sorted.length < 2) return 0;
  const lowerIndex = Math.floor(sorted.length * 0.1);
  const upperIndex = Math.floor(sorted.length * 0.95);
  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];
  return upper - lower;
}

export function generateLoudnessTimeline(audioBuffer: AudioBuffer, windowSize: number): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const windowSamples = Math.floor(windowSize * sampleRate);
  const result: number[] = [];
  
  for (let i = 0; i < channelData.length; i += windowSamples) {
    const end = Math.min(i + windowSamples, channelData.length);
    const window = channelData.slice(i, end);
    const lufs = calculateIntegratedLufs(window, sampleRate);
    result.push(lufs);
  }
  
  return result;
}

function applyKWeighting(audioData: Float32Array, sampleRate: number): Float32Array {
  const result = new Float32Array(audioData.length);
  const b0 = 1.0, b1 = -2.0, b2 = 1.0;
  const a0 = 1.0, a1 = -1.99, a2 = 0.99;
  
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  
  for (let i = 0; i < audioData.length; i++) {
    const x0 = audioData[i];
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    result[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  
  const preEmphasis = 1.5;
  for (let i = 0; i < result.length; i++) {
    result[i] *= preEmphasis;
  }
  
  return result;
}
