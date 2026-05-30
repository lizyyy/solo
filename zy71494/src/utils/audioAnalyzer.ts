export const detectBPM = async (audioUrl: string): Promise<{ bpm: number; confidence: number; beats: number[] }> => {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = audioUrl;

    audio.onloadedmetadata = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;

        const bpm = detectBPMFromChannelData(channelData, sampleRate);
        const beats = generateBeats(bpm, duration);
        
        const confidence = bpm >= 60 && bpm <= 200 ? 0.8 : 0.5;

        resolve({ bpm, confidence, beats });
      } catch (error) {
        reject(error);
      } finally {
        audioContext.close();
      }
    };

    audio.onerror = () => {
      reject(new Error('无法加载音频文件'));
      audioContext.close();
    };
  });
};

const detectBPMFromChannelData = (channelData: Float32Array, sampleRate: number): number => {
  const windowSize = Math.floor(sampleRate * 0.1);
  const hopSize = Math.floor(windowSize / 2);
  const energies: number[] = [];

  for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += Math.abs(channelData[i + j]);
    }
    energies.push(energy / windowSize);
  }

  const onsetThreshold = calculateThreshold(energies);
  const onsets: number[] = [];
  
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > onsetThreshold && 
        energies[i] > energies[i - 1] && 
        energies[i] > energies[i + 1]) {
      onsets.push((i * hopSize) / sampleRate);
    }
  }

  if (onsets.length < 2) {
    return 120;
  }

  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    intervals.push(onsets[i] - onsets[i - 1]);
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  let bpm = Math.round(60 / avgInterval);

  while (bpm < 60) bpm *= 2;
  while (bpm > 200) bpm /= 2;

  return Math.round(bpm);
};

const calculateThreshold = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return mean * 0.8 + median * 1.2;
};

const generateBeats = (bpm: number, duration: number): number[] => {
  const beatInterval = 60 / bpm;
  const beats: number[] = [];
  
  for (let time = 0; time < duration; time += beatInterval) {
    beats.push(Math.round(time * 100) / 100);
  }
  
  return beats;
};

export const detectBeats = async (audioUrl: string, bpm: number): Promise<number[]> => {
  const audio = new Audio();
  audio.src = audioUrl;
  
  return new Promise((resolve) => {
    audio.onloadedmetadata = () => {
      const beats = generateBeats(bpm, audio.duration);
      resolve(beats);
    };
    audio.onerror = () => resolve([]);
  });
};

export const getWaveformData = async (audioUrl: string, samples: number = 500): Promise<number[]> => {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    fetch(audioUrl)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
      .then(audioBuffer => {
        const channelData = audioBuffer.getChannelData(0);
        const blockSize = Math.floor(channelData.length / samples);
        const waveformData: number[] = [];

        for (let i = 0; i < samples; i++) {
          const start = i * blockSize;
          let max = 0;
          for (let j = 0; j < blockSize; j++) {
            const value = Math.abs(channelData[start + j] || 0);
            if (value > max) max = value;
          }
          waveformData.push(max);
        }

        const maxVal = Math.max(...waveformData);
        const normalized = waveformData.map(v => v / maxVal);

        audioContext.close();
        resolve(normalized);
      })
      .catch(error => {
        audioContext.close();
        reject(error);
      });
  });
};
