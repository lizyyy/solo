export const GameStates = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  WIN: 'win',
  LOSE: 'lose',
  SUMMARY: 'summary'
};

export class GameStateManager {
  constructor() {
    this.currentState = GameStates.MENU;
    this.previousState = null;
    this.stateChangeHandlers = [];
  }

  getState() {
    return this.currentState;
  }

  setState(newState) {
    this.previousState = this.currentState;
    this.currentState = newState;
    this.notifyStateChange();
  }

  onStateChange(handler) {
    this.stateChangeHandlers.push(handler);
  }

  notifyStateChange() {
    this.stateChangeHandlers.forEach(handler => 
      handler(this.currentState, this.previousState)
    );
  }

  isPlaying() {
    return this.currentState === GameStates.PLAYING;
  }

  canMove() {
    return this.currentState === GameStates.PLAYING;
  }

  isGameOver() {
    return this.currentState === GameStates.WIN || this.currentState === GameStates.LOSE;
  }
}
