const dayjs = require('dayjs');

module.exports = {
  server: {
    port: process.env.PORT || 3000,
    name: '校园借书逾期 API'
  },
  db: {
    path: process.env.DB_PATH || './data/library.db'
  },
  rules: {
    defaultLoanDays: 30,
    maxRenewTimes: 2,
    renewDays: 30,
    overdueRatePerDay: 0.1,
    maxOverdueFine: 50,
    lostBookRatio: 2.0,
    overdueGraceDays: 3
  },
  operators: [
    { id: 'admin', name: '系统管理员' },
    { id: 'teacher_zhang', name: '张老师' },
    { id: 'teacher_li', name: '李老师' },
    { id: 'librarian', name: '图书管理员' }
  ],
  getCurrentDate: () => dayjs(),
  getDateByDays: (days) => dayjs().add(days, 'day')
};
