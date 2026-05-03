/**
 * 游戏状态管理模块
 * 负责管理游戏的所有状态，包括游戏流程、分数、患者队列等
 */

// 游戏状态枚举
const GameStatus = {
  IDLE: 'idle',         // 空闲状态
  PLAYING: 'playing',   // 游戏进行中
  PAUSED: 'paused',     // 游戏暂停
  COMPLETED: 'completed' // 游戏结束
};

// 分诊区域枚举
const TriageZones = {
  RED: 'red',
  YELLOW: 'yellow',
  GREEN: 'green',
  BLACK: 'black'
};

export const gameState = {
  // 游戏基本信息
  _status: GameStatus.IDLE,
  _currentLevelId: null,
  _currentLevelData: null,
  
  // 游戏时间管理
  _timeLimit: 0,
  _remainingTime: 0,
  _timerInterval: null,
  _startTime: null,
  
  // 分数和连击
  _score: 0,
  _comboCount: 0,
  _maxCombo: 0,
  
  // 患者管理
  _patientQueue: [],
  _processedPatients: [],
  _patientsByZone: {
    red: [],
    yellow: [],
    green: [],
    black: []
  },
  
  // 统计信息
  _correctCount: 0,
  _incorrectCount: 0,
  _totalProcessed: 0,
  _reactionTimes: [],
  
  // 游戏历史记录
  _gameHistory: [],
  
  // 事件回调
  _callbacks: {
    onTimeUpdate: [],
    onScoreUpdate: [],
    onComboUpdate: [],
    onPatientAdded: [],
    onPatientProcessed: [],
    onGameStatusChange: [],
    onGameEnd: []
  },

  /**
   * 初始化游戏状态
   */
  init() {
    this.reset();
    this._loadGameHistory();
  },

  /**
   * 重置游戏状态到初始状态
   */
  reset() {
    this._status = GameStatus.IDLE;
    this._currentLevelId = null;
    this._currentLevelData = null;
    this._timeLimit = 0;
    this._remainingTime = 0;
    this._score = 0;
    this._comboCount = 0;
    this._maxCombo = 0;
    this._patientQueue = [];
    this._processedPatients = [];
    this._patientsByZone = {
      red: [],
      yellow: [],
      green: [],
      black: []
    };
    this._correctCount = 0;
    this._incorrectCount = 0;
    this._totalProcessed = 0;
    this._reactionTimes = [];
    
    // 停止计时器
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
    this._startTime = null;
  },

  /**
   * 开始新游戏
   * @param {string} levelId - 关卡ID
   * @param {Object} levelData - 关卡数据
   */
  startGame(levelId, levelData) {
    // 先重置状态
    this.reset();
    
    // 设置关卡信息
    this._currentLevelId = levelId;
    this._currentLevelData = levelData;
    this._timeLimit = levelData.timeLimit || 300;
    this._remainingTime = this._timeLimit;
    
    // 初始化患者队列
    this._patientQueue = [...levelData.patients];
    
    // 设置游戏状态
    this._status = GameStatus.PLAYING;
    this._startTime = Date.now();
    
    // 启动计时器
    this._startTimer();
    
    // 触发游戏开始事件
    this._triggerCallback('onGameStatusChange', GameStatus.PLAYING);
  },

  /**
   * 暂停游戏
   */
  pauseGame() {
    if (this._status !== GameStatus.PLAYING) {
      return;
    }
    
    this._status = GameStatus.PAUSED;
    
    // 暂停计时器
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
    
    this._triggerCallback('onGameStatusChange', GameStatus.PAUSED);
  },

  /**
   * 恢复游戏
   */
  resumeGame() {
    if (this._status !== GameStatus.PAUSED) {
      return;
    }
    
    this._status = GameStatus.PLAYING;
    
    // 重新启动计时器
    this._startTimer();
    
    this._triggerCallback('onGameStatusChange', GameStatus.PLAYING);
  },

  /**
   * 结束游戏
   */
  endGame() {
    if (this._status === GameStatus.IDLE || this._status === GameStatus.COMPLETED) {
      return;
    }
    
    this._status = GameStatus.COMPLETED;
    
    // 停止计时器
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
    
    // 保存游戏记录
    this._saveGameHistory();
    
    this._triggerCallback('onGameStatusChange', GameStatus.COMPLETED);
    this._triggerCallback('onGameEnd', this.getGameSummary());
  },

  /**
   * 启动计时器
   */
  _startTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
    }
    
    this._timerInterval = setInterval(() => {
      if (this._status === GameStatus.PLAYING) {
        this._remainingTime--;
        
        // 触发时间更新事件
        this._triggerCallback('onTimeUpdate', this._remainingTime);
        
        // 检查时间是否结束
        if (this._remainingTime <= 0) {
          this.endGame();
        }
      }
    }, 1000);
  },

  /**
   * 处理患者分诊
   * @param {string} patientId - 患者ID
   * @param {string} selectedZone - 选择的分诊区域
   * @param {Object} validationResult - 分诊验证结果
   * @param {number} scoreChange - 分数变化
   * @returns {boolean} 是否处理成功
   */
  processPatient(patientId, selectedZone, validationResult, scoreChange) {
    // 查找患者
    const patientIndex = this._patientQueue.findIndex(p => p.id === patientId);
    if (patientIndex === -1) {
      return false;
    }
    
    const patient = this._patientQueue[patientIndex];
    
    // 从队列中移除
    this._patientQueue.splice(patientIndex, 1);
    
    // 计算反应时间
    const currentTime = Date.now();
    const reactionTime = currentTime - this._startTime - 
      (this._timeLimit - this._remainingTime) * 1000 + 
      (this._processedPatients.length * 1000); // 简单估算
    this._reactionTimes.push(reactionTime);
    
    // 更新患者信息
    const processedPatient = {
      ...patient,
      selectedZone,
      correctZone: validationResult.correctZone,
      isCorrect: validationResult.isCorrect,
      errorMessage: validationResult.errorMessage,
      warnings: validationResult.warnings,
      riskHints: validationResult.riskHints,
      scoreChange,
      reactionTime,
      processedAt: new Date().toISOString()
    };
    
    // 添加到已处理列表
    this._processedPatients.push(processedPatient);
    
    // 添加到对应分诊区域
    this._patientsByZone[selectedZone].push(processedPatient);
    
    // 更新统计
    this._totalProcessed++;
    if (validationResult.isCorrect) {
      this._correctCount++;
    } else {
      this._incorrectCount++;
    }
    
    // 更新分数和连击
    this._score += scoreChange;
    // 分数不能为负
    if (this._score < 0) {
      this._score = 0;
    }
    
    // 更新连击（由验证结果中的连击变化决定）
    // 这里的连击逻辑由triageRules.calculateScore处理
    
    // 触发事件
    this._triggerCallback('onScoreUpdate', this._score);
    this._triggerCallback('onPatientProcessed', processedPatient);
    
    // 检查是否所有患者都处理完毕
    if (this._patientQueue.length === 0) {
      this.endGame();
    }
    
    return true;
  },

  /**
   * 获取下一个待处理的患者
   * @returns {Object|null} 患者对象，如果队列为空则返回null
   */
  getNextPatient() {
    if (this._patientQueue.length === 0) {
      return null;
    }
    return this._patientQueue[0];
  },

  /**
   * 获取当前等待队列中的所有患者
   * @returns {Array<Object>} 患者列表
   */
  getPatientQueue() {
    return [...this._patientQueue];
  },

  /**
   * 获取指定分诊区域的患者
   * @param {string} zone - 分诊区域
   * @returns {Array<Object>} 患者列表
   */
  getPatientsByZone(zone) {
    return [...this._patientsByZone[zone] || []];
  },

  /**
   * 获取所有已处理的患者
   * @returns {Array<Object>} 已处理患者列表
   */
  getProcessedPatients() {
    return [...this._processedPatients];
  },

  /**
   * 获取游戏摘要信息
   * @returns {Object} 游戏摘要
   */
  getGameSummary() {
    const totalPatients = this._currentLevelData ? this._currentLevelData.patients.length : 0;
    const accuracy = this._totalProcessed > 0 
      ? Math.round((this._correctCount / this._totalProcessed) * 100) 
      : 0;
    
    const avgReactionTime = this._reactionTimes.length > 0 
      ? Math.round(this._reactionTimes.reduce((a, b) => a + b, 0) / this._reactionTimes.length) 
      : 0;
    
    return {
      levelId: this._currentLevelId,
      levelName: this._currentLevelData ? this._currentLevelData.name : '',
      levelDescription: this._currentLevelData ? this._currentLevelData.description : '',
      timeLimit: this._timeLimit,
      timeUsed: this._timeLimit - this._remainingTime,
      score: this._score,
      maxCombo: this._maxCombo,
      totalPatients,
      totalProcessed: this._totalProcessed,
      correctCount: this._correctCount,
      incorrectCount: this._incorrectCount,
      accuracy,
      avgReactionTime,
      processedPatients: [...this._processedPatients],
      patientsByZone: {
        red: [...this._patientsByZone.red],
        yellow: [...this._patientsByZone.yellow],
        green: [...this._patientsByZone.green],
        black: [...this._patientsByZone.black]
      },
      gameStatus: this._status,
      playedAt: new Date().toISOString()
    };
  },

  /**
   * 获取当前游戏状态
   * @returns {string} 游戏状态
   */
  getStatus() {
    return this._status;
  },

  /**
   * 获取当前分数
   * @returns {number} 分数
   */
  getScore() {
    return this._score;
  },

  /**
   * 获取当前连击数
   * @returns {number} 连击数
   */
  getComboCount() {
    return this._comboCount;
  },

  /**
   * 获取剩余时间
   * @returns {number} 剩余时间（秒）
   */
  getRemainingTime() {
    return this._remainingTime;
  },

  /**
   * 更新连击数
   * @param {number} newCombo - 新的连击数
   */
  updateCombo(newCombo) {
    this._comboCount = newCombo;
    if (newCombo > this._maxCombo) {
      this._maxCombo = newCombo;
    }
    this._triggerCallback('onComboUpdate', this._comboCount, this._maxCombo);
  },

  /**
   * 注册事件回调
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 回调函数
   */
  on(eventName, callback) {
    if (this._callbacks[eventName]) {
      this._callbacks[eventName].push(callback);
    }
  },

  /**
   * 触发事件回调
   * @param {string} eventName - 事件名称
   * @param  {...any} args - 传递给回调的参数
   */
  _triggerCallback(eventName, ...args) {
    if (this._callbacks[eventName]) {
      this._callbacks[eventName].forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in callback for ${eventName}:`, error);
        }
      });
    }
  },

  /**
   * 保存游戏历史到本地存储
   */
  _saveGameHistory() {
    try {
      const summary = this.getGameSummary();
      this._gameHistory.unshift(summary);
      
      // 只保留最近的20条记录
      if (this._gameHistory.length > 20) {
        this._gameHistory = this._gameHistory.slice(0, 20);
      }
      
      localStorage.setItem('triageGameHistory', JSON.stringify(this._gameHistory));
    } catch (error) {
      console.error('Failed to save game history:', error);
    }
  },

  /**
   * 从本地存储加载游戏历史
   */
  _loadGameHistory() {
    try {
      const saved = localStorage.getItem('triageGameHistory');
      if (saved) {
        this._gameHistory = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load game history:', error);
      this._gameHistory = [];
    }
  },

  /**
   * 获取游戏历史记录
   * @returns {Array<Object>} 游戏历史列表
   */
  getGameHistory() {
    return [...this._gameHistory];
  },

  /**
   * 清空游戏历史记录
   */
  clearGameHistory() {
    this._gameHistory = [];
    try {
      localStorage.removeItem('triageGameHistory');
    } catch (error) {
      console.error('Failed to clear game history:', error);
    }
  },

  /**
   * 获取游戏状态常量
   * @returns {Object} 游戏状态枚举
   */
  getGameStatuses() {
    return { ...GameStatus };
  },

  /**
   * 获取分诊区域常量
   * @returns {Object} 分诊区域枚举
   */
  getTriageZones() {
    return { ...TriageZones };
  }
};

export default gameState;
