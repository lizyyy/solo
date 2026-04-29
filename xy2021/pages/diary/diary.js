const storage = require('../../../utils/storage.js');
const dataUtils = require('../../../utils/data.js');

Page({
  data: {
    selectedTab: 'diary',
    todayMessage: null,
    todayQuote: '',
    diaryEntries: [],
    showWriteModal: false,
    diaryContent: '',
    selectedMood: 'normal',
    moods: [
      { id: 'happy', name: '开心', icon: '😊' },
      { id: 'peaceful', name: '平静', icon: '😌' },
      { id: 'normal', name: '一般', icon: '😐' },
      { id: 'worried', name: '担忧', icon: '😟' },
      { id: 'hopeful', name: '充满希望', icon: '🌟' }
    ],
    wishes: [],
    showWishModal: false,
    wishContent: '',
    earthStatus: {
      treesPlanted: 12580,
      carbonSaved: 8560.5,
      wasteRecycled: 3250.8,
      peopleInvolved: 98765
    },
    showTrashAnimation: false,
    trashItems: [
      { id: 1, type: 'plastic', icon: '🧴', name: '塑料瓶' },
      { id: 2, type: 'paper', icon: '📄', name: '废纸' },
      { id: 3, type: 'glass', icon: '🍶', name: '玻璃瓶' },
      { id: 4, type: 'battery', icon: '🔋', name: '废电池' },
      { id: 5, type: 'bag', icon: '🛍️', name: '塑料袋' },
      { id: 6, type: 'can', icon: '🥫', name: '易拉罐' }
    ],
    activeTrashItems: [],
    score: 0,
    gameStarted: false,
    healingAnimations: []
  },

  onLoad: function() {
    this.initPage();
  },

  onShow: function() {
    this.loadData();
  },

  initPage: function() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateKey = `${month}-${day}`;
    
    let message = dataUtils.EARTH_MESSAGES.find(m => m.date === dateKey);
    if (!message) {
      message = dataUtils.EARTH_MESSAGES.find(m => m.date === 'default');
    }
    
    const quote = dataUtils.getRandomHealingQuote();
    
    this.setData({
      todayMessage: message,
      todayQuote: quote
    });
    
    this.loadData();
  },

  loadData: function() {
    const diaries = storage.getDiaryEntries(30);
    const wishes = storage.getWishes();
    
    this.setData({
      diaryEntries: diaries,
      wishes: wishes
    });
  },

  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      selectedTab: tab
    });
    
    if (tab === 'heal') {
      this.initGame();
    }
  },

  initGame: function() {
    if (this.data.gameStarted) return;
    
    const gameItems = this.shuffleArray([...this.data.trashItems]);
    this.setData({
      activeTrashItems: gameItems,
      score: 0,
      gameStarted: true
    });
  },

  shuffleArray: function(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  },

  clickTrash: function(e) {
    const id = e.currentTarget.dataset.id;
    const index = e.currentTarget.dataset.index;
    
    const items = [...this.data.activeTrashItems];
    const clickedItem = items.find(item => item.id === id);
    
    if (clickedItem) {
      this.playHealAnimation(clickedItem, index);
      
      items.splice(items.indexOf(clickedItem), 1);
      
      const newScore = this.data.score + 10;
      
      this.setData({
        activeTrashItems: items,
        score: newScore
      });
      
      if (items.length === 0) {
        setTimeout(() => {
          this.completeGame();
        }, 500);
      }
    }
  },

  playHealAnimation: function(item, index) {
    const animations = [...this.data.healingAnimations];
    animations.push({
      id: Date.now(),
      icon: item.icon,
      index: index,
      showing: true
    });
    
    this.setData({
      healingAnimations: animations
    });
    
    setTimeout(() => {
      const updatedAnimations = this.data.healingAnimations.filter(a => a.id !== animations[animations.length - 1].id);
      this.setData({
        healingAnimations: updatedAnimations
      });
    }, 1000);
  },

  completeGame: function() {
    const bonusPoints = 20;
    storage.addPoints(bonusPoints, '完成垃圾治愈消除游戏');
    
    wx.showModal({
      title: '🎊 太棒了！',
      content: `你成功治愈了地球的创伤！\n获得 ${bonusPoints} 绿色积分奖励\n\n地球因你而更加美好！`,
      showCancel: false,
      success: () => {
        this.resetGame();
      }
    });
  },

  resetGame: function() {
    const gameItems = this.shuffleArray([...this.data.trashItems]);
    this.setData({
      activeTrashItems: gameItems,
      score: 0,
      gameStarted: false,
      healingAnimations: []
    });
  },

  openWriteModal: function() {
    this.setData({
      showWriteModal: true,
      diaryContent: '',
      selectedMood: 'normal'
    });
  },

  closeWriteModal: function() {
    this.setData({
      showWriteModal: false
    });
  },

  selectMood: function(e) {
    const mood = e.currentTarget.dataset.mood;
    this.setData({
      selectedMood: mood
    });
  },

  inputDiary: function(e) {
    this.setData({
      diaryContent: e.detail.value
    });
  },

  submitDiary: function() {
    if (!this.data.diaryContent.trim()) {
      wx.showToast({
        title: '请输入日记内容',
        icon: 'none'
      });
      return;
    }
    
    const entry = storage.addDiaryEntry(
      this.data.diaryContent,
      this.data.selectedMood
    );
    
    storage.addPoints(15, '撰写地球日记');
    
    this.setData({
      showWriteModal: false
    });
    
    this.loadData();
    
    wx.showToast({
      title: '日记已保存',
      icon: 'success'
    });
    
    wx.vibrateShort();
  },

  openWishModal: function() {
    this.setData({
      showWishModal: true,
      wishContent: ''
    });
  },

  closeWishModal: function() {
    this.setData({
      showWishModal: false
    });
  },

  inputWish: function(e) {
    this.setData({
      wishContent: e.detail.value
    });
  },

  submitWish: function() {
    if (!this.data.wishContent.trim()) {
      wx.showToast({
        title: '请输入愿望内容',
        icon: 'none'
      });
      return;
    }
    
    const wish = storage.addWish(this.data.wishContent);
    
    this.setData({
      showWishModal: false
    });
    
    this.loadData();
    
    wx.showToast({
      title: '愿望已发布',
      icon: 'success'
    });
    
    wx.vibrateShort();
  },

  likeWish: function(e) {
    const wishId = e.currentTarget.dataset.id;
    storage.likeWish(wishId);
    this.loadData();
  },

  getMoodIcon: function(moodId) {
    const mood = this.data.moods.find(m => m.id === moodId);
    return mood ? mood.icon : '😐';
  },

  refreshQuote: function() {
    const quote = dataUtils.getRandomHealingQuote();
    this.setData({
      todayQuote: quote
    });
  },

  showEarthInfo: function() {
    const status = this.data.earthStatus;
    wx.showModal({
      title: '🌍 地球实时状态',
      content: `累计植树：${status.treesPlanted.toLocaleString()} 棵\n\n累计减少碳排放：${status.carbonSaved.toLocaleString()} kg\n\n回收废弃物：${status.wasteRecycled.toLocaleString()} 公斤\n\n参与环保人数：${status.peopleInvolved.toLocaleString()} 人`,
      showCancel: false
    });
  }
});
