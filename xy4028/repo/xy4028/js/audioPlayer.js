/**
 * 音效/节拍提示系统
 * 提供节拍音和反馈音效
 */

import coachConfig from './coachConfig.js';

class AudioPlayer {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.metronomeOscillator = null;
    this.metronomeGain = null;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = coachConfig.get('metronomeVolume');
      
      this.isInitialized = true;
    } catch (e) {
      console.warn('无法初始化音频上下文:', e);
    }
  }

  ensureInitialized() {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  playTone(frequency, duration, type = 'sine', volume = 1) {
    this.ensureInitialized();
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    const now = this.audioContext.currentTime;
    gainNode.gain.setValueAtTime(volume * coachConfig.get('metronomeVolume'), now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  playMetronomeBeat() {
    if (!coachConfig.get('enableMetronome')) return;
    this.playTone(800, 0.05, 'sine', 0.3);
  }

  playPressFeedback(status) {
    switch (status) {
      case 'perfect':
        this.playTone(1200, 0.08, 'sine', 0.4);
        break;
      case 'good':
        this.playTone(900, 0.06, 'sine', 0.3);
        break;
      case 'too_fast':
        this.playTone(400, 0.1, 'square', 0.2);
        this.playTone(300, 0.1, 'square', 0.2);
        break;
      case 'too_slow':
        this.playTone(200, 0.15, 'triangle', 0.2);
        break;
      case 'missed':
        this.playTone(150, 0.2, 'sawtooth', 0.15);
        break;
      case 'double_tap':
        this.playTone(500, 0.05, 'square', 0.25);
        setTimeout(() => {
          this.playTone(500, 0.05, 'square', 0.25);
        }, 50);
        break;
    }
  }

  playCountdownBeep(remaining) {
    if (remaining === 0) {
      this.playTone(1000, 0.3, 'sine', 0.5);
    } else {
      this.playTone(600, 0.1, 'sine', 0.3);
    }
  }

  playFinishSound() {
    this.playTone(800, 0.1, 'sine', 0.4);
    setTimeout(() => this.playTone(1000, 0.1, 'sine', 0.4), 100);
    setTimeout(() => this.playTone(1200, 0.2, 'sine', 0.4), 200);
  }

  setVolume(volume) {
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  toggleMetronome(enabled) {
    coachConfig.set('enableMetronome', enabled);
  }
}

export default new AudioPlayer();
