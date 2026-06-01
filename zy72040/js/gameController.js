class GameController {
  constructor(levelsData) {
    this.levelsData = levelsData;
    this.resourceConfig = levelsData.resourceConfig;
    this.engine = new GameEngine(this.resourceConfig);
    this.historyManager = new HistoryManager();

    this.currentLevel = null;
    this.currentEventIndex = 0;
    this.gameState = 'idle';
    this.startTime = null;
    this.endTime = null;
    this.playerName = '';
    this.levelValidation = null;
    this.canContinue = true;
  }

  getLevels() {
    return this.levelsData.levels || [];
  }

  getLevelById(id) {
    return this.levelsData.levels?.find(l => l.id === id);
  }

  startGame(levelId, playerName = '匿名学员') {
    const level = this.getLevelById(levelId);
    if (!level) {
      return { success: false, error: '未找到指定关卡' };
    }

    this.currentLevel = level;
    this.playerName = playerName;
    this.currentEventIndex = 0;
    this.gameState = 'playing';
    this.startTime = Date.now();
    this.endTime = null;
    this.canContinue = true;

    this.engine.initState();
    this.levelValidation = this.engine.validateLevel(level);

    const events = level.events || [];
    if (events.length === 0) {
      return this.finishGame('empty_level');
    }

    return {
      success: true,
      level,
      state: this.engine.getCurrentState(),
      validation: this.levelValidation,
      currentEvent: events[0],
      eventIndex: 0,
      totalEvents: events.length
    };
  }

  makeDecision(decisionId) {
    if (this.gameState !== 'playing' || !this.canContinue) {
      return { success: false, error: '游戏未进行中或已暂停' };
    }

    const events = this.currentLevel.events || [];
    const currentEvent = events[this.currentEventIndex];

    if (!currentEvent) {
      return this.finishGame('no_more_events');
    }

    const decision = currentEvent.decisions?.find(d => d.id === decisionId);
    if (!decision) {
      return { success: false, error: '未找到指定决策' };
    }

    const result = this.engine.processEvent(currentEvent, decision);

    if (this.engine.hasNegativeResource) {
      this.canContinue = false;
    }

    this.currentEventIndex++;

    if (this.currentEventIndex >= events.length) {
      return {
        success: true,
        eventProcessed: result,
        finished: true,
        ...this.finishGame('completed')
      };
    }

    return {
      success: true,
      eventProcessed: result,
      finished: false,
      state: this.engine.getCurrentState(),
      currentEvent: events[this.currentEventIndex],
      eventIndex: this.currentEventIndex,
      totalEvents: events.length,
      canContinue: this.canContinue
    };
  }

  forceFinish() {
    if (this.gameState === 'playing') {
      return this.finishGame('force_finished');
    }
    return { success: false, error: '游戏未进行中' };
  }

  finishGame(reason = 'completed') {
    this.endTime = Date.now();
    this.gameState = 'finished';

    const gameResult = this.engine.getGameResult();
    const decisionHistory = this.engine.getDecisionHistory();
    const duration = this.endTime - this.startTime;

    const record = {
      levelId: this.currentLevel.id,
      levelName: this.currentLevel.name || '(未命名关卡)',
      playerName: this.playerName,
      startTime: this.startTime,
      endTime: this.endTime,
      duration,
      durationFormatted: Utils.formatDuration(duration),
      finishReason: reason,
      initialState: this.resourceConfig,
      finalState: this.engine.getCurrentState(),
      ...gameResult,
      decisionHistory,
      validation: this.levelValidation,
      resourceConfig: this.resourceConfig
    };

    const savedRecord = this.historyManager.saveGameRecord(record);

    return {
      success: true,
      finished: true,
      reason,
      recordId: savedRecord.id,
      result: gameResult,
      decisionHistory,
      duration,
      durationFormatted: Utils.formatDuration(duration),
      canContinue: this.canContinue,
      needsManualReview: gameResult.status === 'needs_manual_review'
    };
  }

  getCurrentState() {
    return {
      gameState: this.gameState,
      currentLevel: this.currentLevel,
      currentEventIndex: this.currentEventIndex,
      totalEvents: this.currentLevel?.events?.length || 0,
      resourceState: this.engine.getCurrentState(),
      canContinue: this.canContinue,
      playerName: this.playerName
    };
  }

  getHistoryManager() {
    return this.historyManager;
  }

  getResourceStatusClass(resource, value) {
    const config = this.resourceConfig[resource];
    if (!config) return '';

    if (config.flood !== undefined && value >= config.flood) return 'status-danger';
    if (config.warning !== undefined && value >= config.warning) return 'status-warning';
    if (value < 0) return 'status-negative';
    return 'status-normal';
  }
}
