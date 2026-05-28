export class ReplaySystem {
  constructor(turnManager) {
    this.turnManager = turnManager
    this.isReplaying = false
    this.currentReplayTurn = 0
    this.replaySpeed = 1000
    this.replayInterval = null
    this.onReplayStep = null
    this.onReplayComplete = null
  }

  startReplay(startTurn = 0) {
    if (this.turnManager.history.length === 0) return false
    
    this.isReplaying = true
    this.currentReplayTurn = startTurn
    this.playNextFrame()
    
    return true
  }

  playNextFrame() {
    if (!this.isReplaying) return

    const state = this.turnManager.getStateAtTurn(this.currentReplayTurn)
    
    if (state) {
      if (this.onReplayStep) {
        this.onReplayStep(state, this.currentReplayTurn)
      }
      
      this.currentReplayTurn++
      
      if (this.currentReplayTurn < this.turnManager.history.length) {
        this.replayInterval = setTimeout(() => {
          this.playNextFrame()
        }, this.replaySpeed)
      } else {
        this.stopReplay()
        if (this.onReplayComplete) {
          this.onReplayComplete()
        }
      }
    } else {
      this.stopReplay()
    }
  }

  stopReplay() {
    this.isReplaying = false
    if (this.replayInterval) {
      clearTimeout(this.replayInterval)
      this.replayInterval = null
    }
  }

  pauseReplay() {
    if (this.replayInterval) {
      clearTimeout(this.replayInterval)
      this.replayInterval = null
    }
  }

  resumeReplay() {
    if (this.isReplaying) {
      this.playNextFrame()
    }
  }

  goToTurn(turn) {
    this.currentReplayTurn = turn
    const state = this.turnManager.getStateAtTurn(turn)
    if (state && this.onReplayStep) {
      this.onReplayStep(state, turn)
    }
    return state
  }

  setSpeed(speedMs) {
    this.replaySpeed = speedMs
  }

  getReplayInfo() {
    return {
      totalTurns: this.turnManager.history.length,
      currentTurn: this.currentReplayTurn,
      isReplaying: this.isReplaying,
      speed: this.replaySpeed
    }
  }

  findFailurePoint() {
    const failures = []
    
    for (let i = 0; i < this.turnManager.history.length; i++) {
      const state = this.turnManager.history[i]
      if (state.ledgerSnapshot) {
        if (state.ledgerSnapshot.status === 'critical' || 
            state.ledgerSnapshot.status === 'failed') {
          failures.push({
            turn: i,
            status: state.ledgerSnapshot.status,
            loadsShed: state.ledgerSnapshot.loadsShed,
            batteryLevel: state.ledgerSnapshot.batteryEndCharge
          })
        }
      }
    }
    
    return failures
  }

  getCriticalTurns() {
    return this.turnManager.history.filter(s => 
      s.ledgerSnapshot && 
      ['warning', 'danger', 'critical', 'failed'].includes(s.ledgerSnapshot.status)
    ).map(s => s.turn)
  }
}
