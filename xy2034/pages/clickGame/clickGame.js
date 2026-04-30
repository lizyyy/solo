const util = require('../../utils/util.js')

Page({
  data: {
    score: 0,
    highScore: 0,
    timeLeft: 30,
    isPlaying: false,
    targetPosition: { x: 50, y: 50 },
    targetSize: 120,
    combo: 0,
    maxCombo: 0,
    showResult: false,
    lastClickTime: 0,
    particles: []
  },

  onLoad: function (options) {
    this.loadHighScore()
  },

  loadHighScore: function () {
    const highScore = wx.getStorageSync('clickGameHighScore') || 0
    this.setData({ highScore: highScore })
  },

  startGame: function () {
    this.setData({
      score: 0,
      timeLeft: 30,
      isPlaying: true,
      combo: 0,
      maxCombo: 0,
      showResult: false,
      lastClickTime: Date.now()
    })
    
    this.moveTarget()
    this.startTimer()
  },

  startTimer: function () {
    this.timer = setInterval(() => {
      const { timeLeft } = this.data
      
      if (timeLeft <= 1) {
        this.endGame()
      } else {
        this.setData({ timeLeft: timeLeft - 1 })
      }
    }, 1000)
  },

  moveTarget: function () {
    const screenWidth = wx.getSystemInfoSync().windowWidth
    const screenHeight = wx.getSystemInfoSync().windowHeight
    
    // 目标大小在80-140之间随机
    const targetSize = 80 + Math.random() * 60
    
    // 目标位置在屏幕范围内随机，留出边缘空间
    const padding = 60
    const x = padding + Math.random() * (screenWidth - targetSize - padding * 2)
    const y = padding + 100 + Math.random() * (screenHeight - targetSize - padding * 2 - 200)
    
    this.setData({
      targetPosition: { x: x, y: y },
      targetSize: targetSize
    })
  },

  onTargetClick: function (e) {
    if (!this.data.isPlaying) return
    
    const now = Date.now()
    const timeSinceLastClick = now - this.data.lastClickTime
    
    // 计算连击
    let combo = this.data.combo
    let score = this.data.score
    let maxCombo = this.data.maxCombo
    
    // 如果在0.8秒内连续点击，增加连击
    if (timeSinceLastClick < 800) {
      combo++
    } else {
      combo = 1
    }
    
    // 计算得分，根据目标大小和连击
    const targetSize = this.data.targetSize
    const baseScore = Math.floor(200 / (targetSize / 80))
    const comboBonus = Math.floor(baseScore * (combo - 1) * 0.2)
    const earnedScore = baseScore + comboBonus
    
    score += earnedScore
    maxCombo = Math.max(maxCombo, combo)
    
    // 创建点击粒子效果
    this.createParticles(e.detail.x, e.detail.y)
    
    this.setData({
      score: score,
      combo: combo,
      maxCombo: maxCombo,
      lastClickTime: now
    })
    
    // 震动反馈
    wx.vibrateShort()
    
    // 移动目标到新位置
    this.moveTarget()
  },

  createParticles: function (x, y) {
    const particles = []
    for (let i = 0; i < 8; i++) {
      particles.push({
        id: Date.now() + i,
        x: x,
        y: y,
        angle: (i * 45) * Math.PI / 180,
        speed: 5 + Math.random() * 10,
        size: 8 + Math.random() * 8,
        opacity: 1
      })
    }
    
    this.setData({ particles: particles })
    
    // 动画移除粒子
    setTimeout(() => {
      this.setData({ particles: [] })
    }, 500)
  },

  onMissClick: function (e) {
    if (!this.data.isPlaying) return
    
    // 点击空白处，重置连击
    this.setData({ combo: 0 })
  },

  endGame: function () {
    clearInterval(this.timer)
    
    const { score, highScore, maxCombo } = this.data
    
    // 更新最高分
    if (score > highScore) {
      this.setData({ highScore: score })
      wx.setStorageSync('clickGameHighScore', score)
    }
    
    this.setData({
      isPlaying: false,
      showResult: true
    })
  },

  restartGame: function () {
    this.setData({ showResult: false })
    this.startGame()
  },

  goBack: function () {
    wx.navigateBack()
  }
})
