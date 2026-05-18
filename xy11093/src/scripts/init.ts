import fs from 'fs';
import path from 'path';
import { createTables, dropTables } from '../database/init';
import { createEmployee } from '../services/employeeService';
import { createCourse } from '../services/courseService';
import { createSigninSupplement } from '../services/signinService';

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function initDatabase() {
  console.log('开始初始化数据库...');

  await dropTables();
  console.log('已清空旧数据');

  await createTables();
  console.log('数据库表创建完成');

  console.log('\n创建员工数据...');
  const employee1 = await createEmployee({
    employeeNo: 'EMP001',
    name: '张三',
    department: '技术部',
    isRemote: false,
    location: '北京'
  });
  console.log('创建员工:', employee1.name, employee1.id);

  const employee2 = await createEmployee({
    employeeNo: 'EMP002',
    name: '李四',
    department: '市场部',
    isRemote: true,
    location: '上海'
  });
  console.log('创建员工:', employee2.name, employee2.id);

  const employee3 = await createEmployee({
    employeeNo: 'EMP003',
    name: '王五',
    department: '人事部',
    isRemote: false,
    location: '北京'
  });
  console.log('创建员工:', employee3.name, employee3.id);

  console.log('\n创建培训课程...');
  const course1 = await createCourse({
    courseCode: 'TRAIN-2024-001',
    courseName: '企业内训-领导力培训',
    trainingDate: '2024-01-15',
    trainingLocation: '总部A座3楼会议室',
    totalSeats: 50
  });
  console.log('创建课程:', course1.courseName, course1.id);

  const course2 = await createCourse({
    courseCode: 'TRAIN-2024-002',
    courseName: '企业内训-技术能力提升',
    trainingDate: '2024-01-20',
    trainingLocation: '总部B座2楼培训室',
    totalSeats: 30
  });
  console.log('创建课程:', course2.courseName, course2.id);

  console.log('\n创建签到补录样例数据...');

  const record1 = await createSigninSupplement({
    employeeId: employee1.id,
    courseId: course1.id,
    signinType: 'offline',
    seatNumber: 5,
    signinTime: '2024-01-15T09:00:00Z',
    submitterId: 'ADMIN001',
    submitterName: '管理员'
  });
  console.log('创建正常记录1:', record1.recordNo, '状态:', record1.status);

  const record2 = await createSigninSupplement({
    employeeId: employee2.id,
    courseId: course1.id,
    signinType: 'offline',
    seatNumber: 10,
    signinTime: '2024-01-15T09:05:00Z',
    submitterId: 'ADMIN001',
    submitterName: '管理员'
  });
  console.log('创建异常记录1(外地员工误算线下):', record2.recordNo, '状态:', record2.status);
  console.log('  异常原因:', record2.businessExplanation);

  const record3 = await createSigninSupplement({
    employeeId: employee3.id,
    courseId: course1.id,
    signinType: 'offline',
    signinTime: '2024-01-15T09:10:00Z',
    submitterId: 'ADMIN001',
    submitterName: '管理员'
  });
  console.log('创建异常记录2(缺少座位号):', record3.recordNo, '状态:', record3.status);
  console.log('  异常原因:', record3.businessExplanation);

  const record4 = await createSigninSupplement({
    employeeId: employee1.id,
    courseId: course2.id,
    signinType: 'online',
    signinTime: '2024-01-20T14:00:00Z',
    submitterId: 'ADMIN001',
    submitterName: '管理员'
  });
  console.log('创建正常记录2(线上签到):', record4.recordNo, '状态:', record4.status);

  const record5 = await createSigninSupplement({
    employeeId: employee3.id,
    courseId: course1.id,
    signinType: 'offline',
    seatNumber: 5,
    signinTime: '2024-01-15T09:15:00Z',
    submitterId: 'ADMIN001',
    submitterName: '管理员'
  });
  console.log('创建异常记录3(座位冲突):', record5.recordNo, '状态:', record5.status);
  console.log('  异常原因:', record5.businessExplanation);

  console.log('\n初始化完成!');
  console.log('\n数据摘要:');
  console.log('- 员工数: 3');
  console.log('- 课程数: 2');
  console.log('- 正常签到记录数: 2');
  console.log('- 异常签到记录数: 3');
  console.log('\n可以运行 npm run test 进行测试');
}

initDatabase().catch(console.error);
