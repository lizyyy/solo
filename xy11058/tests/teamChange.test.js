const request = require('supertest');
const app = require('../src/app');
const { sequelize, TeamChangeApplication, InsuranceList, TeamMember } = require('../src/models');

const testData = {
  studyProgramId: 1,
  studyProgramName: '2024夏季户外研学营',
  studentId: 1001,
  studentName: '张三',
  studentIdCard: '110101201001011234',
  parentContact: '13800138000',
  originalTeamId: 1,
  originalTeamName: '雄鹰队',
  originalTeamLeader: '李老师',
  targetTeamId: 2,
  targetTeamName: '猛虎队',
  targetTeamLeader: '王老师',
  changeReason: '孩子与原分队同学有矛盾，希望调队',
  changeReasonType: '其他'
};

const operator1 = { operatorId: 1, operatorName: '张老师' };
const operator2 = { operatorId: 2, operatorName: '王主任' };
const operator3 = { operatorId: 3, operatorName: '李校长' };

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('户外研学改队申请基础流程测试', () => {
  test('创建改队申请草稿成功', async () => {
    const response = await request(app)
      .post('/api/team-change')
      .send({ ...testData, ...operator1 });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('草稿');
    expect(response.body.data.studentName).toBe('张三');
    expect(response.body.data.applicationNo).toBeDefined();
  });

  test('提交改队申请成功', async () => {
    const createResponse = await request(app)
      .post('/api/team-change')
      .send({ ...testData, ...operator1 });
    
    const applicationId = createResponse.body.data.id;
    
    const submitResponse = await request(app)
      .post(`/api/team-change/${applicationId}/submit`)
      .send(operator1);
    
    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.success).toBe(true);
    expect(submitResponse.body.data.status).toBe('待审核');
  });

  test('查询改队申请列表成功', async () => {
    const response = await request(app)
      .get('/api/team-change')
      .query({ page: 1, pageSize: 10 });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.total).toBeGreaterThan(0);
    expect(Array.isArray(response.body.data.list)).toBe(true);
  });

  test('查询改队申请详情成功', async () => {
    const createResponse = await request(app)
      .post('/api/team-change')
      .send({ ...testData, ...operator1 });
    
    const applicationId = createResponse.body.data.id;
    
    const detailResponse = await request(app)
      .get(`/api/team-change/${applicationId}`);
    
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.success).toBe(true);
    expect(detailResponse.body.data.id).toBe(applicationId);
  });
});

describe('改队申请修改历史记录测试', () => {
  test('每次操作都记录历史', async () => {
    const createResponse = await request(app)
      .post('/api/team-change')
      .send({ ...testData, ...operator1 });
    
    const applicationId = createResponse.body.data.id;
    
    await request(app)
      .post(`/api/team-change/${applicationId}/submit`)
      .send(operator1);
    
    const historyResponse = await request(app)
      .get(`/api/team-change/${applicationId}/history`);
    
    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.success).toBe(true);
    expect(historyResponse.body.data.length).toBeGreaterThanOrEqual(2);
    
    const createHistory = historyResponse.body.data.find(h => h.operationType === '创建');
    const submitHistory = historyResponse.body.data.find(h => h.operationType === '提交');
    
    expect(createHistory).toBeDefined();
    expect(submitHistory).toBeDefined();
  });
});

describe('撤回后再次提交测试', () => {
  test('撤回申请后可以再次提交', async () => {
    const createResponse = await request(app)
      .post('/api/team-change')
      .send({ ...testData, ...operator1 });
    
    const applicationId = createResponse.body.data.id;
    
    await request(app)
      .post(`/api/team-change/${applicationId}/submit`)
      .send(operator1);
    
    const withdrawResponse = await request(app)
      .post(`/api/team-change/${applicationId}/withdraw`)
      .send({ ...operator1, reason: '需要补充材料' });
    
    expect(withdrawResponse.status).toBe(200);
    expect(withdrawResponse.body.data.status).toBe('已撤回');
    
    const resubmitResponse = await request(app)
      .post(`/api/team-change/${applicationId}/submit`)
      .send({ ...operator1, changeReason: '更新后的改队原因' });
    
    expect(resubmitResponse.status).toBe(200);
    expect(resubmitResponse.body.data.status).toBe('待审核');
    
    const historyResponse = await request(app)
      .get(`/api/team-change/${applicationId}/history`);
    
    const withdrawHistory = historyResponse.body.data.find(h => h.operationType === '撤回');
    const secondSubmitHistory = historyResponse.body.data.filter(h => h.operationType === '提交');
    
    expect(withdrawHistory).toBeDefined();
    expect(secondSubmitHistory.length).toBe(2);
  });
});

describe('保险名单同步测试', () => {
  test('改队通过后保险名单未同步时能正确检测并同步', async () => {
    const createResponse = await request(app)
      .post('/api/team-change')
      .send({ ...testData, ...operator1 });
    
    const applicationId = createResponse.body.data.id;
    
    await InsuranceList.create({
      studyProgramId: testData.studyProgramId,
      teamId: testData.originalTeamId,
      studentId: testData.studentId,
      studentName: testData.studentName,
      studentIdCard: testData.studentIdCard,
      insurancePolicyNo: 'INS2024001',
      insuranceType: '综合险',
      effectiveDate: new Date(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: '有效'
    });
    
    await request(app)
      .post(`/api/team-change/${applicationId}/submit`)
      .send(operator1);
    
    const application = await TeamChangeApplication.findByPk(applicationId);
    await application.update({ status: '审核中' });
    
    const approveResponse = await request(app)
      .post(`/api/team-change/${applicationId}/approve`)
      .send({ ...operator3, remark: '审核通过' });
    
    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.status).toBe('已通过');
    expect(approveResponse.body.data.insuranceSynced).toBe(false);
    
    const syncResponse = await request(app)
      .post(`/api/team-change/${applicationId}/sync-insurance`)
      .send(operator2);
    
    expect(syncResponse.status).toBe(200);
    expect(syncResponse.body.success).toBe(true);
    
    const updatedApplication = await TeamChangeApplication.findByPk(applicationId);
    expect(updatedApplication.insuranceSynced).toBe(true);
    
    const originalInsurance = await InsuranceList.findOne({
      where: {
        studyProgramId: testData.studyProgramId,
        teamId: testData.originalTeamId,
        studentId: testData.studentId
      }
    });
    expect(originalInsurance.status).toBe('已变更');
    
    const newInsurance = await InsuranceList.findOne({
      where: {
        studyProgramId: testData.studyProgramId,
        teamId: testData.targetTeamId,
        studentId: testData.studentId
      }
    });
    expect(newInsurance).toBeDefined();
    expect(newInsurance.status).toBe('有效');
  });

  test('未通过审核的申请不能同步保险名单', async () => {
    const createResponse = await request(app)
      .post('/api/team-change')
      .send({ ...testData, ...operator1 });
    
    const applicationId = createResponse.body.data.id;
    
    const syncResponse = await request(app)
      .post(`/api/team-change/${applicationId}/sync-insurance`)
      .send(operator2);
    
    expect(syncResponse.status).toBe(400);
    expect(syncResponse.body.message).toContain('只有已通过的申请才能同步保险名单');
  });
});

describe('分队表一致性校验测试', () => {
  test('改队后分队表不一致时能正确检测并修正', async () => {
    const createResponse = await request(app)
      .post('/api/team-change')
      .send({
        ...testData,
        studentId: 1002,
        studentName: '李四',
        ...operator1
      });
    
    const applicationId = createResponse.body.data.id;
    
    await TeamMember.create({
      studyProgramId: testData.studyProgramId,
      teamId: testData.originalTeamId,
      teamName: testData.originalTeamName,
      studentId: 1002,
      studentName: '李四',
      studentIdCard: '110101201001015678',
      parentContact: testData.parentContact,
      role: '队员',
      isActive: true
    });
    
    const application = await TeamChangeApplication.findByPk(applicationId);
    await application.update({ status: '已通过' });
    
    expect(application.teamConsistent).toBe(false);
    
    const checkResponse = await request(app)
      .post(`/api/team-change/${applicationId}/check-team-consistency`)
      .send(operator2);
    
    expect(checkResponse.status).toBe(200);
    expect(checkResponse.body.success).toBe(true);
    
    const updatedApplication = await TeamChangeApplication.findByPk(applicationId);
    expect(updatedApplication.teamConsistent).toBe(true);
    
    const originalMember = await TeamMember.findOne({
      where: {
        studyProgramId: testData.studyProgramId,
        teamId: testData.originalTeamId,
        studentId: 1002
      }
    });
    expect(originalMember.isActive).toBe(false);
    
    const newMember = await TeamMember.findOne({
      where: {
        studyProgramId: testData.studyProgramId,
        teamId: testData.targetTeamId,
        studentId: 1002
      }
    });
    expect(newMember).toBeDefined();
    expect(newMember.isActive).toBe(true);
  });

  test('原分队无该学生时校验失败', async () => {
    const createResponse = await request(app)
      .post('/api/team-change')
      .send({
        ...testData,
        studentId: 1003,
        studentName: '王五',
        ...operator1
      });
    
    const applicationId = createResponse.body.data.id;
    
    const application = await TeamChangeApplication.findByPk(applicationId);
    await application.update({ status: '已通过' });
    
    const checkResponse = await request(app)
      .post(`/api/team-change/${applicationId}/check-team-consistency`)
      .send(operator2);
    
    expect(checkResponse.status).toBe(400);
    expect(checkResponse.body.message).toContain('原分队表中未找到该学生');
  });
});

describe('状态越级流转测试', () => {
  test('草稿状态不能直接审核通过', async () => {
    const createResponse = await request(app)
      .post('/api/team-change')
      .send({ ...testData, ...operator1 });
    
    const applicationId = createResponse.body.data.id;
    
    const approveResponse = await request(app)
      .post(`/api/team-change/${applicationId}/approve`)
      .send(operator3);
    
    expect(approveResponse.status).toBe(400);
    expect(approveResponse.body.message).toContain('状态流转不允许');
  });

  test('已撤回状态不能直接审核拒绝', async () => {
    const createResponse = await request(app)
      .post('/api/team-change')
      .send({ ...testData, ...operator1 });
    
    const applicationId = createResponse.body.data.id;
    
    const application = await TeamChangeApplication.findByPk(applicationId);
    await application.update({ status: '已撤回' });
    
    const rejectResponse = await request(app)
      .post(`/api/team-change/${applicationId}/reject`)
      .send(operator3);
    
    expect(rejectResponse.status).toBe(400);
    expect(rejectResponse.body.message).toContain('状态流转不允许');
  });
});

describe('重复调用测试', () => {
  test('重复提交保险同步应正确处理', async () => {
    const createResponse = await request(app)
      .post('/api/team-change')
      .send({
        ...testData,
        studentId: 1004,
        studentName: '赵六',
        ...operator1
      });
    
    const applicationId = createResponse.body.data.id;
    
    await InsuranceList.create({
      studyProgramId: testData.studyProgramId,
      teamId: testData.originalTeamId,
      studentId: 1004,
      studentName: '赵六',
      studentIdCard: '110101201001019012',
      insurancePolicyNo: 'INS2024002',
      insuranceType: '综合险',
      effectiveDate: new Date(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: '有效'
    });
    
    const application = await TeamChangeApplication.findByPk(applicationId);
    await application.update({ status: '已通过' });
    
    const firstSync = await request(app)
      .post(`/api/team-change/${applicationId}/sync-insurance`)
      .send(operator2);
    
    expect(firstSync.status).toBe(200);
    
    const secondSync = await request(app)
      .post(`/api/team-change/${applicationId}/sync-insurance`)
      .send(operator2);
    
    expect(secondSync.status).toBe(400);
    expect(secondSync.body.message).toContain('目标分队保险名单中已存在该学生');
  });
});

describe('坏数据处理测试', () => {
  test('缺少必要字段时返回错误', async () => {
    const response = await request(app)
      .post('/api/team-change')
      .send({ studentName: '测试' });
    
    expect(response.status).toBe(400);
  });

  test('操作人信息缺失时返回错误', async () => {
    const response = await request(app)
      .post('/api/team-change')
      .send({ ...testData });
    
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('操作人ID和姓名不能为空');
  });

  test('查询不存在的申请返回错误', async () => {
    const response = await request(app)
      .get('/api/team-change/999999');
    
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('改队申请不存在');
  });
});

describe('人工处理流程测试', () => {
  test('进入人工处理后可以添加备注并再次提交', async () => {
    const createResponse = await request(app)
      .post('/api/team-change')
      .send({
        ...testData,
        studentId: 1005,
        studentName: '钱七',
        ...operator1
      });
    
    const applicationId = createResponse.body.data.id;
    
    await request(app)
      .post(`/api/team-change/${applicationId}/submit`)
      .send(operator1);
    
    const application = await TeamChangeApplication.findByPk(applicationId);
    await application.update({ status: '审核中' });
    
    const manualResponse = await request(app)
      .post(`/api/team-change/${applicationId}/manual-process`)
      .send({
        handlerId: 2,
        handlerName: '王主任',
        remark: '需要进一步核实情况'
      });
    
    expect(manualResponse.status).toBe(200);
    expect(manualResponse.body.data.status).toBe('人工处理中');
    expect(manualResponse.body.data.currentHandlerName).toBe('王主任');
    
    const remarkResponse = await request(app)
      .post(`/api/team-change/${applicationId}/remark`)
      .send({
        ...operator2,
        remark: '已联系家长确认情况，属实'
      });
    
    expect(remarkResponse.status).toBe(200);
    expect(remarkResponse.body.data.remark).toContain('已联系家长确认情况');
    
    const finalApproveResponse = await request(app)
      .post(`/api/team-change/${applicationId}/approve`)
      .send({ ...operator3, remark: '最终审核通过' });
    
    expect(finalApproveResponse.status).toBe(200);
    expect(finalApproveResponse.body.data.status).toBe('已通过');
    
    const historyResponse = await request(app)
      .get(`/api/team-change/${applicationId}/history`);
    
    const manualHistory = historyResponse.body.data.find(h => h.operationType === '人工处理');
    const remarkHistory = historyResponse.body.data.find(h => h.operationType === '添加备注');
    const approveHistory = historyResponse.body.data.find(h => h.operationType === '审核通过');
    
    expect(manualHistory).toBeDefined();
    expect(remarkHistory).toBeDefined();
    expect(approveHistory).toBeDefined();
  });
});
