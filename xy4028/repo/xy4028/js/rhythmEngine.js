/**
 * 节拍/评分算法模块
 * 处理按压节奏的检测、评估和评分
 */

import coachConfig from './coachConfig.js';

export const PRESS_STATUS = {
  TOO_FAST: 'too_fast',
  TOO_SLOW: 'too_slow',
  PERFECT: 'perfect',
  GOOD: 'good',
  MISSED: 'missed',
  DOUBLE_TAP: 'double_tap'
};

class RhythmEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.presses = [];
    this.currentStreak = 0;
    this.longestStreak = 0;
    this.stats = {
      tooFast: 0,
      tooSlow: 0,
      perfect: 0,
      good: 0,
      missed: 0,
      doubleTap: 0
    };
    this.lastPressTime = null;
    this.expectedNextTime = null;
    this.listeners = [];
  }

  start(startTime) {
    this.reset();
    this.startTime = startTime;
    const interval = coachConfig.getTargetIntervalMs();
    this.expectedNextTime = startTime + interval;
  }

  press(currentTime) {
    if (!this.startTime) {
      throw new Error('训练尚未开始');
    }

    const result = this.evaluatePress(currentTime);
    this.updateStats(result);
    this.lastPressTime = currentTime;

    const interval = coachConfig.getTargetIntervalMs();
    this.expectedNextTime = currentTime + interval;

    this.presses.push({
      time: currentTime,
      relativeTime: currentTime - this.startTime,
      status: result.status,
      deviation: result.deviation,
      intervalSinceLast: this.lastPressTime ? currentTime - this.lastPressTime : null
    });

    this.notifyListeners('press', this.presses[this.presses.length - 1]);

    return result;
  }

  evaluatePress(currentTime) {
    const tolerance = coachConfig.get('errorToleranceMs');
    const { min, max, target } = coachConfig.getValidIntervalRange();
    
    if (!this.lastPressTime) {
      return {
        status: PRESS_STATUS.GOOD,
        deviation: 0,
        details: '第一次按压'
      };
    }

    const actualInterval = currentTime - this.lastPressTime;
    const deviation = actualInterval - target;

    const doubleTapThreshold = min * 0.6;
    if (actualInterval < doubleTapThreshold) {
      return {
        status: PRESS_STATUS.DOUBLE_TAP,
        deviation,
        details: '连击误触'
      };
    }

    const perfectThreshold = tolerance * 0.5;
    if (Math.abs(deviation) <= perfectThreshold) {
      return {
        status: PRESS_STATUS.PERFECT,
        deviation,
        details: '完美'
      };
    }

    if (actualInterval >= min && actualInterval <= max) {
      return {
        status: PRESS_STATUS.GOOD,
        deviation,
        details: '合格'
      };
    }

    if (actualInterval < min) {
      return {
        status: PRESS_STATUS.TOO_FAST,
        deviation,
        details: '过快'
      };
    }

    if (actualInterval > max) {
      return {
        status: PRESS_STATUS.TOO_SLOW,
        deviation,
        details: '过慢'
      };
    }

    return {
      status: PRESS_STATUS.GOOD,
      deviation,
      details: '合格'
    };
  }

  updateStats(result) {
    switch (result.status) {
      case PRESS_STATUS.PERFECT:
        this.stats.perfect++;
        this.currentStreak++;
        this.longestStreak = Math.max(this.longestStreak, this.currentStreak);
        break;
      case PRESS_STATUS.GOOD:
        this.stats.good++;
        this.currentStreak++;
        this.longestStreak = Math.max(this.longestStreak, this.currentStreak);
        break;
      case PRESS_STATUS.TOO_FAST:
        this.stats.tooFast++;
        this.currentStreak = 0;
        break;
      case PRESS_STATUS.TOO_SLOW:
        this.stats.tooSlow++;
        this.currentStreak = 0;
        break;
      case PRESS_STATUS.MISSED:
        this.stats.missed++;
        this.currentStreak = 0;
        break;
      case PRESS_STATUS.DOUBLE_TAP:
        this.stats.doubleTap++;
        this.currentStreak = 0;
        break;
    }
  }

  checkMissed(currentTime) {
    if (!this.expectedNextTime || !this.lastPressTime) {
      return null;
    }

    const { max } = coachConfig.getValidIntervalRange();
    const missedThreshold = this.expectedNextTime + max * 0.5;

    if (currentTime > missedThreshold) {
      const missedPress = {
        time: currentTime,
        relativeTime: currentTime - this.startTime,
        status: PRESS_STATUS.MISSED,
        deviation: currentTime - this.expectedNextTime,
        intervalSinceLast: currentTime - this.lastPressTime
      };

      this.presses.push(missedPress);
      this.stats.missed++;
      this.currentStreak = 0;

      const interval = coachConfig.getTargetIntervalMs();
      this.expectedNextTime = currentTime + interval;

      this.notifyListeners('missed', missedPress);

      return missedPress;
    }

    return null;
  }

  getStats() {
    return { ...this.stats };
  }

  getPresses() {
    return [...this.presses];
  }

  getRecentPresses(count = 10) {
    return this.presses.slice(-count);
  }

  calculateScore(durationMs) {
    if (this.presses.length === 0) {
      return this.generateEmptyScore();
    }

    const validPresses = this.presses.filter(p => 
      p.status !== PRESS_STATUS.MISSED && p.status !== PRESS_STATUS.DOUBLE_TAP
    );

    const totalPresses = validPresses.length;
    const goodPresses = this.stats.perfect + this.stats.good;
    const accuracy = totalPresses > 0 ? goodPresses / totalPresses : 0;

    let averageBPM = 0;
    if (validPresses.length >= 2) {
      const firstPress = validPresses[0];
      const lastPress = validPresses[validPresses.length - 1];
      const timeSpan = lastPress.time - firstPress.time;
      if (timeSpan > 0) {
        averageBPM = ((validPresses.length - 1) / timeSpan) * 60000;
      }
    }

    const deviations = validPresses
      .filter(p => p.deviation !== null)
      .map(p => Math.abs(p.deviation));
    
    const stability = deviations.length > 0
      ? 1 - (deviations.reduce((a, b) => a + b, 0) / deviations.length / 500)
      : 0;

    const suggestions = this.generateSuggestions();

    return {
      totalPresses,
      validPresses: goodPresses,
      accuracy: Math.round(accuracy * 100),
      averageBPM: Math.round(averageBPM),
      stability: Math.round(Math.max(0, stability) * 100),
      longestStreak: this.longestStreak,
      tooFastCount: this.stats.tooFast,
      tooSlowCount: this.stats.tooSlow,
      missedCount: this.stats.missed,
      doubleTapCount: this.stats.doubleTap,
      perfectCount: this.stats.perfect,
      durationMs,
      suggestions,
      overallScore: Math.round(
        accuracy * 60 + 
        Math.max(0, stability) * 30 + 
        (this.longestStreak / Math.max(totalPresses, 1)) * 10
      )
    };
  }

  generateEmptyScore() {
    return {
      totalPresses: 0,
      validPresses: 0,
      accuracy: 0,
      averageBPM: 0,
      stability: 0,
      longestStreak: 0,
      tooFastCount: 0,
      tooSlowCount: 0,
      missedCount: 0,
      doubleTapCount: 0,
      perfectCount: 0,
      durationMs: 0,
      suggestions: ['本次训练没有进行任何按压，请尝试按空格键或点击屏幕'],
      overallScore: 0
    };
  }

  generateSuggestions() {
    const suggestions = [];

    if (this.stats.tooFast > this.stats.tooSlow) {
      suggestions.push('您的按压节奏偏快，建议放慢速度，保持在100-120次/分钟');
    } else if (this.stats.tooSlow > this.stats.tooFast) {
      suggestions.push('您的按压节奏偏慢，建议加快速度，保持在100-120次/分钟');
    }

    if (this.stats.missed > 2) {
      suggestions.push('有较多漏拍，建议专注于保持连续的按压节奏');
    }

    if (this.stats.doubleTap > 1) {
      suggestions.push('存在连击误触，建议确保每次按压后完全放松再进行下一次');
    }

    if (this.longestStreak < 5) {
      suggestions.push('连续合格段较短，建议多练习以提高节奏稳定性');
    }

    if (suggestions.length === 0) {
      suggestions.push('表现优秀！继续保持当前的节奏稳定性');
    }

    return suggestions;
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners(type, data) {
    this.listeners.forEach(l => l({ type, data }));
  }
}

export default new RhythmEngine();
