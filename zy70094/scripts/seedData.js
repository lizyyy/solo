const { initDatabase, runQuery } = require('../database');
const { v4: uuidv4 } = require('uuid');

const getCurrentTime = () => new Date().toISOString();

const sampleApplications = [
  {
    applicant_name: '张三',
    contact_phone: '13800138001',
    address: '北京市朝阳区阳光小区1号楼2单元301室',
    pv_capacity: 10.5,
    status: 'GRID_CONNECTED',
    remark: '屋顶光伏并网项目'
  },
  {
    applicant_name: '李四',
    contact_phone: '13800138002',
    address: '上海市浦东新区新能源家园5号楼101室',
    pv_capacity: 8.0,
    status: 'METER_INSTALLED',
    remark: '家庭分布式光伏'
  },
  {
    applicant_name: '王五',
    contact_phone: '13800138003',
    address: '广州市天河区绿色小区3号楼201室',
    pv_capacity: 15.0,
    status: 'APPROVED',
    remark: '商业用房光伏项目'
  },
  {
    applicant_name: '赵六',
    contact_phone: '13800138004',
    address: '深圳市南山区科技园A栋501室',
    pv_capacity: 5.5,
    status: 'PENDING_APPROVAL',
    remark: '小规模住宅光伏'
  },
  {
    applicant_name: '孙七',
    contact_phone: '13800138005',
    address: '杭州市西湖区阳光路88号',
    pv_capacity: 12.0,
    status: 'SURVEY_COMPLETED',
    remark: '别墅屋顶光伏'
  },
  {
    applicant_name: '周八',
    contact_phone: '13800138006',
    address: '成都市锦江区新能源路66号',
    pv_capacity: 20.0,
    status: 'PENDING_SURVEY',
    remark: '大型商业光伏'
  },
  {
    applicant_name: '吴九',
    contact_phone: '13800138007',
    address: '南京市鼓楼区绿色大道123号',
    pv_capacity: 6.0,
    status: 'SUBMITTED',
    remark: '新装户光伏申请'
  },
  {
    applicant_name: '郑十',
    contact_phone: '13800138008',
    address: '武汉市江汉区光伏路99号',
    pv_capacity: 9.0,
    status: 'PENDING_SUPPLEMENT',
    remark: '需要补充身份证明材料'
  },
  {
    applicant_name: '刘一',
    contact_phone: '13800138009',
    address: '西安市雁塔区能源大道456号',
    pv_capacity: 7.5,
    status: 'REJECTED',
    remark: '房屋产权不清晰'
  },
  {
    applicant_name: '陈二',
    contact_phone: '13800138010',
    address: '天津市和平区绿色家园8号楼302室',
    pv_capacity: 11.0,
    status: 'CANCELLED',
    remark: '用户主动取消申请'
  }
];

async function seedData() {
  try {
    await initDatabase();
    console.log('开始初始化数据...');
    
    const currentTime = getCurrentTime();
    
    for (const appData of sampleApplications) {
      const id = uuidv4();
      await runQuery(
        `INSERT INTO applications (id, applicant_name, contact_phone, address, pv_capacity, status, submit_time, update_time, remark, version, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, appData.applicant_name, appData.contact_phone, appData.address, appData.pv_capacity, appData.status, currentTime, currentTime, appData.remark, 1, 0]
      );
      
      const logId = uuidv4();
      await runQuery(
        `INSERT INTO operation_logs (id, application_id, operation_type, operator, before_state, after_state, remark, create_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [logId, id, 'APPLICATION_SUBMIT', 'seed', null, JSON.stringify({ status: appData.status }), `初始化数据 - ${appData.applicant_name}`, currentTime]
      );
      
      console.log(`创建申请单: ${appData.applicant_name} (ID: ${id})`);
    }
    
    console.log('\n数据初始化完成！');
    console.log('共创建了', sampleApplications.length, '条申请单记录');
    console.log('可通过 GET /api/applications 查看所有申请单');
    
    process.exit(0);
  } catch (error) {
    console.error('数据初始化失败:', error);
    process.exit(1);
  }
}

seedData();
