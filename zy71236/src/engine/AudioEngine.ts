import { SynthParams, DEFAULT_PARAMS } from '../types/synth';
import { Synthesizer } from './Synthesizer';

export class AudioEngine {
  private static instance: AudioEngine | null = null;
  private context: AudioContext | null = null;
  private synthesizer: Synthesizer | null = null;
  private currentParams: SynthParams = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    this.context = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    this.synthesizer = new Synthesizer(this.context, this.currentParams);
    this.isInitialized = true;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.synthesizer || !this.context) {
      throw new Error('AudioEngine not initialized. Call init() first.');
    }
  }

  async ensureStarted(): Promise<void> {
    if (!this.context) {
      await this.init();
    }
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  setParam(module: string, param: string, value: unknown): void {
    this.ensureInitialized();
    (this.currentParams as unknown as Record<string, unknown>)[module] = {
      ...(this.currentParams as unknown as Record<string, unknown>)[module] as object,
      [param]: value,
    };
    this.synthesizer!.setParam(module, param, value);
  }

  setAllParams(params: SynthParams): void {
    this.ensureInitialized();
    this.currentParams = JSON.parse(JSON.stringify(params));
    this.synthesizer!.setAllParams(params);
  }

  getParams(): SynthParams {
    return JSON.parse(JSON.stringify(this.currentParams));
  }

  noteOn(frequency?: number): void {
    this.ensureInitialized();
    this.synthesizer!.noteOn(frequency);
  }

  noteOff(): void {
    this.ensureInitialized();
    this.synthesizer!.noteOff();
  }

  getAnalyser(): AnalyserNode {
    this.ensureInitialized();
    return this.synthesizer!.getAnalyser();
  }

  getCurrentLevel(): number {
    if (!this.synthesizer) return 0;
    return this.synthesizer!.getCurrentLevel();
  }

  getIsPlaying(): boolean {
    if (!this.synthesizer) return false;
    return this.synthesizer!.getIsPlaying();
  }

  getContext(): AudioContext {
    this.ensureInitialized();
    return this.context!;
  }

  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  dispose(): void {
    if (this.synthesizer) {
      this.synthesizer.dispose();
      this.synthesizer = null;
    }
    if (this.context) {
      this.context.close();
      this.context = null;
    }
    this.isInitialized = false;
  }
}
