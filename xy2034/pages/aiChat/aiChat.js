const util = require('../../utils/util.js')

Page({
  data: {
    messages: [],
    inputValue: '',
    isTyping: false,
    userInfo: null,
    isLoggedIn: false,
    quickReplies: [
      '我怕被别人嘲笑',
      '我觉得愧对父母',
      '我对前途很迷茫',
      '我想复读但又害怕'
    ]
  },

  aiResponses: {
    嘲笑: [
      '我理解你的感受，被别人嘲笑确实会让人很痛苦。但请记住，一次考试的结果并不能定义你的全部价值。真正关心你的人会理解你的处境，而那些嘲笑你的人，他们的看法并不重要。你正在经历的困难，是很多人都会遇到的，这并不代表你失败了。',
      '被嘲笑的感觉真的很难受，我完全能体会。但请相信，高考只是人生中的一个节点，不是终点。那些现在嘲笑你的人，他们可能根本不了解你付出的努力。真正的价值不在于一次考试的分数，而在于你的品格、努力和面对困难的勇气。你正在经历的痛苦，会让你变得更强大。',
      '我知道被别人指指点点的感觉有多难受。但请记住，别人的眼光并不能定义你是谁。你已经为高考付出了很多努力，这一点就值得被尊重。高考失利只是暂时的挫折，你的人生还有无限可能。真正重要的是你如何看待自己，而不是别人如何看待你。'
    ],
    愧对: [
      '我理解你对父母的愧疚感，这是很自然的情绪。但请相信，真正爱你的父母，他们更关心的是你的幸福和健康，而不是一次考试的结果。他们为你付出，是希望你能有更好的未来，但这个未来不一定只有通过高考才能实现。试着和父母坦诚地聊聊你的感受，你可能会发现，他们的理解和支持会让你轻松很多。',
      '愧对父母是很多人都会有的感受，但请不要把所有的责任都扛在自己身上。父母的爱是无条件的，他们不会因为一次考试失利就不爱你了。他们为你付出，是因为他们爱你，而不是为了某种回报。试着和父母沟通你的感受，告诉他们你的压力和困惑。你可能会发现，他们的理解和支持是你最需要的力量。',
      '我知道你觉得对不起父母，但请相信，他们最希望看到的是你快乐、健康地成长。高考只是人生中的一个选择，不是唯一的出路。父母为你付出的一切，都是出于爱，而不是为了某种结果。试着和父母坦诚地交流，告诉他们你的真实感受。你可能会发现，他们的理解和支持会让你卸下很多负担。'
    ],
    迷茫: [
      '对前途感到迷茫是很正常的，尤其是在高考失利这样的转折点。但迷茫并不代表没有出路，只是你需要时间来找到新的方向。你可以考虑复读、读专科、职业教育，或者先工作一段时间再做决定。重要的是，不要因为迷茫就停止前进。每一个选择都是一个新的开始，你有权利重新定义自己的人生。',
      '前途迷茫的感觉确实让人不安，但这也是一个重新认识自己的机会。高考失利让你不得不面对一些之前没有考虑过的选择，但这也可能是一个转向更适合你的道路的机会。花些时间想想自己真正喜欢什么、擅长什么。可以和信任的人聊聊，或者做一些职业测评。记住，很多成功的人都走过曲折的道路，重要的是保持前进的勇气。',
      '我理解你对未来的迷茫，这是一个很正常的情绪反应。但请相信，迷茫并不代表绝望，它只是意味着你需要更多的时间来思考和探索。你可以考虑多种可能性：复读、专科、职业培训、gap year等等。没有哪一条路是"错误"的，每一条路都有它的风景。给自己一些时间和空间，慢慢找到属于你的方向。'
    ],
    复读: [
      '想复读但又害怕，这种矛盾的心情我完全能理解。复读确实是一个需要勇气的决定，因为它意味着要再次面对高考的压力。但请记住，害怕是正常的，重要的是你如何面对这种害怕。如果你决定复读，那是因为你有目标、有追求，这本身就是一种勇敢。如果你最终选择不复读，那也是一种明智的选择，因为你知道自己想要什么。无论你做出什么决定，都要相信自己的选择是最好的。',
      '想复读又害怕失败，这种纠结的心情真的很难受。但请想想，如果你不尝试，会不会后悔？如果你尝试了，即使结果不如预期，至少你不会留下遗憾。复读需要很大的勇气，但也意味着你有机会实现自己的目标。同时，也要考虑其他的可能性，比如读专科然后专升本，或者选择职业教育。没有哪条路是唯一的，重要的是找到最适合你的那条路。',
      '我理解你对复读的矛盾心情：一方面想再给自己一次机会，另一方面又害怕再次失败。这种恐惧是完全正常的。但请记住，害怕并不代表软弱，它只是说明你在乎结果。在做决定之前，可以问问自己几个问题：我真的想复读吗？我有足够的心理准备吗？有没有其他更好的选择？无论你做出什么决定，都要相信自己有能力面对任何结果。你的价值不仅仅取决于高考的分数。'
    ],
    其他: [
      '谢谢你愿意和我分享你的感受。把心里话说出来本身就是一种释放。高考失利后的这段时间确实很难熬，但请相信，这一切都会过去的。你正在经历的痛苦，是成长的一部分。无论你现在感觉多么绝望，都请记住：你不是一个人在战斗，你的人生还有很多可能性。如果愿意，可以继续和我聊聊你的具体感受。',
      '我听到了你的心声，谢谢你愿意信任我。高考失利后的情绪波动是很正常的，不要责怪自己脆弱。你已经很努力了，这一点就值得被肯定。现在的困难只是暂时的，你的人生不会因为一次考试就被定格。试着给自己一些时间和空间，允许自己悲伤，也允许自己慢慢恢复。如果你想聊聊更具体的问题，我随时都在。',
      '我理解你现在的心情，高考失利确实会让人感到很挫败。但请相信，这只是你人生中的一个挫折，不是终点。很多成功的人都经历过失败，关键是如何从失败中站起来。你可以选择复读，可以选择其他的教育路径，甚至可以先工作一段时间。无论你选择哪条路，都要记住：你的价值不取决于一次考试的结果。你有能力创造属于自己的美好未来。'
    ]
  },

  onLoad: function (options) {
    this.checkLoginStatus()
    this.initChat()
  },

  onShow: function () {
    this.checkLoginStatus()
  },

  checkLoginStatus: function () {
    const app = getApp()
    if (app.globalData.isLoggedIn) {
      this.setData({
        userInfo: app.globalData.userInfo,
        isLoggedIn: true
      })
    }
  },

  initChat: function () {
    const welcomeMessage = {
      id: util.generateId(),
      type: 'ai',
      content: '你好，我是你的情绪陪伴者。在这里，你可以放心地倾诉你的感受，不用担心被评判或嘲笑。\n\n高考失利后的这段时间确实很难熬，可能会有很多复杂的情绪：自责、恐惧、迷茫、愧疚... 这些感受都是正常的，你有权利感受它们。\n\n你可以直接和我聊聊你的感受，或者点击下方的快捷选项开始对话。',
      createTime: util.getCurrentTime()
    }
    
    this.setData({
      messages: [welcomeMessage]
    })
  },

  onInputChange: function (e) {
    this.setData({
      inputValue: e.detail.value
    })
  },

  sendMessage: function () {
    const { inputValue, isTyping } = this.data
    
    if (isTyping) return
    
    if (!inputValue.trim()) {
      util.showToast('请输入消息内容')
      return
    }
    
    this.addUserMessage(inputValue.trim())
    this.setData({ 
      inputValue: '',
      isTyping: true
    })
    
    // 模拟AI思考
    setTimeout(() => {
      this.generateAIResponse(inputValue.trim())
    }, 1000 + Math.random() * 1000)
  },

  sendQuickReply: function (e) {
    const { isTyping } = this.data
    
    if (isTyping) return
    
    const message = e.currentTarget.dataset.message
    this.addUserMessage(message)
    this.setData({ isTyping: true })
    
    // 模拟AI思考
    setTimeout(() => {
      this.generateAIResponse(message)
    }, 1000 + Math.random() * 1000)
  },

  addUserMessage: function (content) {
    const userMessage = {
      id: util.generateId(),
      type: 'user',
      content: content,
      createTime: util.getCurrentTime()
    }
    
    const messages = [...this.data.messages, userMessage]
    this.setData({ messages: messages })
    this.scrollToBottom()
  },

  generateAIResponse: function (userMessage) {
    let responseCategory = '其他'
    
    // 简单的关键词匹配
    if (userMessage.includes('嘲笑') || userMessage.includes('笑话') || userMessage.includes('别人') || userMessage.includes('眼光')) {
      responseCategory = '嘲笑'
    } else if (userMessage.includes('父母') || userMessage.includes('愧疚') || userMessage.includes('对不起') || userMessage.includes('愧对')) {
      responseCategory = '愧对'
    } else if (userMessage.includes('迷茫') || userMessage.includes('未来') || userMessage.includes('前途') || userMessage.includes('怎么办')) {
      responseCategory = '迷茫'
    } else if (userMessage.includes('复读') || userMessage.includes('再考') || userMessage.includes('再来')) {
      responseCategory = '复读'
    }
    
    const responses = this.aiResponses[responseCategory]
    const randomIndex = Math.floor(Math.random() * responses.length)
    const response = responses[randomIndex]
    
    const aiMessage = {
      id: util.generateId(),
      type: 'ai',
      content: response,
      createTime: util.getCurrentTime()
    }
    
    const messages = [...this.data.messages, aiMessage]
    this.setData({ 
      messages: messages,
      isTyping: false
    })
    this.scrollToBottom()
  },

  scrollToBottom: function () {
    wx.createSelectorQuery()
      .select('#chat-container')
      .boundingClientRect(function (rect) {
        wx.pageScrollTo({
          scrollTop: rect.height + 1000,
          duration: 300
        })
      })
      .exec()
  },

  handleLogin: function () {
    const that = this
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        const userInfo = {
          id: util.generateId(),
          userName: res.userInfo.nickName,
          avatar: res.userInfo.avatarUrl,
          createTime: util.getCurrentTime(),
          posts: 0,
          friends: 0,
          followers: 0
        }
        
        wx.setStorageSync('userInfo', userInfo)
        const app = getApp()
        app.globalData.userInfo = userInfo
        app.globalData.isLoggedIn = true
        app.globalData.userId = userInfo.id
        
        that.setData({
          userInfo: userInfo,
          isLoggedIn: true
        })
        
        util.showToast('登录成功')
      },
      fail: (err) => {
        console.log('获取用户信息失败', err)
        util.showToast('登录失败，请重试')
      }
    })
  }
})
