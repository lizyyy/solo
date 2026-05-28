import { EnvelopeParams } from '../../types/synth';

export class EnvelopeGenerator {
  private context: AudioContext;
  private params: EnvelopeParams;
  private currentPhase: 'idle' | 'attack' | 'decay' | 'sustain' | 'release' = 'idle';
  private startTime: number = 0;
  private onValueChange?: (value: number) => void;
  private animationFrame: number | null = null;

  constructor(context: AudioContext, params: EnvelopeParams) {
    this.context = context;
    this.params = { ...params };
  }

  setParams(params: Partial<EnvelopeParams>): void {
    this.params = { ...this.params, ...params };
  }

  setOnValueChange(callback: (value: number) => void): void {
    this.onValueChange = callback;
  }

  trigger(): void {
    this.currentPhase = 'attack';
    this.startTime = this.context.currentTime;
    this.startEnvelopeLoop();
  }

  release(): void {
    if (this.currentPhase === 'idle') return;
    this.currentPhase = 'release';
    this.startTime = this.context.currentTime;
    this.startEnvelopeLoop();
  }

  private startEnvelopeLoop(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.updateEnvelope();
  }

  private updateEnvelope = (): void => {
    const now = this.context.currentTime;
    const elapsed = now - this.startTime;
    let value = 0;

    switch (this.currentPhase) {
      case 'attack':
        if (elapsed < this.params.attack) {
          value = elapsed / this.params.attack;
        } else {
          this.currentPhase = 'decay';
          this.startTime = now;
          value = 1;
        }
        break;

      case 'decay':
        if (elapsed < this.params.decay) {
          value = 1 - (elapsed / this.params.decay) * (1 - this.params.sustain);
        } else {
          this.currentPhase = 'sustain';
          value = this.params.sustain;
        }
        break;

      case 'sustain':
        value = this.params.sustain;
        break;

      case 'release':
        if (elapsed < this.params.release) {
          value = this.params.sustain * (1 - elapsed / this.params.release);
        } else {
          this.currentPhase = 'idle';
          value = 0;
        }
        break;

      case 'idle':
        value = 0;
        break;
    }

    if (this.onValueChange) {
      this.onValueChange(value);
    }

    if (this.currentPhase !== 'idle' || value > 0.001) {
      this.animationFrame = requestAnimationFrame(this.updateEnvelope);
    }
  };

  getCurrentValue(): number {
    return 0;
  }

  isActive(): boolean {
    return this.currentPhase !== 'idle';
  }

  dispose(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.currentPhase = 'idle';
  }
}

export class AmplitudeEnvelope {
  private context: AudioContext;
  private gainNode: GainNode;
  private envelope: EnvelopeGenerator;

  constructor(context: AudioContext, params: EnvelopeParams) {
    this.context = context;
    this.gainNode = context.createGain();
    this.gainNode.gain.value = 0;
    this.envelope = new EnvelopeGenerator(context, params);
    this.envelope.setOnValueChange((value) => {
      this.gainNode.gain.setTargetAtTime(value, context.currentTime, 0.002);
    });
  }

  setParams(params: Partial<EnvelopeParams>): void {
    this.envelope.setParams(params);
  }

  trigger(): void {
    this.envelope.trigger();
  }

  release(): void {
    this.envelope.release();
  }

  connect(destination: AudioNode): void {
    this.gainNode.connect(destination);
  }

  disconnect(): void {
    this.gainNode.disconnect();
  }

  get input(): AudioNode {
    return this.gainNode;
  }

  get envelopeGenerator(): EnvelopeGenerator {
    return this.envelope;
  }

  dispose(): void {
    this.envelope.dispose();
    this.gainNode.disconnect();
  }
}
