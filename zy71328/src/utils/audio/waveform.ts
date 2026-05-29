export function generateWaveformData(audioBuffer: AudioBuffer, targetWidth: number): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;
  const step = Math.max(1, Math.floor(totalSamples / targetWidth));
  const result: number[] = [];
  
  for (let i = 0; i < totalSamples; i += step) {
    let max = 0;
    const windowEnd = Math.min(i + step, totalSamples);
    
    for (let j = i; j < windowEnd; j++) {
      const absValue = Math.abs(channelData[j]);
      if (absValue > max) {
        max = absValue;
      }
    }
    
    result.push(max);
  }
  
  return result.slice(0, targetWidth);
}
