export async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    
    const url = URL.createObjectURL(file);
    audio.src = url;
    
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    });
    
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法解码音频文件，可能格式不支持或文件已损坏'));
    });
    
    audio.load();
  });
}

export async function analyzeAudioFile(file: File): Promise<{
  duration: number;
  sampleRate?: number;
  channels?: number;
}> {
  try {
    const duration = await getAudioDuration(file);
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    
    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      return {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
      };
    } catch {
      return { duration };
    } finally {
      audioContext.close();
    }
  } catch (error) {
    throw error;
  }
}

export function checkDurationMatch(
  actualDuration: number,
  expectedDuration: number,
  tolerancePercent: number = 10
): { match: boolean; diffPercent: number; diffSeconds: number } {
  const diffSeconds = Math.abs(actualDuration - expectedDuration);
  const diffPercent = (diffSeconds / expectedDuration) * 100;
  
  return {
    match: diffPercent <= tolerancePercent,
    diffPercent: Math.round(diffPercent * 10) / 10,
    diffSeconds: Math.round(diffSeconds * 10) / 10,
  };
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const DURATION_TOLERANCE = 10;
