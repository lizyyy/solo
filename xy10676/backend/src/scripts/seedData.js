const db = require('../database/db');

const users = [
  { username: 'admin', name: '系统管理员', role: 'manager' },
  { username: 'manager1', name: '张经理', role: 'manager' },
  { username: 'user1', name: '李员工', role: 'user' },
  { username: 'user2', name: '王员工', role: 'user' }
];

const today = new Date();
const getDate = (days) => {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const contracts = [
  {
    contract_no: 'HT-2024-001',
    contract_name: '软件开发服务合同',
    party_a: '甲方科技有限公司',
    party_b: '乙方软件公司',
    contract_amount: 500000.00,
    start_date: getDate(-60),
    end_date: getDate(20),
    renewal_clause: '双方无异议自动续约1年',
    electronic_sign_status: 'signed',
    paper_archived: 1,
    payment_nodes: JSON.stringify([
      { date: getDate(-60), amount: 150000, description: '首付款' },
      { date: getDate(-30), amount: 200000, description: '中期款' },
      { date: getDate(20), amount: 150000, description: '尾款' }
    ]),
    responsible_person: '李员工',
    status: 'active'
  },
  {
    contract_no: 'HT-2024-002',
    contract_name: '设备采购合同',
    party_a: '甲方科技有限公司',
    party_b: '丙方设备厂',
    contract_amount: 300000.00,
    start_date: getDate(-30),
    end_date: getDate(5),
    renewal_clause: '',
    electronic_sign_status: 'pending',
    paper_archived: 0,
    payment_nodes: JSON.stringify([
      { date: getDate(-30), amount: 90000, description: '首付款' },
      { date: getDate(5), amount: 210000, description: '尾款' }
    ]),
    responsible_person: '王员工',
    status: 'active'
  },
  {
    contract_no: 'HT-2024-003',
    contract_name: '年度运维服务合同',
    party_a: '甲方科技有限公司',
    party_b: '丁方运维公司',
    contract_amount: 120000.00,
    start_date: getDate(-180),
    end_date: getDate(-10),
    renewal_clause: '到期前30天协商续约',
    electronic_sign_status: 'signed',
    paper_archived: 1,
    payment_nodes: JSON.stringify([
      { date: getDate(-180), amount: 60000, description: '上半年' },
      { date: getDate(-90), amount: 60000, description: '下半年' }
    ]),
    responsible_person: '李员工',
    status: 'expired'
  },
  {
    contract_no: 'HT-2024-004',
    contract_name: '咨询服务合同',
    party_a: '甲方科技有限公司',
    party_b: '戊方咨询公司',
    contract_amount: 80000.00,
    start_date: getDate(-15),
    end_date: getDate(75),
    renewal_clause: '项目结束后可续签',
    electronic_sign_status: 'pending',
    paper_archived: 0,
    payment_nodes: JSON.stringify([
      { date: getDate(-15), amount: 40000, description: '启动款' },
      { date: getDate(30), amount: 40000, description: '结题款' }
    ]),
    responsible_person: '王员工',
    status: 'active'
  }
];

const insertUser = 'INSERT INTO users (username, name, role) VALUES (?, ?, ?)';
const insertContract = `INSERT INTO contracts 
  (contract_no, contract_name, party_a, party_b, contract_amount, start_date, end_date, 
   renewal_clause, electronic_sign_status, paper_archived, payment_nodes, responsible_person, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

let userCount = 0;
users.forEach(user => {
  db.run(insertUser, [user.username, user.name, user.role], (err) => {
    if (!err) userCount++;
    if (userCount === users.length) {
      console.log(`插入 ${userCount} 个用户`);
    }
  });
});

let contractCount = 0;
contracts.forEach(c => {
  db.run(insertContract, [
    c.contract_no, c.contract_name, c.party_a, c.party_b, c.contract_amount,
    c.start_date, c.end_date, c.renewal_clause, c.electronic_sign_status,
    c.paper_archived, c.payment_nodes, c.responsible_person, c.status
  ], (err) => {
    if (!err) contractCount++;
    if (contractCount === contracts.length) {
      console.log(`插入 ${contractCount} 个合同`);
      console.log('样例数据插入完成！');
      db.close();
    }
  });
});
