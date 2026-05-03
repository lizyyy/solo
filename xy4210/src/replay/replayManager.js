/**
 * 回放管理模块
 * 管理游戏回放的记录和播放
 */

import {
  deepClone
} from '../rules/gameRules.js';

/**
 * 创建回放历史
 * @returns {Object[]} 空的回放历史数组
 */
export function createReplayHistory() {
  return [];
}

/**
 * 记录回放步骤
 * @param {Object[]} replayHistory - 回放历史
 * @param {Object} gameState - 当前游戏状态
 * @param {string} action - 执行的动作描述
 * @returns {Object[]} 更新后的回放历史
 */
export function recordReplayStep(replayHistory, gameState, action = '') {
  const step = {
    turn: gameState.turn,
    state: deepClone(gameState),
    action,
    timestamp: Date.now()
  };
  
  return [...replayHistory, step];
}

/**
 * 获取回放总步数
 * @param {Object[]} replayHistory - 回放历史
 * @returns {number} 总步数
 */
export function getReplayTotalSteps(replayHistory) {
  return replayHistory.length;
}

/**
 * 获取指定步骤的回放数据
 * @param {Object[]} replayHistory - 回放历史
 * @param {number} stepIndex - 步骤索引
 * @returns {Object|null} 回放步骤数据
 */
export function getReplayStep(replayHistory, stepIndex) {
  if (stepIndex < 0 || stepIndex >= replayHistory.length) {
    return null;
  }
  
  return deepClone(replayHistory[stepIndex]);
}

/**
 * 回放控制器
 */
export class ReplayController {
  /**
   * 构造函数
   * @param {Object[]} replayHistory - 回放历史
   */
  constructor(replayHistory = []) {
    this.replayHistory = replayHistory;
    this.currentStep = -1;
    this.isPlaying = false;
    this.playInterval = null;
    this.playSpeed = 1000; // 毫秒
    this.onStepChange = null;
    this.onPlayEnd = null;
  }

  /**
   * 设置回放历史
   * @param {Object[]} replayHistory - 回放历史
   */
  setReplayHistory(replayHistory) {
    this.replayHistory = replayHistory;
    this.currentStep = -1;
    this.stop();
  }

  /**
   * 开始播放
   */
  play() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.playInterval = setInterval(() => {
      const hasNext = this.next();
      if (!hasNext) {
        this.stop();
        if (this.onPlayEnd) {
          this.onPlayEnd();
        }
      }
    }, this.playSpeed);
  }

  /**
   * 暂停播放
   */
  pause() {
    this.isPlaying = false;
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
  }

  /**
   * 停止播放
   */
  stop() {
    this.isPlaying = false;
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
  }

  /**
   * 下一步
   * @returns {boolean} 是否成功前进
   */
  next() {
    if (this.currentStep >= this.replayHistory.length - 1) {
      return false;
    }
    
    this.currentStep++;
    this.notifyStepChange();
    return true;
  }

  /**
   * 上一步
   * @returns {boolean} 是否成功后退
   */
  previous() {
    if (this.currentStep <= 0) {
      return false;
    }
    
    this.currentStep--;
    this.notifyStepChange();
    return true;
  }

  /**
   * 跳转到指定步骤
   * @param {number} stepIndex - 步骤索引
   * @returns {boolean} 是否成功跳转
   */
  goToStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= this.replayHistory.length) {
      return false;
    }
    
    this.currentStep = stepIndex;
    this.notifyStepChange();
    return true;
  }

  /**
   * 跳转到第一步
   */
  goToStart() {
    this.currentStep = -1;
    this.notifyStepChange();
  }

  /**
   * 跳转到最后一步
   */
  goToEnd() {
    this.currentStep = this.replayHistory.length - 1;
    this.notifyStepChange();
  }

  /**
   * 设置播放速度
   * @param {number} speed - 播放速度（毫秒/步）
   */
  setPlaySpeed(speed) {
    this.playSpeed = speed;
    if (this.isPlaying) {
      this.pause();
      this.play();
    }
  }

  /**
   * 获取当前步骤
   * @returns {Object|null} 当前步骤数据
   */
  getCurrentStep() {
    if (this.currentStep < 0 || this.currentStep >= this.replayHistory.length) {
      return null;
    }
    
    return deepClone(this.replayHistory[this.currentStep]);
  }

  /**
   * 获取当前步骤索引
   * @returns {number} 当前步骤索引
   */
  getCurrentStepIndex() {
    return this.currentStep;
  }

  /**
   * 获取总步数
   * @returns {number} 总步数
   */
  getTotalSteps() {
    return this.replayHistory.length;
  }

  /**
   * 检查是否正在播放
   * @returns {boolean} 是否正在播放
   */
  getIsPlaying() {
    return this.isPlaying;
  }

  /**
   * 通知步骤变化
   */
  notifyStepChange() {
    if (this.onStepChange) {
      const step = this.getCurrentStep();
      this.onStepChange(step, this.currentStep, this.replayHistory.length);
    }
  }

  /**
   * 设置步骤变化回调
   * @param {Function} callback - 回调函数
   */
  setOnStepChange(callback) {
    this.onStepChange = callback;
  }

  /**
   * 设置播放结束回调
   * @param {Function} callback - 回调函数
   */
  setOnPlayEnd(callback) {
    this.onPlayEnd = callback;
  }

  /**
   * 销毁控制器
   */
  destroy() {
    this.stop();
    this.onStepChange = null;
    this.onPlayEnd = null;
  }
}
