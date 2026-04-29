const { STORAGE_KEYS, getStorageData, setStorageData, generateId, formatTime } = require('../../utils/storage.js')

Page({
  data: {
    activeTab: 'countdown',
    tabs: [
      { key: 'countdown', name: '倒计时' },
      { key: 'stopwatch', name: '正计时' },
      { key: 'pomodoro', name: '番茄钟' },
      { key: 'history', name: '历史记录' }
    ],
    
    countdownDuration: 25,
    countdownTime: 1500,
    countdownDisplay: '25:00',
    countdownRunning: false,
    countdownPaused: false,
    
    stopwatchTime: 0,
    stopwatchDisplay: '00:00:00',
    stopwatchRunning: false,
    stopwatchLaps: [],
    
    pomodoroPhase: 'work',
    pomodoroWorkDuration: 25,
    pomodoroBreakDuration: 5,
    pomodoroTime: 1500,
    pomodoroDisplay: '25:00',
    pomodoroRunning: false,
    pomodoroCycle: 1,
    pomodoroCompleted: 0,
    
    projectName: '',
    showProjectInput: false,
    currentSession: null,
    
    history: []
  },

  timerInterval: null,

  onLoad() {
    this.loadHistory()
  },

  onUnload() {
    this.stopAllTimers()
  },

  onHide() {
    this.stopAllTimers()
  },

  loadHistory() {
    const history = getStorageData(STORAGE_KEYS.SEWING_SESSIONS)
      .filter(s => s.completed)
      .sort((a, b) => b.startTime - a.startTime)
    this.setData({ history })
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab !== this.data.activeTab) {
      this.stopAllTimers()
      this.setData({ activeTab: tab })
      
      if (tab === 'countdown') {
        this.resetCountdown()
      } else if (tab === 'stopwatch') {
        this.resetStopwatch()
      } else if (tab === 'pomodoro') {
        this.resetPomodoro()
      }
    }
  },

  stopAllTimers() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
  },

  onCountdownInput(e) {
    const value = parseInt(e.detail.value) || 0
    this.setData({ 
      countdownDuration: value,
      countdownTime: value * 60,
      countdownDisplay: this.formatCountdownDisplay(value * 60)
    })
  },

  startCountdown() {
    if (!this.data.countdownRunning && !this.data.countdownPaused) {
      this.setData({ showProjectInput: true })
      return
    }
    
    if (this.data.countdownPaused) {
      this.resumeCountdown()
      return
    }
  },

  onProjectInput(e) {
    this.setData({ projectName: e.detail.value })
  },

  hideProjectInput() {
    this.setData({ showProjectInput: false })
  },

  confirmProject() {
    const projectName = this.data.projectName.trim() || '未命名项目'
    
    const session = {
      id: generateId(),
      projectName: projectName,
      type: 'countdown',
      duration: this.data.countdownTime,
      startTime: Date.now(),
      actualDuration: 0,
      completed: false,
      interrupted: false,
      notes: '',
      createTime: Date.now()
    }

    this.setData({ 
      showProjectInput: false,
      countdownRunning: true,
      countdownPaused: false,
      currentSession: session
    })

    this.runCountdownTimer()
  },

  runCountdownTimer() {
    this.timerInterval = setInterval(() => {
      let time = this.data.countdownTime - 1
      
      if (time <= 0) {
        this.completeCountdown()
      } else {
        this.setData({
          countdownTime: time,
          countdownDisplay: this.formatCountdownDisplay(time)
        })
      }
    }, 1000)
  },

  pauseCountdown() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
    this.setData({ countdownRunning: false, countdownPaused: true })
  },

  resumeCountdown() {
    this.setData({ countdownRunning: true, countdownPaused: false })
    this.runCountdownTimer()
  },

  resetCountdown() {
    this.stopAllTimers()
    const duration = this.data.countdownDuration || 25
    this.setData({
      countdownTime: duration * 60,
      countdownDisplay: this.formatCountdownDisplay(duration * 60),
      countdownRunning: false,
      countdownPaused: false,
      showProjectInput: false,
      currentSession: null
    })
  },

  completeCountdown() {
    this.stopAllTimers()
    
    const session = this.data.currentSession
    if (session) {
      session.actualDuration = session.duration
      session.endTime = Date.now()
      session.completed = true
      
      const history = getStorageData(STORAGE_KEYS.SEWING_SESSIONS)
      history.push(session)
      setStorageData(STORAGE_KEYS.SEWING_SESSIONS, history)
    }

    wx.vibrateLong()
    wx.showModal({
      title: '计时完成',
      content: `项目: ${session ? session.projectName : '未命名'}\n用时: ${this.formatCountdownDisplay(session ? session.duration : this.data.countdownDuration * 60)}`,
      showCancel: false,
      success: () => {
        this.resetCountdown()
        this.loadHistory()
      }
    })
  },

  formatCountdownDisplay(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  },

  startStopwatch() {
    if (this.data.stopwatchRunning) return
    
    if (this.data.stopwatchTime === 0) {
      this.setData({ showProjectInput: true })
      return
    }
    
    this.resumeStopwatch()
  },

  confirmStopwatchProject() {
    const projectName = this.data.projectName.trim() || '未命名项目'
    
    const session = {
      id: generateId(),
      projectName: projectName,
      type: 'stopwatch',
      duration: 0,
      startTime: Date.now(),
      actualDuration: 0,
      completed: false,
      interrupted: false,
      notes: '',
      createTime: Date.now()
    }

    this.setData({ 
      showProjectInput: false,
      stopwatchRunning: true,
      currentSession: session
    })

    this.runStopwatchTimer()
  },

  runStopwatchTimer() {
    this.timerInterval = setInterval(() => {
      const time = this.data.stopwatchTime + 1
      this.setData({
        stopwatchTime: time,
        stopwatchDisplay: this.formatStopwatchDisplay(time)
      })
    }, 1000)
  },

  pauseStopwatch() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
    this.setData({ stopwatchRunning: false })
  },

  resumeStopwatch() {
    this.setData({ stopwatchRunning: true })
    this.runStopwatchTimer()
  },

  lapStopwatch() {
    const lap = {
      index: this.data.stopwatchLaps.length + 1,
      time: this.data.stopwatchTime,
      display: this.data.stopwatchDisplay
    }
    this.setData({
      stopwatchLaps: [lap, ...this.data.stopwatchLaps]
    })
  },

  stopStopwatch() {
    this.stopAllTimers()
    
    const session = this.data.currentSession
    if (session && this.data.stopwatchTime > 0) {
      session.actualDuration = this.data.stopwatchTime
      session.endTime = Date.now()
      session.completed = true
      
      const history = getStorageData(STORAGE_KEYS.SEWING_SESSIONS)
      history.push(session)
      setStorageData(STORAGE_KEYS.SEWING_SESSIONS, history)
      
      wx.showToast({ title: '记录已保存', icon: 'success' })
    }
    
    this.resetStopwatch()
    this.loadHistory()
  },

  resetStopwatch() {
    this.stopAllTimers()
    this.setData({
      stopwatchTime: 0,
      stopwatchDisplay: '00:00:00',
      stopwatchRunning: false,
      stopwatchLaps: [],
      showProjectInput: false,
      currentSession: null
    })
  },

  formatStopwatchDisplay(seconds) {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  },

  startPomodoro() {
    if (this.data.pomodoroRunning) return
    
    if (!this.data.currentSession) {
      this.setData({ showProjectInput: true })
      return
    }
    
    this.resumePomodoro()
  },

  confirmPomodoroProject() {
    const projectName = this.data.projectName.trim() || '番茄钟任务'
    
    const session = {
      id: generateId(),
      projectName: projectName,
      type: 'pomodoro',
      duration: this.data.pomodoroTime,
      startTime: Date.now(),
      actualDuration: 0,
      completed: false,
      interrupted: false,
      pomodoroPhase: 'work',
      pomodoroCycle: this.data.pomodoroCycle,
      notes: '',
      createTime: Date.now()
    }

    this.setData({ 
      showProjectInput: false,
      pomodoroRunning: true,
      currentSession: session
    })

    this.runPomodoroTimer()
  },

  runPomodoroTimer() {
    this.timerInterval = setInterval(() => {
      let time = this.data.pomodoroTime - 1
      
      if (time <= 0) {
        this.completePomodoroPhase()
      } else {
        this.setData({
          pomodoroTime: time,
          pomodoroDisplay: this.formatCountdownDisplay(time)
        })
      }
    }, 1000)
  },

  completePomodoroPhase() {
    this.stopAllTimers()
    
    const isWorkPhase = this.data.pomodoroPhase === 'work'
    
    wx.vibrateLong()
    
    if (isWorkPhase) {
      const newCompleted = this.data.pomodoroCompleted + 1
      this.setData({ 
        pomodoroPhase: 'break',
        pomodoroCompleted: newCompleted,
        pomodoroTime: this.data.pomodoroBreakDuration * 60,
        pomodoroDisplay: this.formatCountdownDisplay(this.data.pomodoroBreakDuration * 60)
      })
      
      wx.showModal({
        title: '工作时间结束',
        content: `第 ${this.data.pomodoroCycle} 个番茄钟完成！\n休息 ${this.data.pomodoroBreakDuration} 分钟吧～`,
        showCancel: false,
        success: () => {
          this.setData({ pomodoroRunning: true })
          this.runPomodoroTimer()
        }
      })
    } else {
      const newCycle = this.data.pomodoroCycle + 1
      this.setData({ 
        pomodoroPhase: 'work',
        pomodoroCycle: newCycle,
        pomodoroTime: this.data.pomodoroWorkDuration * 60,
        pomodoroDisplay: this.formatCountdownDisplay(this.data.pomodoroWorkDuration * 60)
      })
      
      wx.showModal({
        title: '休息时间结束',
        content: `开始第 ${newCycle} 个番茄钟？\n工作 ${this.data.pomodoroWorkDuration} 分钟`,
        success: (res) => {
          if (res.confirm) {
            this.setData({ pomodoroRunning: true })
            this.runPomodoroTimer()
          }
        }
      })
    }
  },

  pausePomodoro() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
    this.setData({ pomodoroRunning: false })
  },

  resumePomodoro() {
    this.setData({ pomodoroRunning: true })
    this.runPomodoroTimer()
  },

  resetPomodoro() {
    this.stopAllTimers()
    this.setData({
      pomodoroPhase: 'work',
      pomodoroTime: this.data.pomodoroWorkDuration * 60,
      pomodoroDisplay: this.formatCountdownDisplay(this.data.pomodoroWorkDuration * 60),
      pomodoroRunning: false,
      pomodoroCycle: 1,
      showProjectInput: false,
      currentSession: null
    })
  },

  onWorkDurationChange(e) {
    const value = parseInt(e.detail.value) || 25
    this.setData({ 
      pomodoroWorkDuration: value,
      pomodoroTime: value * 60,
      pomodoroDisplay: this.formatCountdownDisplay(value * 60)
    })
  },

  onBreakDurationChange(e) {
    const value = parseInt(e.detail.value) || 5
    this.setData({ pomodoroBreakDuration: value })
  },

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}分${secs > 0 ? secs + '秒' : ''}`
    }
    return `${secs}秒`
  },

  deleteHistory(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          const history = getStorageData(STORAGE_KEYS.SEWING_SESSIONS)
          const updated = history.filter(h => h.id !== id)
          setStorageData(STORAGE_KEYS.SEWING_SESSIONS, updated)
          this.loadHistory()
          wx.showToast({ title: '删除成功', icon: 'success' })
        }
      }
    })
  }
})
