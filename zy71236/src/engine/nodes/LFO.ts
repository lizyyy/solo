import { WaveformType, LFOTargetType } from '../../types/synth';

export class LFONode {
  private context: AudioContext;
  private oscillator: OscillatorNode;
  private gainNode: GainNode;
  private depth: number = 0.3;
  private target: LFOTargetType = 'volume';
  private animationFrame: number | null = null;
  private onModulation?: (target: LFOTargetType, value: number) => void;
  private phase: number = 0;

  constructor(context: AudioContext) {
    this.context = context;
    this.oscillator = context.createOscillator();
    this.gainNode = context.createGain();
    this.gainNode.gain.value = this.depth;
    this.oscillator.connect(this.gainNode);
    this.oscillator.type = 'sine';
    this.oscillator.frequency.value = 5;
    this.oscillator.start();
  }

  setWaveform(waveform: WaveformType): void {
    this.oscillator.type = waveform;
  }

  setRate(rate: number): void {
    this.oscillator.frequency.setTargetAtTime(rate, this.context.currentTime, 0.01);
  }

  setDepth(depth: number): void {
    this.depth = depth;
    this.gainNode.gain.setTargetAtTime(depth, this.context.currentTime, 0.01);
  }

  setTarget(target: LFOTargetType): void {
    this.target = target;
  }

  setOnModulation(callback: (target: LFOTargetType, value: number) => void): void {
    this.onModulation = callback;
  }

  start(): void {
    this.startModulationLoop();
  }

  stop(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private startModulationLoop(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.updateModulation();
  }

  private updateModulation = (): void => {
    if (this.depth > 0 && this.onModulation) {
      const now = this.context.currentTime;
      const rate = this.oscillator.frequency.value;
      const type = this.oscillator.type;

      let value = 0;
      this.phase = (now * rate) % 1;

      switch (type) {
        case 'sine':
          value = Math.sin(this.phase * Math.PI * 2);
          break;
        case 'square':
          value = this.phase < 0.5 ? 1 : -1;
          break;
        case 'sawtooth':
          value = 2 * this.phase - 1;
          break;
        case 'triangle':
          value = this.phase < 0.5 ? 4 * this.phase - 1 : 3 - 4 * this.phase;
          break;
      }

      const modulatedValue = value * this.depth;
      this.onModulation(this.target, modulatedValue);
    }

    this.animationFrame = requestAnimationFrame(this.updateModulation);
  };

  dispose(): void {
    this.stop();
    try {
      this.oscillator.stop();
    } catch (e) {
      // Already stopped
    }
    this.oscillator.disconnect();
    this.gainNode.disconnect();
  }
}
