const { formatDate } = require('./data.js');

const STORAGE_KEYS = {
  USER_INFO: 'userInfo',
  POINTS: 'points',
  POINTS_HISTORY: 'pointsHistory',
  CHECK_IN_DATE: 'lastCheckInDate',
  CHECK_IN_STREAK: 'checkInStreak',
  CARBON_FOOTPRINT: 'carbonFootprint',
  FOOTPRINT_HISTORY: 'footprintHistory',
  DAILY_TASKS: 'dailyTasks',
  TASKS_DATE: 'tasksDate',
  COMPLETED_TASKS: 'completedTasks',
  HABITS_TRACKER: 'habitsTracker',
  EARTH_DIARY: 'earthDiary',
  WISH_WALL: 'wishWall',
  RECYCLE_ORDERS: 'recycleOrders',
  RANKING_DATA: 'rankingData'
};

function getTodayKey() {
  return formatDate(new Date());
}

function getStorage(key, defaultValue = null) {
  try {
    const value = wx.getStorageSync(key);
    return value === '' ? defaultValue : value;
  } catch (e) {
    console.error('Storage get error:', e);
    return defaultValue;
  }
}

function setStorage(key, value) {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (e) {
    console.error('Storage set error:', e);
    return false;
  }
}

function getUserInfo() {
  const defaultUser = {
    id: 'user_' + Date.now(),
    nickname: '环保达人',
    avatar: '',
    level: 1,
    joinDate: getTodayKey(),
    totalPoints: 0,
    totalCheckIns: 0,
    totalTasks: 0,
    totalCarbonSaved: 0
  };
  
  const user = getStorage(STORAGE_KEYS.USER_INFO, null);
  if (!user) {
    setStorage(STORAGE_KEYS.USER_INFO, defaultUser);
    return defaultUser;
  }
  return user;
}

function updateUserInfo(updates) {
  const user = getUserInfo();
  const updated = { ...user, ...updates };
  setStorage(STORAGE_KEYS.USER_INFO, updated);
  return updated;
}

function getPoints() {
  return getStorage(STORAGE_KEYS.POINTS, 0);
}

function addPoints(amount, reason) {
  const current = getPoints();
  const newTotal = current + amount;
  setStorage(STORAGE_KEYS.POINTS, newTotal);
  
  const history = getPointsHistory();
  history.unshift({
    points: amount,
    reason: reason,
    date: getTodayKey(),
    timestamp: Date.now()
  });
  setStorage(STORAGE_KEYS.POINTS_HISTORY, history.slice(0, 100));
  
  const user = getUserInfo();
  updateUserInfo({ totalPoints: user.totalPoints + amount });
  
  return newTotal;
}

function getPointsHistory() {
  return getStorage(STORAGE_KEYS.POINTS_HISTORY, []);
}

function checkTodayCheckIn() {
  const lastDate = getStorage(STORAGE_KEYS.CHECK_IN_DATE, '');
  return lastDate === getTodayKey();
}

function getCheckInStreak() {
  return getStorage(STORAGE_KEYS.CHECK_IN_STREAK, 0);
}

function performCheckIn() {
  const today = getTodayKey();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatDate(d);
  })();
  
  const lastDate = getStorage(STORAGE_KEYS.CHECK_IN_DATE, '');
  let streak = getStorage(STORAGE_KEYS.CHECK_IN_STREAK, 0);
  
  if (lastDate === today) {
    return { success: false, message: '今日已签到', streak: streak };
  }
  
  if (lastDate === yesterday) {
    streak += 1;
  } else {
    streak = 1;
  }
  
  setStorage(STORAGE_KEYS.CHECK_IN_DATE, today);
  setStorage(STORAGE_KEYS.CHECK_IN_STREAK, streak);
  
  const basePoints = 10;
  const streakBonus = Math.min(streak, 7);
  const totalPoints = basePoints + streakBonus;
  
  addPoints(totalPoints, `每日签到 (连续${streak}天)`);
  
  const user = getUserInfo();
  updateUserInfo({ totalCheckIns: user.totalCheckIns + 1 });
  
  return {
    success: true,
    points: totalPoints,
    streak: streak,
    message: `签到成功！获得${totalPoints}绿色积分`
  };
}

function getTodayTasks() {
  const today = getTodayKey();
  const tasksDate = getStorage(STORAGE_KEYS.TASKS_DATE, '');
  
  if (tasksDate !== today) {
    return null;
  }
  
  return getStorage(STORAGE_KEYS.DAILY_TASKS, []);
}

function saveTodayTasks(tasks) {
  setStorage(STORAGE_KEYS.TASKS_DATE, getTodayKey());
  setStorage(STORAGE_KEYS.DAILY_TASKS, tasks);
}

function completeTask(taskId) {
  const tasks = getTodayTasks();
  if (!tasks) return { success: false, message: '任务已过期' };
  
  const task = tasks.find(t => t.id === taskId);
  if (!task) return { success: false, message: '任务不存在' };
  
  if (task.completed) return { success: false, message: '任务已完成' };
  
  task.completed = true;
  task.completedAt = Date.now();
  saveTodayTasks(tasks);
  
  addPoints(task.points, `完成任务: ${task.title}`);
  
  const completedIds = getStorage(STORAGE_KEYS.COMPLETED_TASKS, []);
  const todayKey = getTodayKey();
  completedIds.push({
    date: todayKey,
    taskId: taskId,
    timestamp: Date.now()
  });
  setStorage(STORAGE_KEYS.COMPLETED_TASKS, completedIds.slice(-365));
  
  const user = getUserInfo();
  updateUserInfo({ totalTasks: user.totalTasks + 1 });
  
  return {
    success: true,
    points: task.points,
    message: `任务完成！获得${task.points}积分`
  };
}

function addFootprintRecord(record) {
  const history = getStorage(STORAGE_KEYS.FOOTPRINT_HISTORY, []);
  const newRecord = {
    id: 'fp_' + Date.now(),
    ...record,
    date: getTodayKey(),
    timestamp: Date.now()
  };
  history.unshift(newRecord);
  setStorage(STORAGE_KEYS.FOOTPRINT_HISTORY, history);
  
  const footprint = getStorage(STORAGE_KEYS.CARBON_FOOTPRINT, {
    total: 0, transport: 0, electricity: 0, food: 0, disposable: 0
  });
  
  footprint.total += record.carbonKg;
  if (footprint[record.category]) {
    footprint[record.category] += record.carbonKg;
  }
  setStorage(STORAGE_KEYS.CARBON_FOOTPRINT, footprint);
  
  return newRecord;
}

function getFootprintHistory(days = 30) {
  const history = getStorage(STORAGE_KEYS.FOOTPRINT_HISTORY, []);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return history.filter(r => r.timestamp > cutoff);
}

function getCarbonFootprint() {
  return getStorage(STORAGE_KEYS.CARBON_FOOTPRINT, {
    total: 0, transport: 0, electricity: 0, food: 0, disposable: 0
  });
}

function recordDisposableUsage(type, used) {
  const tracker = getStorage(STORAGE_KEYS.HABITS_TRACKER, {});
  const today = getTodayKey();
  
  if (!tracker[today]) {
    tracker[today] = {
      straw: { used: 0, avoided: 0 },
      plasticBag: { used: 0, avoided: 0 },
      chopsticks: { used: 0, avoided: 0 },
      waterBottle: { used: 0, avoided: 0 },
      coffeeCup: { used: 0, avoided: 0 }
    };
  }
  
  const key = used ? 'used' : 'avoided';
  tracker[today][type][key] += 1;
  
  setStorage(STORAGE_KEYS.HABITS_TRACKER, tracker);
  
  if (!used) {
    addPoints(5, `避免使用一次性${getDisposableName(type)}`);
  }
  
  return tracker[today];
}

function getDisposableName(type) {
  const names = {
    straw: '吸管',
    plasticBag: '塑料袋',
    chopsticks: '一次性筷子',
    waterBottle: '瓶装水',
    coffeeCup: '一次性咖啡杯'
  };
  return names[type] || type;
}

function getHabitsStats(days = 30) {
  const tracker = getStorage(STORAGE_KEYS.HABITS_TRACKER, {});
  const stats = {
    totalUsed: 0,
    totalAvoided: 0,
    byType: {
      straw: { used: 0, avoided: 0 },
      plasticBag: { used: 0, avoided: 0 },
      chopsticks: { used: 0, avoided: 0 },
      waterBottle: { used: 0, avoided: 0 },
      coffeeCup: { used: 0, avoided: 0 }
    },
    dailyData: []
  };
  
  const dates = Object.keys(tracker).sort().reverse().slice(0, days);
  
  for (const date of dates) {
    const dayData = tracker[date];
    let dayUsed = 0;
    let dayAvoided = 0;
    
    for (const type in dayData) {
      dayUsed += dayData[type].used;
      dayAvoided += dayData[type].avoided;
      stats.byType[type].used += dayData[type].used;
      stats.byType[type].avoided += dayData[type].avoided;
    }
    
    stats.totalUsed += dayUsed;
    stats.totalAvoided += dayAvoided;
    stats.dailyData.push({
      date: date,
      used: dayUsed,
      avoided: dayAvoided
    });
  }
  
  return stats;
}

function addDiaryEntry(content, mood = 'normal') {
  const diaries = getStorage(STORAGE_KEYS.EARTH_DIARY, []);
  const entry = {
    id: 'diary_' + Date.now(),
    content: content,
    mood: mood,
    date: getTodayKey(),
    timestamp: Date.now()
  };
  diaries.unshift(entry);
  setStorage(STORAGE_KEYS.EARTH_DIARY, diaries.slice(0, 365));
  return entry;
}

function getDiaryEntries(days = 30) {
  const diaries = getStorage(STORAGE_KEYS.EARTH_DIARY, []);
  return diaries.slice(0, days);
}

function addWish(wish) {
  const wishes = getStorage(STORAGE_KEYS.WISH_WALL, []);
  const newWish = {
    id: 'wish_' + Date.now(),
    content: wish,
    likes: 0,
    date: getTodayKey(),
    timestamp: Date.now()
  };
  wishes.unshift(newWish);
  setStorage(STORAGE_KEYS.WISH_WALL, wishes.slice(0, 100));
  addPoints(10, '发布环保愿望');
  return newWish;
}

function getWishes() {
  return getStorage(STORAGE_KEYS.WISH_WALL, []);
}

function likeWish(wishId) {
  const wishes = getWishes();
  const wish = wishes.find(w => w.id === wishId);
  if (wish) {
    wish.likes += 1;
    setStorage(STORAGE_KEYS.WISH_WALL, wishes);
  }
  return wish;
}

function createRecycleOrder(order) {
  const orders = getStorage(STORAGE_KEYS.RECYCLE_ORDERS, []);
  const newOrder = {
    id: 'rc_' + Date.now(),
    ...order,
    status: 'pending',
    date: getTodayKey(),
    timestamp: Date.now()
  };
  orders.unshift(newOrder);
  setStorage(STORAGE_KEYS.RECYCLE_ORDERS, orders);
  
  if (order.estimatedPoints) {
    addPoints(order.estimatedPoints, `回收物品预约`);
  }
  
  return newOrder;
}

function getRecycleOrders() {
  return getStorage(STORAGE_KEYS.RECYCLE_ORDERS, []);
}

function getRankingData() {
  const mockRanking = [
    { rank: 1, nickname: '环保先锋', avatar: '', points: 12580, level: 10, badge: '🥇' },
    { rank: 2, nickname: '绿色达人', avatar: '', points: 9876, level: 8, badge: '🥈' },
    { rank: 3, nickname: '地球守护者', avatar: '', points: 7654, level: 7, badge: '🥉' },
    { rank: 4, nickname: '低碳生活家', avatar: '', points: 6543, level: 6, badge: '' },
    { rank: 5, nickname: '节能小能手', avatar: '', points: 5432, level: 6, badge: '' },
    { rank: 6, nickname: '垃圾分类王', avatar: '', points: 4321, level: 5, badge: '' },
    { rank: 7, nickname: '植树造林者', avatar: '', points: 3210, level: 5, badge: '' },
    { rank: 8, nickname: '节水卫士', avatar: '', points: 2109, level: 4, badge: '' },
    { rank: 9, nickname: '光盘行动者', avatar: '', points: 1987, level: 4, badge: '' },
    { rank: 10, nickname: '骑行爱好者', avatar: '', points: 1765, level: 3, badge: '' }
  ];
  
  const user = getUserInfo();
  const userPoints = getPoints();
  
  let userRank = null;
  for (let i = 0; i < mockRanking.length; i++) {
    if (userPoints > mockRanking[i].points) {
      userRank = i + 1;
      break;
    }
  }
  if (!userRank) {
    userRank = mockRanking.length + 1;
  }
  
  return {
    topList: mockRanking,
    userRank: {
      rank: userRank,
      nickname: user.nickname,
      points: userPoints,
      level: user.level,
      isUser: true
    }
  };
}

module.exports = {
  STORAGE_KEYS,
  getTodayKey,
  getUserInfo,
  updateUserInfo,
  getPoints,
  addPoints,
  getPointsHistory,
  checkTodayCheckIn,
  getCheckInStreak,
  performCheckIn,
  getTodayTasks,
  saveTodayTasks,
  completeTask,
  addFootprintRecord,
  getFootprintHistory,
  getCarbonFootprint,
  recordDisposableUsage,
  getHabitsStats,
  addDiaryEntry,
  getDiaryEntries,
  addWish,
  getWishes,
  likeWish,
  createRecycleOrder,
  getRecycleOrders,
  getRankingData
};
