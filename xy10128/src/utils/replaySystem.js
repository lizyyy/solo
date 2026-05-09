export class ReplaySystem {
  constructor(scene, instruments, onInstrumentUpdate, onValidationUpdate) {
    this.scene = scene;
    this.instruments = instruments;
    this.onInstrumentUpdate = onInstrumentUpdate;
    this.onValidationUpdate = onValidationUpdate;
    
    this.isPlaying = false;
    this.isPaused = false;
    this.currentFrame = 0;
    this.frames = [];
    this.playbackSpeed = 1;
    this.animationId = null;
    this.lastFrameTime = 0;
    this.frameInterval = 100;
    
    this.handleFrame = this.handleFrame.bind(this);
  }

  recordFrame(instruments, validationResults) {
    const frameData = {
      timestamp: Date.now(),
      instruments: {}
    };

    Object.entries(instruments).forEach(([id, instrument]) => {
      if (instrument.userData.isInstrument) {
        frameData.instruments[id] = {
          position: {
            x: instrument.position.x,
            y: instrument.position.y,
            z: instrument.position.z
          },
          rotation: {
            x: instrument.rotation.x,
            y: instrument.rotation.y,
            z: instrument.rotation.z
          }
        };
      }
    });

    if (validationResults) {
      frameData.validation = {
        issues: validationResults.issues.length,
        highSeverity: validationResults.highSeverityIssues.length,
        mediumSeverity: validationResults.mediumSeverityIssues.length,
        isValid: validationResults.isValid
      };
    }

    this.frames.push(frameData);
    return this.frames.length - 1;
  }

  startRecording() {
    this.frames = [];
    this.isRecording = true;
  }

  stopRecording() {
    this.isRecording = false;
  }

  getRecording() {
    return {
      frameCount: this.frames.length,
      frames: this.frames,
      duration: this.frames.length * this.frameInterval
    };
  }

  loadRecording(recording) {
    if (!recording || !recording.frames || recording.frames.length === 0) {
      throw new Error('Invalid recording data');
    }
    
    this.frames = recording.frames;
    this.currentFrame = 0;
    this.isPlaying = false;
    this.isPaused = false;
  }

  play() {
    if (this.frames.length === 0) {
      console.warn('No frames to play');
      return;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.lastFrameTime = performance.now();
    this.animate();
  }

  pause() {
    this.isPaused = true;
    this.isPlaying = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.currentFrame = 0;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    if (this.frames.length > 0) {
      this.applyFrame(0);
    }
  }

  seekTo(frameIndex) {
    if (frameIndex < 0 || frameIndex >= this.frames.length) {
      console.warn('Frame index out of range');
      return;
    }
    
    this.currentFrame = frameIndex;
    this.applyFrame(frameIndex);
  }

  seekForward(frames = 10) {
    const newFrame = Math.min(this.currentFrame + frames, this.frames.length - 1);
    this.seekTo(newFrame);
  }

  seekBackward(frames = 10) {
    const newFrame = Math.max(this.currentFrame - frames, 0);
    this.seekTo(newFrame);
  }

  setPlaybackSpeed(speed) {
    this.playbackSpeed = Math.max(0.1, Math.min(5, speed));
  }

  animate() {
    if (!this.isPlaying || this.isPaused) return;
    
    const now = performance.now();
    const elapsed = now - this.lastFrameTime;
    const interval = this.frameInterval / this.playbackSpeed;

    if (elapsed >= interval) {
      this.handleFrame();
      this.lastFrameTime = now;
    }

    this.animationId = requestAnimationFrame(this.animate);
  }

  handleFrame() {
    if (this.currentFrame < this.frames.length - 1) {
      this.currentFrame++;
      this.applyFrame(this.currentFrame);
    } else {
      this.isPlaying = false;
      this.isPaused = false;
    }
  }

  applyFrame(frameIndex) {
    const frame = this.frames[frameIndex];
    if (!frame) return;

    Object.entries(frame.instruments).forEach(([id, data]) => {
      const instrument = this.instruments[id];
      if (instrument) {
        instrument.position.set(
          data.position.x,
          data.position.y,
          data.position.z
        );
        instrument.rotation.set(
          data.rotation.x,
          data.rotation.y,
          data.rotation.z
        );
        
        if (this.onInstrumentUpdate) {
          this.onInstrumentUpdate(instrument);
        }
      }
    });

    if (this.onValidationUpdate && frame.validation) {
      this.onValidationUpdate(frame.validation);
    }
  }

  getCurrentFrame() {
    return this.currentFrame;
  }

  getTotalFrames() {
    return this.frames.length;
  }

  getProgress() {
    if (this.frames.length === 0) return 0;
    return this.currentFrame / (this.frames.length - 1);
  }

  isPlaying() {
    return this.isPlaying && !this.isPaused;
  }

  isPaused() {
    return this.isPaused;
  }

  clearRecording() {
    this.stop();
    this.frames = [];
    this.currentFrame = 0;
  }

  exportRecording() {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      frameCount: this.frames.length,
      frameInterval: this.frameInterval,
      duration: this.frames.length * this.frameInterval,
      frames: this.frames
    };
  }

  importRecording(data) {
    if (!data || !data.frames || data.frames.length === 0) {
      throw new Error('Invalid recording data');
    }
    
    this.frames = data.frames;
    this.frameInterval = data.frameInterval || 100;
    this.currentFrame = 0;
    this.isPlaying = false;
    this.isPaused = false;
  }

  dispose() {
    this.stop();
    this.clearRecording();
  }
}

export function createReplayTimeline(replaySystem) {
  const timeline = document.createElement('div');
  timeline.className = 'replay-timeline';
  
  const progressBar = document.createElement('div');
  progressBar.className = 'timeline-progress';
  
  const playButton = document.createElement('button');
  playButton.textContent = '▶ 播放';
  playButton.onclick = () => {
    if (replaySystem.isPlaying()) {
      replaySystem.pause();
      playButton.textContent = '▶ 播放';
    } else {
      replaySystem.play();
      playButton.textContent = '⏸ 暂停';
    }
  };
  
  const stopButton = document.createElement('button');
  stopButton.textContent = '⏹ 停止';
  stopButton.onclick = () => {
    replaySystem.stop();
    playButton.textContent = '▶ 播放';
  };

  const frameInfo = document.createElement('span');
  frameInfo.className = 'frame-info';
  frameInfo.textContent = `0 / 0`;

  const updateFrameInfo = () => {
    frameInfo.textContent = `${replaySystem.getCurrentFrame() + 1} / ${replaySystem.getTotalFrames()}`;
    const progress = replaySystem.getProgress() * 100;
    progressBar.style.width = `${progress}%`;
  };

  timeline.appendChild(playButton);
  timeline.appendChild(stopButton);
  timeline.appendChild(frameInfo);

  return {
    timeline,
    updateFrameInfo,
    playButton
  };
}
