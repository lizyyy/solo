const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class DataStore {
  constructor() {
    this.meetings = [];
    this.visitors = [];
    this.mealRules = [];
    this.orderChanges = [];
    this.mealVerifications = [];
    this.expenseSummaries = [];
    this.auditLogs = [];
    this.operationLogs = [];
    
    this.initSampleData();
  }

  initSampleData() {
    const meetingId1 = uuidv4();
    const meetingId2 = uuidv4();

    this.meetings = [
      {
        id: meetingId1,
        title: '2024年度战略规划会议',
        date: moment().add(1, 'days').format('YYYY-MM-DD'),
        startTime: '09:00',
        endTime: '17:00',
        location: 'A栋3楼会议室',
        organizer: '张三',
        status: 'scheduled',
        expectedVisitors: 15,
        createdAt: moment().format('YYYY-MM-DD HH:mm:ss'),
        updatedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
        previousValues: null
      },
      {
        id: meetingId2,
        title: '技术合作交流研讨会',
        date: moment().add(3, 'days').format('YYYY-MM-DD'),
        startTime: '14:00',
        endTime: '18:00',
        location: 'B栋1楼展示厅',
        organizer: '李四',
        status: 'draft',
        expectedVisitors: 8,
        createdAt: moment().format('YYYY-MM-DD HH:mm:ss'),
        updatedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
        previousValues: null
      }
    ];

    const visitorNames = ['王总', '李经理', '张工', '陈主管', '刘总监', '赵经理', '孙工', '周主管', '吴总监', '郑经理'];
    for (let i = 0; i < 10; i++) {
      this.visitors.push({
        id: uuidv4(),
        meetingId: meetingId1,
        name: visitorNames[i],
        company: ['华为技术', '腾讯科技', '阿里巴巴', '字节跳动'][i % 4],
        phone: `138${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
        mealType: 'standard',
        hasMeal: true,
        verified: false,
        createdAt: moment().format('YYYY-MM-DD HH:mm:ss'),
        updatedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
        previousValues: null
      });
    }

    this.mealRules = [
      {
        id: uuidv4(),
        meetingId: meetingId1,
        standardPrice: 50,
        vipPrice: 100,
        breakfastPrice: 30,
        lunchPrice: 50,
        dinnerPrice: 60,
        maxPerMeeting: 1000,
        deadlineHours: 24,
        createdAt: moment().format('YYYY-MM-DD HH:mm:ss'),
        updatedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
        previousValues: null
      }
    ];
  }

  logOperation(type, entityId, entityType, operator, oldValue, newValue, description) {
    const log = {
      id: uuidv4(),
      type,
      entityId,
      entityType,
      operator,
      oldValue,
      newValue,
      description,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    };
    this.operationLogs.push(log);
    return log;
  }
}

module.exports = new DataStore();