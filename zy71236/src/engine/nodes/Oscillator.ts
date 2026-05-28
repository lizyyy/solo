import { WaveformType } from '../../types/synth';

export class OscillatorNodeWrapper {
  private oscillator: OscillatorNode;
  private gainNode: GainNode;
  private context: AudioContext;
  private baseFrequency: number = 440;

  constructor(context: AudioContext) {
    this.context = context;
    this.oscillator = context.createOscillator();
    this.gainNode = context.createGain();
    this.gainNode.gain.value = 1;
    this.oscillator.connect(this.gainNode);
    this.oscillator.start();
  }

  setWaveform(waveform: WaveformType): void {
    this.oscillator.type = waveform;
  }

  setFrequency(frequency: number): void {
    this.baseFrequency = frequency;
    this.oscillator.frequency.setTargetAtTime(frequency, this.context.currentTime, 0.01);
  }

  setDetune(cents: number): void {
    this.oscillator.detune.setTargetAtTime(cents, this.context.currentTime, 0.01);
  }

  applyPitchModulation(modulationAmount: number): void {
    const modulatedFreq = this.baseFrequency * Math.pow(2, modulationAmount);
    this.oscillator.frequency.setTargetAtTime(modulatedFreq, this.context.currentTime, 0.005);
  }

  connect(destination: AudioNode): void {
    this.gainNode.connect(destination);
  }

  disconnect(): void {
    this.gainNode.disconnect();
  }

  stop(): void {
    try {
      this.oscillator.stop();
    } catch (e) {
      // Already stopped
    }
    this.oscillator.disconnect();
    this.gainNode.disconnect();
  }
}
