const util = require('../../utils/util.js')

Page({
  data: {
    questions: [],
    currentQuestionIndex: 0,
    totalQuestions: 0,
    answers: [],
    isCompleted: false,
    totalScore: 0,
    anxietyLevel: '',
    levelColor: '',
    suggestions: []
  },

  onLoad: function (options) {
    this.loadQuestions()
  },

  loadQuestions: function () {
    const questions = wx.getStorageSync('anxietyTests') || []
    if (questions.length === 0) {
      util.showToast('测试数据加载失败')
      return
    }
    
    this.setData({
      questions: questions,
      totalQuestions: questions.length,
      answers: new Array(questions.length).fill(null)
    })
  },

  selectOption: function (e) {
    const { index, value } = e.currentTarget.dataset
    const { answers, questions, currentQuestionIndex } = this.data
    
    answers[currentQuestionIndex] = parseInt(value)
    this.setData({ answers: answers })
    
    // 自动跳转到下一题，如果是最后一题则直接计算结果
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        this.nextQuestion()
      } else {
        this.calculateResult()
      }
    }, 300)
  },

  nextQuestion: function () {
    const { currentQuestionIndex, totalQuestions, answers } = this.data
    
    if (currentQuestionIndex >= totalQuestions - 1) {
      return
    }
    
    this.setData({
      currentQuestionIndex: currentQuestionIndex + 1
    })
  },

  prevQuestion: function () {
    const { currentQuestionIndex } = this.data
    
    if (currentQuestionIndex <= 0) {
      return
    }
    
    this.setData({
      currentQuestionIndex: currentQuestionIndex - 1
    })
  },

  goToQuestion: function (e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      currentQuestionIndex: index
    })
  },

  calculateResult: function () {
    const { answers, questions } = this.data
    
    // 检查是否所有题目都已回答
    const unanswered = answers.findIndex(a => a === null)
    if (unanswered > -1) {
      util.showToast(`请完成第${unanswered + 1}题`)
      this.setData({
        currentQuestionIndex: unanswered
      })
      return
    }
    
    // 计算总分
    const totalScore = answers.reduce((sum, score) => sum + score, 0)
    
    // 确定焦虑等级
    let anxietyLevel = ''
    let levelColor = ''
    let suggestions = []
    
    if (totalScore <= 4) {
      anxietyLevel = '轻度焦虑'
      levelColor = '#51cf66'
      suggestions = [
        '你的焦虑程度较低，这是正常的情绪反应。',
        '建议保持规律的作息，适当进行户外活动。',
        '可以尝试一些简单的放松技巧，如深呼吸。'
      ]
    } else if (totalScore <= 9) {
      anxietyLevel = '中度焦虑'
      levelColor = '#fcc419'
      suggestions = [
        '你的焦虑程度中等，建议关注自己的情绪变化。',
        '可以尝试写情绪日记，记录自己的感受和触发点。',
        '建议适当减少压力源，给自己一些放松的时间。',
        '如果焦虑持续影响生活，可以考虑寻求专业帮助。'
      ]
    } else if (totalScore <= 14) {
      anxietyLevel = '中重度焦虑'
      levelColor = '#ff922b'
      suggestions = [
        '你的焦虑程度较高，需要重视自己的心理健康。',
        '建议主动与信任的人倾诉，不要独自承受。',
        '可以尝试一些放松训练，如正念冥想、渐进式肌肉放松。',
        '强烈建议寻求专业心理咨询师的帮助。',
        '如果有自杀念头，请立即寻求紧急帮助。'
      ]
    } else {
      anxietyLevel = '重度焦虑'
      levelColor = '#ff6b6b'
      suggestions = [
        '你的焦虑程度严重，需要立即关注和干预。',
        '请不要独自面对，立即告诉家人或朋友你的感受。',
        '强烈建议尽快寻求专业心理医生或心理咨询师的帮助。',
        '可以考虑去医院心理科进行评估和诊断。',
        '如果有自杀念头，请立即拨打心理援助热线或前往急诊室。',
        '记住：寻求帮助是勇敢的表现，你值得被帮助和支持。'
      ]
    }
    
    this.setData({
      isCompleted: true,
      totalScore: totalScore,
      anxietyLevel: anxietyLevel,
      levelColor: levelColor,
      suggestions: suggestions
    })
    
    // 保存测试记录
    this.saveTestRecord(totalScore, anxietyLevel)
  },

  saveTestRecord: function (score, level) {
    const testRecords = wx.getStorageSync('anxietyTestRecords') || []
    const newRecord = {
      id: util.generateId(),
      score: score,
      level: level,
      createTime: util.getCurrentTime(),
      answers: this.data.answers
    }
    
    testRecords.unshift(newRecord)
    wx.setStorageSync('anxietyTestRecords', testRecords)
  },

  restartTest: function () {
    this.setData({
      currentQuestionIndex: 0,
      answers: new Array(this.data.totalQuestions).fill(null),
      isCompleted: false,
      totalScore: 0,
      anxietyLevel: '',
      levelColor: '',
      suggestions: []
    })
  },

  goBack: function () {
    if (!this.data.isCompleted) {
      util.confirmDialog('测试尚未完成，确定要离开吗？').then((confirmed) => {
        if (confirmed) {
          wx.navigateBack()
        }
      })
    } else {
      wx.navigateBack()
    }
  }
})
