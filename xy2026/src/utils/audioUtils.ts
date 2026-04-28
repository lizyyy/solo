let audioContext: AudioContext | null = null;
const noiseSources: Map<string, { oscillator: OscillatorNode; gain: GainNode; filter: BiquadFilterNode }> = new Map();

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

export const createWhiteNoise = (type: 'rain' | 'forest' | 'wind' | 'stream'): { 
  start: (volume?: number) => void; 
  stop: () => void; 
  setVolume: (volume: number) => void 
} => {
  const ctx = getAudioContext();
  let source: AudioBufferSourceNode | null = null;
  let gainNode: GainNode | null = null;
  let filterNode: BiquadFilterNode | null = null;

  const createNoiseBuffer = (): AudioBuffer => {
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const output = noiseBuffer.getChannelData(channel);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    }
    return noiseBuffer;
  };

  const createPinkNoiseBuffer = (): AudioBuffer => {
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const output = noiseBuffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
      }
    }
    return noiseBuffer;
  };

  const start = (volume: number = 0.3) => {
    if (source) return;
    
    source = ctx.createBufferSource();
    gainNode = ctx.createGain();
    filterNode = ctx.createBiquadFilter();
    
    switch (type) {
      case 'rain':
        source.buffer = createPinkNoiseBuffer();
        filterNode.type = 'lowpass';
        filterNode.frequency.value = 1000;
        break;
      case 'forest':
        source.buffer = createPinkNoiseBuffer();
        filterNode.type = 'lowpass';
        filterNode.frequency.value = 800;
        break;
      case 'wind':
        source.buffer = createNoiseBuffer();
        filterNode.type = 'bandpass';
        filterNode.frequency.value = 400;
        filterNode.Q.value = 0.5;
        break;
      case 'stream':
        source.buffer = createPinkNoiseBuffer();
        filterNode.type = 'highpass';
        filterNode.frequency.value = 200;
        break;
    }
    
    gainNode.gain.value = volume;
    source.loop = true;
    
    source.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    source.start();
    
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  };

  const stop = () => {
    if (source) {
      source.stop();
      source.disconnect();
      source = null;
    }
    if (gainNode) {
      gainNode.disconnect();
      gainNode = null;
    }
    if (filterNode) {
      filterNode.disconnect();
      filterNode = null;
    }
  };

  const setVolume = (volume: number) => {
    if (gainNode) {
      gainNode.gain.value = volume;
    }
  };

  return { start, stop, setVolume };
};

export const noiseGenerators: Map<string, ReturnType<typeof createWhiteNoise>> = new Map();

export const startNoise = (noiseId: string, type: 'rain' | 'forest' | 'wind' | 'stream', volume: number = 0.3) => {
  if (!noiseGenerators.has(noiseId)) {
    noiseGenerators.set(noiseId, createWhiteNoise(type));
  }
  noiseGenerators.get(noiseId)?.start(volume);
};

export const stopNoise = (noiseId: string) => {
  noiseGenerators.get(noiseId)?.stop();
  noiseGenerators.delete(noiseId);
};

export const stopAllNoises = () => {
  noiseGenerators.forEach(generator => generator.stop());
  noiseGenerators.clear();
};
