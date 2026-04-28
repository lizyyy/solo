const storage = require('../../../utils/storage.js');

Page({
  data: {
    selectedTab: 'points',
    rankingData: null,
    userPoints: 0,
    userCheckIns: 0,
    userTasks: 0,
    userCarbonSaved: 0,
    showMyRank: false
  },

  onLoad: function() {
    this.loadData();
  },

  onShow: function() {
    this.loadData();
  },

  loadData: function() {
    const ranking = storage.getRankingData();
    const user = storage.getUserInfo();
    const points = storage.getPoints();
    
    this.setData({
      rankingData: ranking,
      userPoints: points,
      userCheckIns: user.totalCheckIns,
      userTasks: user.totalTasks
    });
  },

  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      selectedTab: tab
    });
  },

  toggleMyRank: function() {
    this.setData({
      showMyRank: !this.data.showMyRank
    });
  },

  getRankColor: function(rank) {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return '#666666';
  },

  getRankBadge: function(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  }
});
