const storage = require('../../../utils/storage.js');
const dataUtils = require('../../../utils/data.js');

Page({
  data: {
    currentDate: null,
    currentYear: 0,
    currentMonth: 0,
    today: null,
    calendarDays: [],
    selectedDate: null,
    dailyTasks: [],
    completedCount: 0,
    totalCount: 0,
    monthlyStats: {},
    showTaskDetail: false,
    selectedTask: null,
    weekDays: ['日', '一', '二', '三', '四', '五', '六']
  },

  onLoad: function() {
    this.initCalendar();
  },

  onShow: function() {
    this.refreshTasks();
  },

  initCalendar: function() {
    const now = new Date();
    const today = {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      dateStr: this.formatDate(now)
    };
    
    this.setData({
      today: today,
      selectedDate: today,
      currentDate: now,
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    });
    
    this.generateCalendarDays(now.getFullYear(), now.getMonth());
    this.refreshTasks();
  },

  formatDate: function(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  generateCalendarDays: function(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    const days = [];
    const today = this.data.today;
    
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonthDays = new Date(prevYear, prevMonth + 1, 0).getDate();
    
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const date = new Date(prevYear, prevMonth, day);
      days.push({
        day: day,
        dateStr: this.formatDate(date),
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        hasTasks: false,
        completedAll: false
      });
    }
    
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(year, month, i);
      const dateStr = this.formatDate(date);
      const isToday = year === today.year && (month + 1) === today.month && i === today.day;
      
      days.push({
        day: i,
        dateStr: dateStr,
        isCurrentMonth: true,
        isToday: isToday,
        isSelected: isToday,
        hasTasks: this.checkHasTasks(dateStr),
        completedAll: this.checkCompletedAll(dateStr)
      });
    }
    
    const remainingDays = 42 - days.length;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(nextYear, nextMonth, i);
      days.push({
        day: i,
        dateStr: this.formatDate(date),
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        hasTasks: false,
        completedAll: false
      });
    }
    
    this.setData({
      calendarDays: days,
      currentYear: year,
      currentMonth: month + 1
    });
  },

  checkHasTasks: function(dateStr) {
    const today = this.data.today;
    if (dateStr === today.dateStr) {
      return true;
    }
    const completedIds = storage.getStorage('completedTasks', []);
    return completedIds.some(item => item.date === dateStr);
  },

  checkCompletedAll: function(dateStr) {
    const completedIds = storage.getStorage('completedTasks', []);
    const todayTasks = completedIds.filter(item => item.date === dateStr);
    return todayTasks.length >= 5;
  },

  prevMonth: function() {
    let year = this.data.currentYear;
    let month = this.data.currentMonth - 2;
    
    if (month < 0) {
      month = 11;
      year--;
    }
    
    this.generateCalendarDays(year, month);
  },

  nextMonth: function() {
    let year = this.data.currentYear;
    let month = this.data.currentMonth;
    
    if (month > 11) {
      month = 0;
      year++;
    }
    
    this.generateCalendarDays(year, month);
  },

  selectDate: function(e) {
    const dateStr = e.currentTarget.dataset.date;
    const isCurrentMonth = e.currentTarget.dataset.currentMonth;
    
    if (!isCurrentMonth) {
      return;
    }
    
    const days = this.data.calendarDays.map(day => ({
      ...day,
      isSelected: day.dateStr === dateStr
    }));
    
    const [year, month, day] = dateStr.split('-').map(Number);
    const selectedDate = {
      year: year,
      month: month,
      day: day,
      dateStr: dateStr
    };
    
    this.setData({
      calendarDays: days,
      selectedDate: selectedDate
    });
    
    this.refreshTasks();
  },

  refreshTasks: function() {
    const today = this.data.today;
    const selectedDate = this.data.selectedDate;
    
    if (!selectedDate) return;
    
    let tasks = [];
    if (selectedDate.dateStr === today.dateStr) {
      tasks = this.getTodayTasks();
    } else {
      tasks = this.getHistoricalTasks(selectedDate.dateStr);
    }
    
    const completedCount = tasks.filter(t => t.completed).length;
    
    this.setData({
      dailyTasks: tasks,
      completedCount: completedCount,
      totalCount: tasks.length
    });
    
    this.calculateMonthlyStats();
  },

  getTodayTasks: function() {
    let tasks = storage.getTodayTasks();
    if (!tasks) {
      tasks = dataUtils.getTodayTasks();
      storage.saveTodayTasks(tasks);
    }
    return tasks;
  },

  getHistoricalTasks: function(dateStr) {
    const completedIds = storage.getStorage('completedTasks', []);
    const dayTasks = completedIds.filter(item => item.date === dateStr);
    
    const allTasks = dataUtils.DAILY_TASKS;
    const completedTaskIds = dayTasks.map(t => t.taskId);
    
    return allTasks.slice(0, 5).map(task => ({
      ...task,
      completed: completedTaskIds.includes(task.id)
    }));
  },

  calculateMonthlyStats: function() {
    const year = this.data.currentYear;
    const month = this.data.currentMonth;
    
    const completedIds = storage.getStorage('completedTasks', []);
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    
    const monthTasks = completedIds.filter(item => item.date.startsWith(monthPrefix));
    const uniqueDays = new Set(monthTasks.map(item => item.date));
    
    const stats = {
      totalCompleted: monthTasks.length,
      activeDays: uniqueDays.size,
      totalDays: new Date(year, month, 0).getDate()
    };
    
    this.setData({
      monthlyStats: stats
    });
  },

  onCompleteTask: function(e) {
    const taskId = e.currentTarget.dataset.id;
    const today = this.data.today;
    const selectedDate = this.data.selectedDate;
    
    if (selectedDate.dateStr !== today.dateStr) {
      wx.showToast({
        title: '只能完成当天任务',
        icon: 'none'
      });
      return;
    }
    
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
      
      const completedCount = updatedTasks.filter(t => t.completed).length;
      
      this.setData({
        dailyTasks: updatedTasks,
        completedCount: completedCount
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

  showTaskDetail: function(e) {
    const taskId = e.currentTarget.dataset.id;
    const task = this.data.dailyTasks.find(t => t.id === taskId);
    
    if (task) {
      this.setData({
        showTaskDetail: true,
        selectedTask: task
      });
    }
  },

  closeTaskDetail: function() {
    this.setData({
      showTaskDetail: false,
      selectedTask: null
    });
  },

  goToToday: function() {
    const today = this.data.today;
    const now = new Date();
    
    this.setData({
      currentDate: now,
      selectedDate: today
    });
    
    this.generateCalendarDays(today.year, today.month - 1);
    this.refreshTasks();
  }
});
