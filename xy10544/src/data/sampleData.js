const { v4: uuidv4 } = require('uuid');
const { HAZARD_STATUS, HAZARD_LEVEL, REVIEW_RESULT } = require('../utils/constants');

function generateId() {
  return uuidv4().substring(0, 8);
}

function getSampleData() {
  const now = new Date();
  
  const teams = [
    {
      id: 'team-001',
      name: '土建一班',
      code: 'TJ01',
      leader: '张工',
      phone: '138****1001',
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'team-002',
      name: '水电二班',
      code: 'SD02',
      leader: '李工',
      phone: '138****1002',
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'team-003',
      name: '消防三班',
      code: 'XF03',
      leader: '王工',
      phone: '138****1003',
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'team-004',
      name: '材料四班',
      code: 'CL04',
      leader: '赵工',
      phone: '138****1004',
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const hazards = [
    {
      id: 'hz-0001',
      type: '临边防护',
      location: '1号楼3层东单元',
      description: '临边防护栏杆缺失，缺口约2米，无警示标识',
      level: HAZARD_LEVEL.MAJOR,
      discoverer: '安全员-刘',
      discoveryDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      discoveryImages: ['IMG_20260505_083001.jpg', 'IMG_20260505_083015.jpg'],
      status: HAZARD_STATUS.CLOSED,
      responsibleTeamId: 'team-001',
      rectifyDeadline: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      rectificationCount: 1,
      reviewFailCount: 0,
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'hz-0002',
      type: '用电安全',
      location: '2号楼地下车库',
      description: '临时用电线路乱拉乱接，无漏电保护器，裸线外露',
      level: HAZARD_LEVEL.CRITICAL,
      discoverer: '安全员-刘',
      discoveryDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      discoveryImages: ['IMG_20260507_142033.jpg', 'IMG_20260507_142045.jpg'],
      status: HAZARD_STATUS.PENDING_REVIEW,
      responsibleTeamId: 'team-002',
      rectifyDeadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      rectificationCount: 2,
      reviewFailCount: 1,
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'hz-0003',
      type: '材料堆放',
      location: '3号楼南侧材料堆场',
      description: '模板堆放过高（超过2.5米），无防倾倒措施',
      level: HAZARD_LEVEL.GENERAL,
      discoverer: '安全员-陈',
      discoveryDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      discoveryImages: ['IMG_20260509_101522.jpg'],
      status: HAZARD_STATUS.RECTIFYING,
      responsibleTeamId: 'team-004',
      rectifyDeadline: new Date(now.getTime() + 0.5 * 24 * 60 * 60 * 1000).toISOString(),
      rectificationCount: 0,
      reviewFailCount: 0,
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'hz-0004',
      type: '消防通道',
      location: '生活区宿舍楼东侧',
      description: '消防通道被材料和工具堵塞，通道宽度不足1米',
      level: HAZARD_LEVEL.GENERAL,
      discoverer: '安全员-陈',
      discoveryDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      discoveryImages: ['IMG_20260511_164011.jpg', 'IMG_20260511_164023.jpg'],
      status: HAZARD_STATUS.DISCOVERED,
      responsibleTeamId: 'team-003',
      rectifyDeadline: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      rectificationCount: 0,
      reviewFailCount: 0,
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'hz-0005',
      type: '临边防护',
      location: '1号楼5层西单元',
      description: '电梯井口防护门未关闭，无警示标识',
      level: HAZARD_LEVEL.MAJOR,
      discoverer: '安全员-刘',
      discoveryDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      discoveryImages: ['IMG_20260510_092517.jpg'],
      status: HAZARD_STATUS.REOPENED,
      responsibleTeamId: 'team-001',
      rectifyDeadline: new Date(now.getTime() - 0.5 * 24 * 60 * 60 * 1000).toISOString(),
      rectificationCount: 1,
      reviewFailCount: 1,
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 0.5 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const rectifications = [
    {
      id: 'rt-0001',
      hazardId: 'hz-0001',
      description: '已安装临边防护栏杆，设置红白警示带，张贴警示标识',
      images: ['IMG_20260506_101501.jpg', 'IMG_20260506_101515.jpg'],
      rectifier: '张工（土建一班）',
      rectificationDate: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'rt-0002',
      hazardId: 'hz-0002',
      description: '已重新布线，安装漏电保护器，使用绝缘套管',
      images: ['IMG_20260508_153001.jpg', 'IMG_20260508_153015.jpg'],
      rectifier: '李工（水电二班）',
      rectificationDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'rt-0003',
      hazardId: 'hz-0002',
      description: '二次整改：增加绝缘保护，整理线路走向',
      images: ['IMG_20260510_142001.jpg', 'IMG_20260510_142015.jpg'],
      rectifier: '李工（水电二班）',
      rectificationDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'rt-0004',
      hazardId: 'hz-0005',
      description: '已关闭电梯井口防护门，张贴警示标识',
      images: ['IMG_20260510_163001.jpg'],
      rectifier: '张工（土建一班）',
      rectificationDate: new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const reviews = [
    {
      id: 'rv-0001',
      hazardId: 'hz-0001',
      result: REVIEW_RESULT.PASSED,
      reviewer: '安全员-刘',
      comment: '临边防护已按要求整改，防护栏杆安装牢固，警示标识齐全',
      images: ['IMG_20260507_093001.jpg'],
      reviewDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'rv-0002',
      hazardId: 'hz-0002',
      result: REVIEW_RESULT.FAILED,
      reviewer: '安全员-刘',
      comment: '整改不彻底：部分线路仍有裸线外露，漏电保护器未接地',
      images: ['IMG_20260509_103001.jpg'],
      reviewDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'rv-0003',
      hazardId: 'hz-0005',
      result: REVIEW_RESULT.FAILED,
      reviewer: '安全员-陈',
      comment: '防护门未加锁，无法防止意外打开',
      images: ['IMG_20260511_113001.jpg'],
      reviewDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const fines = [
    {
      id: 'fn-0001',
      hazardId: 'hz-0002',
      teamId: 'team-002',
      amount: 15000,
      reason: '特大用电安全隐患整改复查不通过，累计复查失败1次',
      operator: '安全主管-王',
      paid: false,
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'fn-0002',
      hazardId: 'hz-0005',
      teamId: 'team-001',
      amount: 3000,
      reason: '重大临边防护隐患整改复查不通过，累计复查失败1次',
      operator: '安全主管-王',
      paid: false,
      createdAt: new Date(now.getTime() - 0.5 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const audit = [
    {
      id: 'ad-0001',
      action: 'create',
      entityType: 'hazard',
      entityId: 'hz-0001',
      details: hazards[0],
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'ad-0002',
      action: 'rectify',
      entityType: 'hazard',
      entityId: 'hz-0001',
      details: { rectificationId: 'rt-0001', rectifier: '张工（土建一班）', imageCount: 2 },
      createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'ad-0003',
      action: 'review',
      entityType: 'hazard',
      entityId: 'hz-0001',
      details: { reviewId: 'rv-0001', result: 'passed', reviewer: '安全员-刘', isReopened: false },
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'ad-0004',
      action: 'status_change',
      entityType: 'hazard',
      entityId: 'hz-0001',
      details: { oldStatus: 'pending_review', newStatus: 'closed' },
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  return {
    teams,
    hazards,
    rectifications,
    reviews,
    fines,
    audit
  };
}

module.exports = {
  getSampleData
};
