App({
  globalData: {
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
    }
  },

  onLaunch: function() {
    this.initUserInfo();
    this.checkTodayStatus();
  },

  initUserInfo: function() {
    const userInfo = wx.getStorageSync('userInfo');
    const points = wx.getStorageSync('points') || 0;
    const footprint = wx.getStorageSync('carbonFootprint') || this.globalData.carbonFootprint;
    
    if (userInfo) {
      this.globalData.userInfo = userInfo;
    }
    this.globalData.points = points;
    this.globalData.carbonFootprint = footprint;
  },

  checkTodayStatus: function() {
    const today = this.getTodayString();
    const lastCheckIn = wx.getStorageSync('lastCheckInDate');
    const checkInStreak = wx.getStorageSync('checkInStreak') || 0;
    
    if (lastCheckIn === today) {
      this.globalData.todayCheckedIn = true;
      this.globalData.checkInStreak = checkInStreak;
    } else {
      const yesterday = this.getYesterdayString();
      if (lastCheckIn !== yesterday) {
        this.globalData.checkInStreak = 0;
        wx.setStorageSync('checkInStreak', 0);
      } else {
        this.globalData.checkInStreak = checkInStreak;
      }
      this.globalData.todayCheckedIn = false;
    }
  },

  getTodayString: function() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },

  getYesterdayString: function() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },

  addPoints: function(amount, reason) {
    this.globalData.points += amount;
    wx.setStorageSync('points', this.globalData.points);
    
    const pointsHistory = wx.getStorageSync('pointsHistory') || [];
    pointsHistory.unshift({
      points: amount,
      reason: reason,
      date: this.getTodayString(),
      timestamp: Date.now()
    });
    wx.setStorageSync('pointsHistory', pointsHistory.slice(0, 50));
    
    return this.globalData.points;
  },

  checkIn: function() {
    if (this.globalData.todayCheckedIn) {
      return { success: false, message: '今日已签到' };
    }
    
    const today = this.getTodayString();
    const yesterday = this.getYesterdayString();
    const lastCheckIn = wx.getStorageSync('lastCheckInDate');
    
    let streakBonus = 0;
    if (lastCheckIn === yesterday) {
      this.globalData.checkInStreak += 1;
      streakBonus = Math.min(this.globalData.checkInStreak, 7);
    } else {
      this.globalData.checkInStreak = 1;
    }
    
    const basePoints = 10;
    const totalPoints = basePoints + streakBonus;
    
    this.addPoints(totalPoints, '每日环保签到');
    
    this.globalData.todayCheckedIn = true;
    wx.setStorageSync('lastCheckInDate', today);
    wx.setStorageSync('checkInStreak', this.globalData.checkInStreak);
    
    return {
      success: true,
      points: totalPoints,
      streak: this.globalData.checkInStreak,
      message: `签到成功！获得${totalPoints}绿色积分`
    };
  }
});
