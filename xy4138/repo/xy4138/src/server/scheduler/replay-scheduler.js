const EventEmitter = require('events');
const { ControlAction, createTelemetryMessage, createEventMessage, EventType } = require('../protocols');

const PlaybackState = {
  STOPPED: 'stopped',
  PLAYING: 'playing',
  PAUSED: 'paused',
  SEEKING: 'seeking'
};

class ReplayScheduler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.playbackState = PlaybackState.STOPPED;
    this.currentFrameIndex = 0;
    this.playbackSpeed = options.playbackSpeed || 1.0;
    this.loop = options.loop !== false;
    
    this.frames = [];
    this.timeRange = { start: 0, end: 0, duration: 0 };
    this.currentTimestamp = 0;
    
    this.lastFrameTime = 0;
    this.accumulatedTime = 0;
    this.playbackInterval = null;
    this.targetFrameRate = options.targetFrameRate || 60;
    
    this.stats = {
      framesPlayed: 0,
      playbackStartTime: null,
      playbackDuration: 0
    };
  }

  loadFrames(frames) {
    if (!frames || frames.length === 0) {
      throw new Error('No frames to load');
    }

    this.frames = [...frames].sort((a, b) => a.timestamp - b.timestamp);
    
    const startFrame = this.frames[0];
    const endFrame = this.frames[this.frames.length - 1];
    
    this.timeRange = {
      start: startFrame.timestamp,
      end: endFrame.timestamp,
      duration: endFrame.timestamp - startFrame.timestamp
    };
    
    this.currentFrameIndex = 0;
    this.currentTimestamp = this.timeRange.start;
    this.playbackState = PlaybackState.STOPPED;
    
    this.emit('framesLoaded', {
      frameCount: this.frames.length,
      timeRange: this.timeRange
    });
    
    return {
      frameCount: this.frames.length,
      timeRange: this.timeRange
    };
  }

  clearFrames() {
    this.stop();
    this.frames = [];
    this.timeRange = { start: 0, end: 0, duration: 0 };
    this.currentFrameIndex = 0;
    this.currentTimestamp = 0;
    this.emit('framesCleared');
  }

  play() {
    if (this.frames.length === 0) {
      throw new Error('No frames loaded');
    }

    if (this.playbackState === PlaybackState.PLAYING) {
      return;
    }

    if (this.playbackState === PlaybackState.STOPPED) {
      this.currentFrameIndex = 0;
      this.currentTimestamp = this.timeRange.start;
      this.stats.framesPlayed = 0;
      this.stats.playbackStartTime = Date.now();
    }

    this.playbackState = PlaybackState.PLAYING;
    this.lastFrameTime = Date.now();
    this.accumulatedTime = 0;
    
    this._startPlaybackLoop();
    
    this.emit('playbackStarted', {
      timestamp: this.currentTimestamp,
      frameIndex: this.currentFrameIndex,
      speed: this.playbackSpeed
    });
  }

  pause() {
    if (this.playbackState !== PlaybackState.PLAYING) {
      return;
    }

    this.playbackState = PlaybackState.PAUSED;
    this._stopPlaybackLoop();
    
    this.emit('playbackPaused', {
      timestamp: this.currentTimestamp,
      frameIndex: this.currentFrameIndex
    });
  }

  togglePlayPause() {
    if (this.playbackState === PlaybackState.PLAYING) {
      this.pause();
    } else if (this.playbackState === PlaybackState.PAUSED || this.playbackState === PlaybackState.STOPPED) {
      this.play();
    }
  }

  stop() {
    this.playbackState = PlaybackState.STOPPED;
    this._stopPlaybackLoop();
    
    if (this.stats.playbackStartTime) {
      this.stats.playbackDuration += Date.now() - this.stats.playbackStartTime;
      this.stats.playbackStartTime = null;
    }
    
    this.currentFrameIndex = 0;
    this.currentTimestamp = this.timeRange.start;
    
    this.emit('playbackStopped', {
      timestamp: this.currentTimestamp,
      frameIndex: this.currentFrameIndex
    });
  }

  seek(timestamp) {
    if (this.frames.length === 0) {
      throw new Error('No frames loaded');
    }

    const previousState = this.playbackState;
    this.playbackState = PlaybackState.SEEKING;

    const clampedTimestamp = Math.max(
      this.timeRange.start,
      Math.min(timestamp, this.timeRange.end)
    );

    const frameIndex = this._findFrameIndex(clampedTimestamp);
    const frame = this.frames[frameIndex];

    this.currentFrameIndex = frameIndex;
    this.currentTimestamp = frame.timestamp;

    this.emit('seek', {
      fromTimestamp: timestamp,
      toTimestamp: this.currentTimestamp,
      frameIndex: this.currentFrameIndex,
      frame
    });

    if (previousState === PlaybackState.PLAYING) {
      this.playbackState = PlaybackState.PLAYING;
    } else {
      this.playbackState = PlaybackState.PAUSED;
    }

    return {
      timestamp: this.currentTimestamp,
      frameIndex: this.currentFrameIndex,
      frame
    };
  }

  seekToFrame(frameIndex) {
    if (frameIndex < 0 || frameIndex >= this.frames.length) {
      throw new Error(`Frame index out of range: ${frameIndex}`);
    }

    const frame = this.frames[frameIndex];
    return this.seek(frame.timestamp);
  }

  stepForward() {
    if (this.currentFrameIndex < this.frames.length - 1) {
      return this.seekToFrame(this.currentFrameIndex + 1);
    }
    return null;
  }

  stepBackward() {
    if (this.currentFrameIndex > 0) {
      return this.seekToFrame(this.currentFrameIndex - 1);
    }
    return null;
  }

  setSpeed(speed) {
    if (speed <= 0) {
      throw new Error('Speed must be greater than 0');
    }

    const previousSpeed = this.playbackSpeed;
    this.playbackSpeed = speed;

    this.emit('speedChanged', {
      from: previousSpeed,
      to: speed
    });

    return speed;
  }

  setLoop(enabled) {
    this.loop = enabled;
    this.emit('loopChanged', { enabled });
    return enabled;
  }

  getCurrentFrame() {
    if (this.frames.length === 0) {
      return null;
    }
    return this.frames[this.currentFrameIndex];
  }

  getFrameAt(timestamp) {
    const index = this._findFrameIndex(timestamp);
    return this.frames[index];
  }

  getFramesInRange(startTimestamp, endTimestamp) {
    const startIndex = this._findFrameIndex(startTimestamp);
    const endIndex = this._findFrameIndex(endTimestamp);
    return this.frames.slice(startIndex, endIndex + 1);
  }

  getStats() {
    return {
      ...this.stats,
      currentState: this.playbackState,
      currentFrameIndex: this.currentFrameIndex,
      currentTimestamp: this.currentTimestamp,
      playbackSpeed: this.playbackSpeed,
      loop: this.loop,
      timeRange: this.timeRange,
      totalFrames: this.frames.length
    };
  }

  getDuration() {
    return this.timeRange.duration;
  }

  getFrameCount() {
    return this.frames.length;
  }

  getStatus() {
    const stats = this.getStats();
    return {
      isPlaying: stats.currentState === 'playing',
      isPaused: stats.currentState === 'paused',
      isStopped: stats.currentState === 'stopped',
      currentIndex: stats.currentFrameIndex,
      currentTimestamp: stats.currentTimestamp,
      currentState: stats.currentState,
      playbackSpeed: stats.playbackSpeed,
      loop: stats.loop,
      timeRange: stats.timeRange,
      frameCount: stats.totalFrames,
      framesPlayed: stats.framesPlayed
    };
  }

  handleControlAction(action, params = {}) {
    switch (action) {
      case ControlAction.PLAY:
        this.play();
        break;
      case ControlAction.PAUSE:
        this.pause();
        break;
      case ControlAction.STOP:
        this.stop();
        break;
      case ControlAction.SEEK:
        if (params.timestamp !== undefined) {
          this.seek(params.timestamp);
        }
        break;
      case ControlAction.SPEED:
        if (params.speed !== undefined) {
          this.setSpeed(params.speed);
        }
        break;
      case ControlAction.STEP_FORWARD:
        this.stepForward();
        break;
      case ControlAction.STEP_BACKWARD:
        this.stepBackward();
        break;
      default:
        throw new Error(`Unknown control action: ${action}`);
    }
  }

  _startPlaybackLoop() {
    this._stopPlaybackLoop();
    
    const intervalMs = 1000 / this.targetFrameRate;
    
    this.playbackInterval = setInterval(() => {
      this._updatePlayback();
    }, intervalMs);
  }

  _stopPlaybackLoop() {
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
  }

  _updatePlayback() {
    if (this.playbackState !== PlaybackState.PLAYING) {
      return;
    }

    const now = Date.now();
    const deltaTime = (now - this.lastFrameTime) * this.playbackSpeed;
    this.lastFrameTime = now;
    this.accumulatedTime += deltaTime;

    while (this.accumulatedTime >= 0 && this.currentFrameIndex < this.frames.length) {
      const currentFrame = this.frames[this.currentFrameIndex];
      
      if (this.currentFrameIndex + 1 < this.frames.length) {
        const nextFrame = this.frames[this.currentFrameIndex + 1];
        const frameDuration = nextFrame.timestamp - currentFrame.timestamp;
        
        if (this.accumulatedTime >= frameDuration) {
          this.accumulatedTime -= frameDuration;
          this.currentFrameIndex++;
          this.currentTimestamp = currentFrame.timestamp;
          this.stats.framesPlayed++;
          
          this._emitFrame(currentFrame);
        } else {
          break;
        }
      } else {
        this.accumulatedTime = 0;
        this.currentTimestamp = currentFrame.timestamp;
        this.stats.framesPlayed++;
        this._emitFrame(currentFrame);
        
        if (this.loop) {
          this.currentFrameIndex = 0;
          this.currentTimestamp = this.timeRange.start;
          this.emit('loopRestart');
        } else {
          this.stop();
          this.emit('playbackComplete');
        }
        break;
      }
    }
  }

  _emitFrame(frame) {
    const telemetryMsg = createTelemetryMessage({
      timestamp: frame.timestamp,
      sequence: frame.sequence || this.currentFrameIndex,
      data: frame.telemetry || frame,
      latency: frame.latency
    });

    this.emit('frame', telemetryMsg);
  }

  _findFrameIndex(timestamp) {
    if (this.frames.length === 0) {
      return -1;
    }

    if (timestamp <= this.frames[0].timestamp) {
      return 0;
    }

    if (timestamp >= this.frames[this.frames.length - 1].timestamp) {
      return this.frames.length - 1;
    }

    let low = 0;
    let high = this.frames.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const frame = this.frames[mid];

      if (frame.timestamp === timestamp) {
        return mid;
      } else if (frame.timestamp < timestamp) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return Math.max(0, high);
  }
}

module.exports = {
  ReplayScheduler,
  PlaybackState
};
