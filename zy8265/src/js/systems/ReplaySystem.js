export class ReplaySystem {
  constructor() {
    this.replayData = [];
    this.isPlaying = false;
    this.currentStep = 0;
    this.onStepCallback = null;
    this.onCompleteCallback = null;
    this.playbackSpeed = 500;
  }

  recordState(state) {
    this.replayData.push({
      ...state,
      timestamp: Date.now()
    });
  }

  clear() {
    this.replayData = [];
    this.currentStep = 0;
    this.isPlaying = false;
  }

  getStepCount() {
    return this.replayData.length;
  }

  getStep(index) {
    if (index >= 0 && index < this.replayData.length) {
      return this.replayData[index];
    }
    return null;
  }

  startPlayback(onStep, onComplete, speed = 500) {
    if (this.replayData.length === 0) return false;
    
    this.isPlaying = true;
    this.currentStep = 0;
    this.playbackSpeed = speed;
    this.onStepCallback = onStep;
    this.onCompleteCallback = onComplete;
    
    this.playNextStep();
    return true;
  }

  playNextStep() {
    if (!this.isPlaying) return;
    
    if (this.currentStep >= this.replayData.length) {
      this.stopPlayback();
      if (this.onCompleteCallback) {
        this.onCompleteCallback();
      }
      return;
    }

    const step = this.replayData[this.currentStep];
    if (this.onStepCallback) {
      this.onStepCallback(step, this.currentStep, this.replayData.length);
    }

    this.currentStep++;

    setTimeout(() => {
      this.playNextStep();
    }, this.playbackSpeed);
  }

  stopPlayback() {
    this.isPlaying = false;
  }

  isPlayingBack() {
    return this.isPlaying;
  }

  getCurrentStep() {
    return this.currentStep;
  }

  setPlaybackSpeed(speed) {
    this.playbackSpeed = speed;
  }

  generateSummary() {
    if (this.replayData.length === 0) {
      return { hasData: false };
    }

    const firstStep = this.replayData[0];
    const lastStep = this.replayData[this.replayData.length - 1];
    
    const moves = this.replayData.filter(s => s.moveType === 'move').length;
    const pushes = this.replayData.filter(s => s.moveType === 'push').length;
    
    const violations = {
      humidity: 0,
      patrol: 0,
      box_stuck: 0,
      elevator_overload: 0
    };

    this.replayData.forEach(step => {
      if (step.violations) {
        step.violations.forEach(v => {
          if (violations[v.type] !== undefined) {
            violations[v.type]++;
          }
        });
      }
    });

    const startTime = firstStep.timestamp;
    const endTime = lastStep.timestamp;
    const duration = (endTime - startTime) / 1000;

    return {
      hasData: true,
      totalSteps: this.replayData.length,
      moves,
      pushes,
      violations,
      totalViolations: violations.humidity + violations.patrol + 
                       violations.box_stuck + violations.elevator_overload,
      duration: duration.toFixed(2),
      boxesDelivered: lastStep.boxesDelivered || 0,
      totalBoxes: firstStep.totalBoxes || 0,
      finalScore: lastStep.score || 0,
      startTime: new Date(startTime).toLocaleString(),
      endTime: new Date(endTime).toLocaleString()
    };
  }

  exportReplay() {
    return JSON.stringify({
      version: '1.0',
      data: this.replayData,
      exportedAt: Date.now()
    });
  }

  importReplay(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.version === '1.0' && parsed.data) {
        this.replayData = parsed.data;
        return true;
      }
    } catch (e) {
      console.error('Failed to import replay:', e);
    }
    return false;
  }
}
