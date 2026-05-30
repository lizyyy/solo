class AudioEngine {
  private ctx: AudioContext | null = null

  init(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    return this.ctx
  }

  playNote(frequency: number, duration = 0.5): void {
    const ctx = this.getCtx()
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(frequency, now)

    const attack = 0.01
    const decay = 0.1
    const sustainLevel = 0.3
    const release = 0.2

    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(1, now + attack)
    gain.gain.linearRampToValueAtTime(sustainLevel, now + attack + decay)
    gain.gain.setValueAtTime(sustainLevel, now + duration - release)
    gain.gain.linearRampToValueAtTime(0, now + duration)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + duration)
  }

  playCorrectSound(): void {
    const ctx = this.getCtx()
    const now = ctx.currentTime

    const freqs = [523.25, 659.25]

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + i * 0.15)

      gain.gain.setValueAtTime(0, now + i * 0.15)
      gain.gain.linearRampToValueAtTime(0.5, now + i * 0.15 + 0.01)
      gain.gain.linearRampToValueAtTime(0, now + i * 0.15 + 0.15)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + i * 0.15)
      osc.stop(now + i * 0.15 + 0.15)
    })
  }

  playWrongSound(): void {
    const ctx = this.getCtx()
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'square'
    osc.frequency.setValueAtTime(200, now)

    gain.gain.setValueAtTime(0.3, now)
    gain.gain.linearRampToValueAtTime(0, now + 0.3)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.3)
  }

  playBeatClick(): void {
    const ctx = this.getCtx()
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, now)

    gain.gain.setValueAtTime(0.3, now)
    gain.gain.linearRampToValueAtTime(0, now + 0.05)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.05)
  }

  playCountdownBeep(): void {
    const ctx = this.getCtx()
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, now)

    gain.gain.setValueAtTime(0.3, now)
    gain.gain.linearRampToValueAtTime(0, now + 0.1)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.1)
  }
}

export const audioEngine = new AudioEngine()
