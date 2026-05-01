/**
 * 游戏状态机模块
 * 管理训练流程的状态转换
 */

export const STATES = {
  IDLE: 'idle',
  CONFIGURING: 'configuring',
  COUNTDOWN: 'countdown',
  TRAINING: 'training',
  PAUSED: 'paused',
  FINISHED: 'finished',
  COACH_MODE: 'coach_mode',
  HISTORY: 'history'
};

export const TRANSITIONS = {
  START_CONFIGURATION: 'start_configuration',
  START_COUNTDOWN: 'start_countdown',
  START_TRAINING: 'start_training',
  PAUSE: 'pause',
  RESUME: 'resume',
  FINISH: 'finish',
  RESET: 'reset',
  ENTER_COACH_MODE: 'enter_coach_mode',
  EXIT_COACH_MODE: 'exit_coach_mode',
  ENTER_HISTORY: 'enter_history',
  EXIT_HISTORY: 'exit_history'
};

class StateMachine {
  constructor() {
    this.currentState = STATES.IDLE;
    this.listeners = [];
    this.previousState = null;
  }

  getState() {
    return this.currentState;
  }

  canTransition(transition) {
    const transitions = {
      [STATES.IDLE]: {
        [TRANSITIONS.START_CONFIGURATION]: STATES.CONFIGURING,
        [TRANSITIONS.ENTER_COACH_MODE]: STATES.COACH_MODE,
        [TRANSITIONS.ENTER_HISTORY]: STATES.HISTORY
      },
      [STATES.CONFIGURING]: {
        [TRANSITIONS.START_COUNTDOWN]: STATES.COUNTDOWN,
        [TRANSITIONS.RESET]: STATES.IDLE
      },
      [STATES.COUNTDOWN]: {
        [TRANSITIONS.START_TRAINING]: STATES.TRAINING,
        [TRANSITIONS.RESET]: STATES.IDLE
      },
      [STATES.TRAINING]: {
        [TRANSITIONS.PAUSE]: STATES.PAUSED,
        [TRANSITIONS.FINISH]: STATES.FINISHED
      },
      [STATES.PAUSED]: {
        [TRANSITIONS.RESUME]: STATES.TRAINING,
        [TRANSITIONS.RESET]: STATES.IDLE
      },
      [STATES.FINISHED]: {
        [TRANSITIONS.RESET]: STATES.IDLE
      },
      [STATES.COACH_MODE]: {
        [TRANSITIONS.EXIT_COACH_MODE]: STATES.IDLE
      },
      [STATES.HISTORY]: {
        [TRANSITIONS.EXIT_HISTORY]: STATES.IDLE
      }
    };

    return transitions[this.currentState] && transitions[this.currentState][transition];
  }

  transition(transition) {
    const nextState = this.canTransition(transition);
    if (!nextState) {
      throw new Error(`无法从 ${this.currentState} 执行 ${transition} 转换`);
    }

    this.previousState = this.currentState;
    this.currentState = nextState;
    this.notifyListeners(transition, this.previousState, this.currentState);
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners(transition, fromState, toState) {
    this.listeners.forEach(l => l({ transition, fromState, toState }));
  }

  isIdle() {
    return this.currentState === STATES.IDLE;
  }

  isTraining() {
    return this.currentState === STATES.TRAINING;
  }

  isPaused() {
    return this.currentState === STATES.PAUSED;
  }

  isFinished() {
    return this.currentState === STATES.FINISHED;
  }

  isCountdown() {
    return this.currentState === STATES.COUNTDOWN;
  }

  isConfiguring() {
    return this.currentState === STATES.CONFIGURING;
  }

  isCoachMode() {
    return this.currentState === STATES.COACH_MODE;
  }

  isHistoryMode() {
    return this.currentState === STATES.HISTORY;
  }
}

export default new StateMachine();
