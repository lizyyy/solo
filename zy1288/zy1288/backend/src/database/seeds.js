const { run, get, COURSES, RESPONSIBLES } = require('./database');

const getRandomStatus = () => {
  const statuses = ['new', 'contacting', 'appointed', 'attended', 'no_show', 'cancelled', 'converted', 'not_interested', 'lost', 'reappointed'];
  return statuses[Math.floor(Math.random() * statuses.length)];
};

const getRandomCourse = () => {
  return COURSES[Math.floor(Math.random() * COURSES.length)];
};

const getRandomResponsible = () => {
  return RESPONSIBLES[Math.floor(Math.random() * RESPONSIBLES.length)];
};

const getRandomPhone = () => {
  const prefixes = ['138', '139', '150', '151', '186', '187', '188', '135', '136', '177'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return prefix + suffix;
};

const getRandomDate = () => {
  const today = new Date();
  const days = Math.floor(Math.random() * 60) - 10;
  const hours = 9 + Math.floor(Math.random() * 10);
  const minutes = [0, 30][Math.floor(Math.random() * 2)];
  
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

const seedData = [
  {
    name: '张三',
    phone: '13800138001',
    course: 'Python编程体验课',
    appointment_time: '2026-05-10 14:00',
    status: 'new',
    responsible: '张顾问',
    notes: '对Python编程感兴趣，想先体验一下'
  },
  {
    name: '李四',
    phone: '13900139002',
    course: '少儿Scratch编程',
    appointment_time: '2026-05-08 10:00',
    status: 'contacting',
    responsible: '李顾问',
    notes: '家长想让孩子从Scratch开始入门'
  },
  {
    name: '王五',
    phone: '15000150003',
    course: 'Web前端开发入门',
    appointment_time: '2026-05-05 15:30',
    status: 'appointed',
    responsible: '王顾问',
    notes: '刚毕业想转行做前端开发'
  },
  {
    name: '赵六',
    phone: '18600186004',
    course: '数据科学基础',
    appointment_time: '2026-05-03 09:00',
    status: 'attended',
    responsible: '赵顾问',
    notes: '已经参加过体验课，对数据分析很感兴趣'
  },
  {
    name: '钱七',
    phone: '18700187005',
    course: '人工智能入门',
    appointment_time: '2026-05-01 14:00',
    status: 'no_show',
    responsible: '刘顾问',
    notes: '预约了但没来，需要跟进'
  },
  {
    name: '孙八',
    phone: '13500135006',
    course: '机器人编程',
    appointment_time: '2026-05-02 16:00',
    status: 'cancelled',
    responsible: '陈顾问',
    notes: '临时有事取消了，下次再约'
  },
  {
    name: '周九',
    phone: '13600136007',
    course: '游戏开发入门',
    appointment_time: '2026-04-28 10:30',
    status: 'converted',
    responsible: '张顾问',
    notes: '体验后报名了正式课程'
  },
  {
    name: '吴十',
    phone: '17700177008',
    course: '大数据技术基础',
    appointment_time: '2026-04-25 14:00',
    status: 'not_interested',
    responsible: '李顾问',
    notes: '参加后表示暂时没有学习计划'
  },
  {
    name: '郑十一',
    phone: '18800188009',
    course: 'Python编程体验课',
    appointment_time: '2026-05-15 09:00',
    status: 'reappointed',
    responsible: '王顾问',
    notes: '之前没来，重新预约了'
  },
  {
    name: '冯十二',
    phone: '15100151010',
    course: '少儿Scratch编程',
    appointment_time: '2026-05-12 15:00',
    status: 'new',
    responsible: '赵顾问',
    notes: '刚咨询完，还没跟进'
  }
];

const seedDatabase = async () => {
  try {
    const countResult = await get('SELECT COUNT(*) as count FROM leads');
    const existingCount = countResult.count;
    
    if (existingCount > 0) {
      console.log(`数据库中已有 ${existingCount} 条记录，跳过种子数据插入`);
      return;
    }

    const insertLead = `
      INSERT INTO leads (name, phone, course, appointment_time, status, responsible, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    for (const lead of seedData) {
      await run(insertLead, [
        lead.name,
        lead.phone,
        lead.course,
        lead.appointment_time,
        lead.status,
        lead.responsible,
        lead.notes
      ]);
    }

    for (let i = 0; i < 10; i++) {
      const randomLead = {
        name: `学员${i + 13}`,
        phone: getRandomPhone(),
        course: getRandomCourse(),
        appointment_time: getRandomDate(),
        status: getRandomStatus(),
        responsible: getRandomResponsible(),
        notes: i % 2 === 0 ? '自动生成的测试数据' : ''
      };
      await run(insertLead, [
        randomLead.name,
        randomLead.phone,
        randomLead.course,
        randomLead.appointment_time,
        randomLead.status,
        randomLead.responsible,
        randomLead.notes
      ]);
    }

    const totalResult = await get('SELECT COUNT(*) as count FROM leads');
    const totalCount = totalResult.count;
    console.log(`种子数据插入完成，共 ${totalCount} 条记录`);
  } catch (err) {
    console.error('种子数据插入失败:', err.message);
  }
};

module.exports = {
  seedDatabase
};
