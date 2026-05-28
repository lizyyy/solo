import { FilterType } from '../../types/synth';

export class FilterNodeWrapper {
  private filter: BiquadFilterNode;
  private context: AudioContext;
  private baseCutoff: number = 2000;
  private envelopeAmount: number = 0.5;

  constructor(context: AudioContext) {
    this.context = context;
    this.filter = context.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2000;
    this.filter.Q.value = 1;
  }

  setType(type: FilterType): void {
    this.filter.type = type;
  }

  setCutoff(frequency: number): void {
    this.baseCutoff = frequency;
    this.filter.frequency.setTargetAtTime(frequency, this.context.currentTime, 0.01);
  }

  setResonance(q: number): void {
    this.filter.Q.setTargetAtTime(q, this.context.currentTime, 0.01);
  }

  setEnvelopeAmount(amount: number): void {
    this.envelopeAmount = amount;
  }

  applyEnvelopeModulation(envelopeValue: number): void {
    const modulation = envelopeValue * this.envelopeAmount * 4000;
    const newCutoff = Math.min(20000, this.baseCutoff + modulation);
    this.filter.frequency.setTargetAtTime(newCutoff, this.context.currentTime, 0.005);
  }

  applyLFOModulation(modulationAmount: number): void {
    const lfoMod = modulationAmount * 2000;
    const newCutoff = Math.max(20, Math.min(20000, this.baseCutoff + lfoMod));
    this.filter.frequency.setTargetAtTime(newCutoff, this.context.currentTime, 0.005);
  }

  connect(destination: AudioNode): void {
    this.filter.connect(destination);
  }

  disconnect(): void {
    this.filter.disconnect();
  }

  get input(): AudioNode {
    return this.filter;
  }

  get output(): AudioNode {
    return this.filter;
  }
}
