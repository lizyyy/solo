const initTables = require('../src/models/initTables');
const employeeDao = require('../src/daos/employeeDao');
const certificateDao = require('../src/daos/certificateDao');
const courseDao = require('../src/daos/courseDao');
const renewalDao = require('../src/daos/renewalDao');
const db = require('../src/config/database');

const getFutureDate = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const getPastDate = (years) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.toISOString().split('T')[0];
};

const findCertificateTypeByCode = (code) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM certificate_types WHERE code = ?', [code], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const findCourseByCode = (code) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM courses WHERE code = ?', [code], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const findEmployeeByNo = (employeeNo) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM employees WHERE employee_no = ?', [employeeNo], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const findPositionRequirement = (position, certTypeId) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM position_requirements WHERE position = ? AND certificate_type_id = ?',
      [position, certTypeId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
};

const findCourseScore = (employeeId, courseId, examDate) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM course_scores WHERE employee_id = ? AND course_id = ? AND exam_date = ?',
      [employeeId, courseId, examDate],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
};

const findRetakeByEmployeeAndCourse = (employeeId, courseId) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM retake_records WHERE employee_id = ? AND course_id = ? AND status = ?',
      [employeeId, courseId, 'pending'],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
};

const findEmployeeCertificate = (employeeId, certTypeId, issueDate) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM employee_certificates WHERE employee_id = ? AND certificate_type_id = ? AND issue_date = ?',
      [employeeId, certTypeId, issueDate],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
};

const findOrCreateCertificateType = async (certData) => {
  const existing = await findCertificateTypeByCode(certData.code);
  if (existing) {
    return { data: existing, isNew: false };
  }
  const created = await certificateDao.createCertificateType(certData);
  return { data: created, isNew: true };
};

const findOrCreateCourse = async (courseData) => {
  const existing = await findCourseByCode(courseData.code);
  if (existing) {
    return { data: existing, isNew: false };
  }
  const created = await courseDao.createCourse(courseData);
  return { data: created, isNew: true };
};

const findOrCreateEmployee = async (empData) => {
  const existing = await findEmployeeByNo(empData.employee_no);
  if (existing) {
    return { data: existing, isNew: false };
  }
  const created = await employeeDao.create(empData);
  return { data: created, isNew: true };
};

const initSampleData = async () => {
  console.log('开始初始化样例数据...\n');

  await initTables();
  
  let createdCount = {
    certTypes: 0,
    courses: 0,
    employees: 0,
    positionReqs: 0,
    empCerts: 0,
    scores: 0,
    retakes: 0
  };

  console.log('1. 创建证书类型...');
  const certResult1 = await findOrCreateCertificateType({
    code: 'SAFE-001',
    name: '安全生产资格证',
    valid_years: 3,
    description: '安全生产操作资格证书'
  });
  const certType1 = certResult1.data;
  if (certResult1.isNew) { createdCount.certTypes++; }
  console.log(`   ${certResult1.isNew ? '✓ 创建' : '↩️  已存在'}: 安全生产资格证`);

  const certResult2 = await findOrCreateCertificateType({
    code: 'TECH-001',
    name: '特种设备操作证',
    valid_years: 2,
    description: '特种设备操作资格证书'
  });
  const certType2 = certResult2.data;
  if (certResult2.isNew) { createdCount.certTypes++; }
  console.log(`   ${certResult2.isNew ? '✓ 创建' : '↩️  已存在'}: 特种设备操作证\n`);

  console.log('2. 创建课程...');
  const courseResult1 = await findOrCreateCourse({
    certificate_type_id: certType1.id,
    code: 'SAFE-101',
    name: '安全生产基础',
    passing_score: 60
  });
  const course1 = courseResult1.data;
  if (courseResult1.isNew) { createdCount.courses++; }
  console.log(`   ${courseResult1.isNew ? '✓ 创建' : '↩️  已存在'}: 安全生产基础`);

  const courseResult2 = await findOrCreateCourse({
    certificate_type_id: certType1.id,
    code: 'SAFE-102',
    name: '应急处理实务',
    passing_score: 60
  });
  const course2 = courseResult2.data;
  if (courseResult2.isNew) { createdCount.courses++; }
  console.log(`   ${courseResult2.isNew ? '✓ 创建' : '↩️  已存在'}: 应急处理实务\n`);

  console.log('3. 创建员工...');
  const empResult1 = await findOrCreateEmployee({
    employee_no: 'EMP001',
    name: '张三',
    department: '生产部',
    position: '操作员',
    status: 'active'
  });
  const employee1 = empResult1.data;
  if (empResult1.isNew) { createdCount.employees++; }
  console.log(`   ${empResult1.isNew ? '✓ 创建' : '↩️  已存在'}: 张三 (EMP001)`);

  const empResult2 = await findOrCreateEmployee({
    employee_no: 'EMP002',
    name: '李四',
    department: '生产部',
    position: '操作员',
    status: 'active'
  });
  const employee2 = empResult2.data;
  if (empResult2.isNew) { createdCount.employees++; }
  console.log(`   ${empResult2.isNew ? '✓ 创建' : '↩️  已存在'}: 李四 (EMP002)`);

  const empResult3 = await findOrCreateEmployee({
    employee_no: 'EMP003',
    name: '王五',
    department: '技术部',
    position: '高级工程师',
    status: 'active'
  });
  const employee3 = empResult3.data;
  if (empResult3.isNew) { createdCount.employees++; }
  console.log(`   ${empResult3.isNew ? '✓ 创建' : '↩️  已存在'}: 王五 (EMP003)\n`);

  console.log('4. 创建岗位要求...');
  const posReq1 = await findPositionRequirement('操作员', certType1.id);
  if (!posReq1) {
    await renewalDao.createPositionRequirement({
      position: '操作员',
      certificate_type_id: certType1.id,
      is_required: true
    });
    createdCount.positionReqs++;
    console.log('   ✓ 创建: 操作员需要安全生产资格证');
  } else {
    console.log('   ↩️  已存在: 操作员需要安全生产资格证');
  }

  const posReq2 = await findPositionRequirement('高级工程师', certType2.id);
  if (!posReq2) {
    await renewalDao.createPositionRequirement({
      position: '高级工程师',
      certificate_type_id: certType2.id,
      is_required: true
    });
    createdCount.positionReqs++;
    console.log('   ✓ 创建: 高级工程师需要特种设备操作证\n');
  } else {
    console.log('   ↩️  已存在: 高级工程师需要特种设备操作证\n');
  }

  console.log('5. 创建员工证书...');
  const empCertDate1 = getPastDate(2);
  const empCert1 = await findEmployeeCertificate(employee1.id, certType1.id, empCertDate1);
  if (!empCert1) {
    await certificateDao.createEmployeeCertificate({
      employee_id: employee1.id,
      certificate_type_id: certType1.id,
      issue_date: empCertDate1,
      expiry_date: getFutureDate(15),
      status: 'valid'
    }, null);
    createdCount.empCerts++;
    console.log('   ✓ 创建: 张三 - 安全生产资格证 (15天后过期)');
  } else {
    console.log('   ↩️  已存在: 张三 - 安全生产资格证');
  }

  const empCertDate2 = getPastDate(3);
  const empCert2 = await findEmployeeCertificate(employee2.id, certType1.id, empCertDate2);
  if (!empCert2) {
    await certificateDao.createEmployeeCertificate({
      employee_id: employee2.id,
      certificate_type_id: certType1.id,
      issue_date: empCertDate2,
      expiry_date: getFutureDate(45),
      status: 'valid'
    }, null);
    createdCount.empCerts++;
    console.log('   ✓ 创建: 李四 - 安全生产资格证 (45天后过期)\n');
  } else {
    console.log('   ↩️  已存在: 李四 - 安全生产资格证\n');
  }

  console.log('6. 创建课程成绩...');
  const scoreDate1 = getPastDate(2);
  const score1 = await findCourseScore(employee1.id, course1.id, scoreDate1);
  if (!score1) {
    await courseDao.createCourseScore({
      employee_id: employee1.id,
      course_id: course1.id,
      score: 85,
      exam_date: scoreDate1,
      is_passed: true
    });
    createdCount.scores++;
    console.log('   ✓ 创建: 张三 - 安全生产基础 85分 (通过)');
  } else {
    console.log('   ↩️  已存在: 张三 - 安全生产基础');
  }

  const scoreDate2 = getPastDate(1);
  let score2 = await findCourseScore(employee1.id, course2.id, scoreDate2);
  if (!score2) {
    score2 = await courseDao.createCourseScore({
      employee_id: employee1.id,
      course_id: course2.id,
      score: 55,
      exam_date: scoreDate2,
      is_passed: false
    });
    createdCount.scores++;
    console.log('   ✓ 创建: 张三 - 应急处理实务 55分 (未通过)');
  } else {
    console.log('   ↩️  已存在: 张三 - 应急处理实务');
  }

  const scoreDate3 = getPastDate(3);
  const score3 = await findCourseScore(employee2.id, course1.id, scoreDate3);
  if (!score3) {
    await courseDao.createCourseScore({
      employee_id: employee2.id,
      course_id: course1.id,
      score: 72,
      exam_date: scoreDate3,
      is_passed: true
    });
    createdCount.scores++;
    console.log('   ✓ 创建: 李四 - 安全生产基础 72分 (通过)');
  } else {
    console.log('   ↩️  已存在: 李四 - 安全生产基础');
  }

  const scoreDate4 = getPastDate(2);
  const score4 = await findCourseScore(employee2.id, course2.id, scoreDate4);
  if (!score4) {
    await courseDao.createCourseScore({
      employee_id: employee2.id,
      course_id: course2.id,
      score: 68,
      exam_date: scoreDate4,
      is_passed: true
    });
    createdCount.scores++;
    console.log('   ✓ 创建: 李四 - 应急处理实务 68分 (通过)\n');
  } else {
    console.log('   ↩️  已存在: 李四 - 应急处理实务\n');
  }

  console.log('7. 创建补考记录...');
  const existingRetake = await findRetakeByEmployeeAndCourse(employee1.id, course2.id);
  if (!existingRetake) {
    await courseDao.createRetakeRecord({
      original_score_id: score2.id || score2,
      employee_id: employee1.id,
      course_id: course2.id,
      retake_count: 1,
      status: 'pending'
    });
    createdCount.retakes++;
    console.log('   ✓ 创建: 张三 - 应急处理实务 待补考\n');
  } else {
    console.log('   ↩️  已存在: 张三 - 应急处理实务 待补考\n');
  }

  console.log('=============================================');
  console.log('✅ 样例数据初始化完成!');
  console.log('=============================================');
  console.log('\n本次新增数据:');
  console.log(`  - 证书类型: ${createdCount.certTypes} 个`);
  console.log(`  - 课程: ${createdCount.courses} 门`);
  console.log(`  - 员工: ${createdCount.employees} 人`);
  console.log(`  - 岗位要求: ${createdCount.positionReqs} 条`);
  console.log(`  - 员工证书: ${createdCount.empCerts} 本`);
  console.log(`  - 课程成绩: ${createdCount.scores} 条`);
  console.log(`  - 补考记录: ${createdCount.retakes} 条`);
  console.log('\n✅ 脚本支持重复调用，不会产生重复数据');
  console.log('\n现在可以启动服务: npm start');
};

initSampleData().catch(console.error);
