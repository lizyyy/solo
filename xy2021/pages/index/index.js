const storage = require('../../../utils/storage.js');
const dataUtils = require('../../../utils/data.js');

Page({
  data: {
    userInfo: null,
    points: 0,
    todayCheckedIn: false,
    checkInStreak: 0,
    carbonFootprint: {
      total: 0,
      transport: 0,
      electricity: 0,
      food: 0,
      disposable: 0
    },
    dailyTasks: [],
    pointsHistory: [],
    showCheckInModal: false,
    checkInResult: null,
    todayDate: '',
    weekDays: [],
    todayAir: null
  },

  onLoad: function() {
    this.initPage();
  },

  onShow: function() {
    this.refreshData();
  },

  onPullDownRefresh: function() {
    this.refreshData();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  initPage: function() {
    const user = storage.getUserInfo();
    const today = new Date();
    const weekDays = this.generateWeekDays(today);
    
    this.setData({
      userInfo: user,
      todayDate: this.formatFullDate(today),
      weekDays: weekDays
    });
    
    this.refreshData();
  },

  refreshData: function() {
    const points = storage.getPoints();
    const todayCheckedIn = storage.checkTodayCheckIn();
    const checkInStreak = storage.getCheckInStreak();
    const footprint = storage.getCarbonFootprint();
    const history = storage.getPointsHistory().slice(0, 5);
    const tasks = this.getOrGenerateTasks();
    const airData = dataUtils.generateMockAirData();
    
    this.setData({
      points: points,
      todayCheckedIn: todayCheckedIn,
      checkInStreak: checkInStreak,
      carbonFootprint: footprint,
      pointsHistory: history,
      dailyTasks: tasks,
      todayAir: airData
    });
  },

  getOrGenerateTasks: function() {
    let tasks = storage.getTodayTasks();
    if (!tasks) {
      tasks = dataUtils.getTodayTasks();
      storage.saveTodayTasks(tasks);
    }
    return tasks;
  },

  generateWeekDays: function(date) {
    const days = [];
    const weekNames = ['日', '一', '二', '三', '四', '五', '六'];
    const currentDay = date.getDay();
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(date);
      d.setDate(date.getDate() - currentDay + i);
      days.push({
        day: d.getDate(),
        weekDay: weekNames[i],
        isToday: i === currentDay,
        dateStr: this.formatDate(d)
      });
    }
    return days;
  },

  formatDate: function(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },

  formatFullDate: function(date) {
    const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    return `${months[date.getMonth()]} ${date.getDate()}日`;
  },

  onCheckIn: function() {
    if (this.data.todayCheckedIn) {
      wx.showToast({
        title: '今日已签到',
        icon: 'none'
      });
      return;
    }
    
    const result = storage.performCheckIn();
    
    this.setData({
      showCheckInModal: true,
      checkInResult: result,
      todayCheckedIn: true,
      checkInStreak: result.streak,
      points: storage.getPoints()
    });
    
    wx.vibrateShort();
  },

  closeCheckInModal: function() {
    this.setData({
      showCheckInModal: false
    });
  },

  onCompleteTask: function(e) {
    const taskId = e.currentTarget.dataset.id;
    const tasks = this.data.dailyTasks;
    const task = tasks.find(t => t.id === taskId);
    
    if (task.completed) {
      wx.showToast({
        title: '任务已完成',
        icon: 'none'
      });
      return;
    }
    
    const result = storage.completeTask(taskId);
    
    if (result.success) {
      const updatedTasks = tasks.map(t => 
        t.id === taskId ? { ...t, completed: true } : t
      );
      
      this.setData({
        dailyTasks: updatedTasks,
        points: storage.getPoints()
      });
      
      wx.showToast({
        title: `+${result.points}积分`,
        icon: 'success'
      });
      
      wx.vibrateShort();
    } else {
      wx.showToast({
        title: result.message,
        icon: 'none'
      });
    }
  },

  navigateToPage: function(e) {
    const page = e.currentTarget.dataset.page;
    const pages = {
      calendar: '/pages/calendar/calendar',
      ranking: '/pages/ranking/ranking',
      air: '/pages/air/air',
      recycle: '/pages/recycle/recycle',
      footprint: '/pages/footprint/footprint',
      habits: '/pages/habits/habits',
      diary: '/pages/diary/diary'
    };
    
    if (pages[page]) {
      wx.navigateTo({
        url: pages[page]
      });
    }
  },

  goToFootprint: function() {
    wx.navigateTo({
      url: '/pages/footprint/footprint'
    });
  },

  goToCalendar: function() {
    wx.navigateTo({
      url: '/pages/calendar/calendar'
    });
  },

  showPointsDetail: function() {
    wx.showModal({
      title: '积分规则',
      content: '每日签到：10积分，连续签到额外奖励\n完成任务：每项任务对应积分\n回收物品：根据重量获得积分\n避免一次性用品：每次5积分',
      showCancel: false
    });
  },

  showCarbonDetail: function() {
    const fp = this.data.carbonFootprint;
    wx.showModal({
      title: '碳足迹详情',
      content: `出行碳排放：${fp.transport.toFixed(2)}kg\n用电碳排放：${fp.electricity.toFixed(2)}kg\n饮食碳排放：${fp.food.toFixed(2)}kg\n一次性用品：${fp.disposable.toFixed(2)}kg\n总计：${fp.total.toFixed(2)}kg`,
      showCancel: false
    });
  }
});
