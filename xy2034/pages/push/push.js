const util = require('../../utils/util.js')

Page({
  data: {
    pushContents: [],
    categories: ['全部', '同龄人经历', '清醒文案', '解压短句'],
    selectedCategory: '全部',
    currentIndex: 0,
    isLoading: false
  },

  onLoad: function (options) {
    this.loadPushContents()
    this.checkAndGenerateDailyPush()
  },

  onShow: function () {
    this.loadPushContents()
  },

  onPullDownRefresh: function () {
    this.loadPushContents()
    wx.stopPullDownRefresh()
  },

  checkAndGenerateDailyPush: function () {
    const lastPushDate = wx.getStorageSync('lastPushDate')
    const today = util.getCurrentTime().split(' ')[0]
    
    if (lastPushDate !== today) {
      this.generateDailyPush()
      wx.setStorageSync('lastPushDate', today)
    }
  },

  generateDailyPush: function () {
    const dailyPushes = [
      {
        id: util.generateId(),
        type: '同龄人经历',
        title: '我用365天证明了一次考试不代表一生',
        content: '去年的今天，我拿着高考成绩单，躲在房间里哭了整整一夜。模拟考试从未低于一本线的我，高考却只考了个专科分数。我甚至想过放弃人生。\n\n但现在的我，在一所专科学校读着自己喜欢的专业，成绩排名年级第一，还拿了奖学金。\n\n想告诉所有和我一样经历过高考失利的朋友：人生是一场马拉松，不是百米冲刺。一次考试的失败，不代表你整个人生的失败。\n\n你可以选择复读，可以选择专科，可以选择职业教育，甚至可以先工作再读书。重要的是，你要知道自己想要什么，然后为之努力。',
        author: '匿名用户',
        createTime: util.getCurrentTime(),
        isDaily: true
      },
      {
        id: util.generateId(),
        type: '清醒文案',
        title: '高考失利后，我才明白的5个道理',
        content: '1. 学历很重要，但不是唯一重要的\n真正决定你人生高度的，是你的学习能力、适应能力和抗压能力。\n\n2. 父母的期望，不应该成为你的枷锁\n他们希望你好，但更希望你快乐。坦诚地和他们沟通，你会发现他们比你想象的更理解你。\n\n3. 别人的眼光，真的没那么重要\n亲戚朋友的议论，不过是他们茶余饭后的谈资。你的人生，不需要活在别人的嘴里。\n\n4. 选择没有对错，只有适合不适合\n复读或专科，没有绝对的好坏。重要的是，这个选择是否适合你，是否能让你朝着目标前进。\n\n5. 时间是最好的治愈师\n现在你觉得天塌下来的事情，一年后回头看，可能只是人生中的一个小插曲。',
        author: '系统',
        createTime: util.getCurrentTime(),
        isDaily: true
      },
      {
        id: util.generateId(),
        type: '解压短句',
        title: '给正在低谷期的你',
        content: '亲爱的朋友：\n\n🌙 夜深了，你是不是又在想高考的事情？\n\n💔 我知道那种不甘心的感觉——\n付出了那么多，却没有得到想要的结果。\n\n🌸 但请记住：\n樱花落下的那一刻，不是结束，\n而是为了来年更灿烂的绽放。\n\n💪 现在的你，可能觉得前路迷茫，\n但每一步迷茫，都是在寻找方向。\n\n🌈 给自己一点时间，\n让伤口慢慢愈合，\n让心情慢慢平复。\n\n🌟 你已经很努力了，\n你值得被温柔对待。\n\n晚安，明天会更好的。',
        author: '系统',
        createTime: util.getCurrentTime(),
        isDaily: true
      }
    ]
    
    const existingPushes = wx.getStorageSync('pushContents') || []
    const allPushes = [...dailyPushes, ...existingPushes]
    wx.setStorageSync('pushContents', allPushes)
  },

  loadPushContents: function () {
    let pushContents = wx.getStorageSync('pushContents') || []
    
    if (this.data.selectedCategory !== '全部') {
      pushContents = pushContents.filter(p => p.type === this.data.selectedCategory)
    }
    
    this.setData({
      pushContents: pushContents.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
    })
  },

  selectCategory: function (e) {
    const category = e.currentTarget.dataset.category
    this.setData({ selectedCategory: category })
    this.loadPushContents()
  },

  goToPushDetail: function (e) {
    const pushId = e.currentTarget.dataset.id
    const push = this.data.pushContents.find(p => p.id === pushId)
    
    wx.setStorageSync('currentPush', push)
    
    wx.navigateTo({
      url: '/pages/push/pushDetail/pushDetail?id=' + pushId
    })
  },

  getTypeIcon: function (type) {
    switch (type) {
      case '同龄人经历':
        return '👥'
      case '清醒文案':
        return '📝'
      case '解压短句':
        return '✨'
      default:
        return '📖'
    }
  },

  getTypeColor: function (type) {
    switch (type) {
      case '同龄人经历':
        return '#4ecdc4'
      case '清醒文案':
        return '#6B8DD6'
      case '解压短句':
        return '#ff6b6b'
      default:
        return '#999'
    }
  }
})
