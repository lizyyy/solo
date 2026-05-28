import { SynthParams, LFOTargetType } from '../types/synth';
import { OscillatorNodeWrapper } from './nodes/Oscillator';
import { FilterNodeWrapper } from './nodes/Filter';
import { AmplitudeEnvelope, EnvelopeGenerator } from './nodes/Envelope';
import { LFONode } from './nodes/LFO';

export class Synthesizer {
  private context: AudioContext;
  private oscillator: OscillatorNodeWrapper;
  private filter: FilterNodeWrapper;
  private amplitudeEnvelope: AmplitudeEnvelope;
  private filterEnvelope: EnvelopeGenerator;
  private lfo: LFONode;
  private masterGain: GainNode;
  private limiter: DynamicsCompressorNode;
  private analyser: AnalyserNode;
  private params: SynthParams;
  private isPlaying: boolean = false;

  constructor(context: AudioContext, params: SynthParams) {
    this.context = context;
    this.params = JSON.parse(JSON.stringify(params));

    this.oscillator = new OscillatorNodeWrapper(context);
    this.filter = new FilterNodeWrapper(context);
    this.amplitudeEnvelope = new AmplitudeEnvelope(context, params.envelope);
    this.filterEnvelope = new EnvelopeGenerator(context, params.envelope);
    this.lfo = new LFONode(context);

    this.masterGain = context.createGain();
    this.masterGain.gain.value = params.master.volume;

    this.limiter = context.createDynamicsCompressor();
    this.limiter.threshold.value = -1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.05;

    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    this.filterEnvelope.setOnValueChange((value) => {
      this.filter.applyEnvelopeModulation(value);
    });

    this.lfo.setOnModulation((target, value) => {
      this.applyLFOModulation(target, value);
    });

    this.connectSignalChain();
    this.applyAllParams();
    this.lfo.start();
  }

  private connectSignalChain(): void {
    this.oscillator.connect(this.filter.input);
    this.filter.connect(this.amplitudeEnvelope.input);
    this.amplitudeEnvelope.connect(this.masterGain);
    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(this.context.destination);
  }

  private applyAllParams(): void {
    this.oscillator.setWaveform(this.params.oscillator.waveform);
    this.oscillator.setFrequency(this.params.oscillator.frequency);
    this.oscillator.setDetune(this.params.oscillator.detune);

    this.filter.setType(this.params.filter.type);
    this.filter.setCutoff(this.params.filter.cutoff);
    this.filter.setResonance(this.params.filter.resonance);
    this.filter.setEnvelopeAmount(this.params.filter.envelopeAmount);

    this.amplitudeEnvelope.setParams(this.params.envelope);
    this.filterEnvelope.setParams(this.params.envelope);

    this.lfo.setWaveform(this.params.lfo.waveform);
    this.lfo.setRate(this.params.lfo.rate);
    this.lfo.setDepth(this.params.lfo.depth);
    this.lfo.setTarget(this.params.lfo.target);

    this.masterGain.gain.setTargetAtTime(
      Math.min(this.params.master.volume, 0.85),
      this.context.currentTime,
      0.01
    );
  }

  private applyLFOModulation(target: LFOTargetType, value: number): void {
    switch (target) {
      case 'volume':
        const baseVol = this.params.master.volume;
        const modulatedVol = Math.max(0, Math.min(1, baseVol + value * baseVol * 0.5));
        this.masterGain.gain.setTargetAtTime(modulatedVol, this.context.currentTime, 0.005);
        break;
      case 'pitch':
        this.oscillator.applyPitchModulation(value * 0.1);
        break;
      case 'filter':
        this.filter.applyLFOModulation(value);
        break;
    }
  }

  setParam(module: string, param: string, value: unknown): void {
    const now = this.context.currentTime;

    switch (module) {
      case 'oscillator':
        if (param === 'waveform') {
          this.oscillator.setWaveform(value as 'sine' | 'square' | 'sawtooth' | 'triangle');
          this.params.oscillator.waveform = value as 'sine' | 'square' | 'sawtooth' | 'triangle';
        } else if (param === 'frequency') {
          this.oscillator.setFrequency(value as number);
          this.params.oscillator.frequency = value as number;
        } else if (param === 'detune') {
          this.oscillator.setDetune(value as number);
          this.params.oscillator.detune = value as number;
        }
        break;

      case 'filter':
        if (param === 'type') {
          this.filter.setType(value as 'lowpass' | 'highpass' | 'bandpass' | 'notch');
          this.params.filter.type = value as 'lowpass' | 'highpass' | 'bandpass' | 'notch';
        } else if (param === 'cutoff') {
          this.filter.setCutoff(value as number);
          this.params.filter.cutoff = value as number;
        } else if (param === 'resonance') {
          this.filter.setResonance(value as number);
          this.params.filter.resonance = value as number;
        } else if (param === 'envelopeAmount') {
          this.filter.setEnvelopeAmount(value as number);
          this.params.filter.envelopeAmount = value as number;
        }
        break;

      case 'envelope':
        const envParams: Partial<typeof this.params.envelope> = {};
        envParams[param as keyof typeof envParams] = value as number;
        this.amplitudeEnvelope.setParams(envParams);
        this.filterEnvelope.setParams(envParams);
        (this.params.envelope as unknown as Record<string, number>)[param] = value as number;
        break;

      case 'lfo':
        if (param === 'waveform') {
          this.lfo.setWaveform(value as 'sine' | 'square' | 'sawtooth' | 'triangle');
          this.params.lfo.waveform = value as 'sine' | 'square' | 'sawtooth' | 'triangle';
        } else if (param === 'rate') {
          this.lfo.setRate(value as number);
          this.params.lfo.rate = value as number;
        } else if (param === 'depth') {
          this.lfo.setDepth(value as number);
          this.params.lfo.depth = value as number;
        } else if (param === 'target') {
          this.lfo.setTarget(value as 'volume' | 'pitch' | 'filter');
          this.params.lfo.target = value as 'volume' | 'pitch' | 'filter';
        }
        break;

      case 'master':
        if (param === 'volume') {
          const safeVolume = Math.min(value as number, 0.85);
          this.masterGain.gain.setTargetAtTime(safeVolume, now, 0.01);
          this.params.master.volume = value as number;
        }
        break;
    }
  }

  setAllParams(params: SynthParams): void {
    this.params = JSON.parse(JSON.stringify(params));
    this.applyAllParams();
  }

  noteOn(frequency?: number): void {
    if (frequency) {
      this.oscillator.setFrequency(frequency);
      this.params.oscillator.frequency = frequency;
    }
    this.amplitudeEnvelope.trigger();
    this.filterEnvelope.trigger();
    this.isPlaying = true;
  }

  noteOff(): void {
    this.amplitudeEnvelope.release();
    this.filterEnvelope.release();
    this.isPlaying = false;
  }

  getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  getCurrentLevel(): number {
    const dataArray = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / dataArray.length);
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getParams(): SynthParams {
    return JSON.parse(JSON.stringify(this.params));
  }

  dispose(): void {
    this.lfo.stop();
    this.oscillator.stop();
    this.amplitudeEnvelope.dispose();
    this.filterEnvelope.dispose();
    this.lfo.dispose();

    this.masterGain.disconnect();
    this.limiter.disconnect();
    this.analyser.disconnect();
  }
}
