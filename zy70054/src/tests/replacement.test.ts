import request from 'supertest';
import { createApp } from '../app';
import { resetRepository } from '../storage/repository';
import { getLogger } from '../logger';
import { CreateReplacementRequest } from '../types';

const app = createApp();
const logger = getLogger();

beforeEach(() => {
  resetRepository();
  logger.clear();
  logger.setConsoleLogging(false);
});

function createTestRequest(): CreateReplacementRequest {
  return {
    userId: 'user_001',
    oldCardNumber: '6222021234567890',
    oldCardHolderName: '张三',
    replacementReason: '卡片丢失',
    shippingAddress: {
      province: '广东省',
      city: '深圳市',
      district: '南山区',
      detail: '科技园路 100 号',
      receiverName: '张三',
      receiverPhone: '13800138000'
    }
  };
}

async function createReplacement(): Promise<string> {
  const response = await request(app)
    .post('/api/replacement/create')
    .send(createTestRequest());

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  return response.body.data.id;
}

describe('主流程测试 - 正常换卡流程', () => {
  it('应该能够完成完整的换卡流程', async () => {
    const replacementId = await createReplacement();

    let statusRes = await request(app).get(`/api/replacement/${replacementId}/status`);
    expect(statusRes.body.data.status).toBe('IN_PROGRESS');
    expect(statusRes.body.data.progress).toBe(25);

    const freezeRes = await request(app)
      .post('/api/replacement/freeze')
      .send({
        replacementId,
        operatorId: 'op_001',
        operatorName: '风控员小王'
      });
    expect(freezeRes.status).toBe(200);
    expect(freezeRes.body.success).toBe(true);
    expect(freezeRes.body.data.currentStep).toBe('LOGISTICS');

    statusRes = await request(app).get(`/api/replacement/${replacementId}/status`);
    expect(statusRes.body.data.progress).toBe(50);

    await request(app)
      .post('/api/replacement/logistics')
      .send({
        replacementId,
        step: 'PICKED_UP',
        location: '深圳制卡中心',
        operator: '顺丰快递'
      });

    await request(app)
      .post('/api/replacement/logistics')
      .send({
        replacementId,
        step: 'IN_TRANSIT',
        location: '广州转运中心'
      });

    await request(app)
      .post('/api/replacement/logistics')
      .send({
        replacementId,
        step: 'ARRIVED',
        location: '深圳南山网点'
      });

    await request(app)
      .post('/api/replacement/logistics')
      .send({
        replacementId,
        step: 'DELIVERED',
        location: '派送中'
      });

    const logisticsFinishRes = await request(app)
      .post('/api/replacement/logistics')
      .send({
        replacementId,
        step: 'SIGNED',
        location: '本人签收',
        operator: '快递员小李'
      });

    expect(logisticsFinishRes.status).toBe(200);
    expect(logisticsFinishRes.body.data.steps.LOGISTICS.status).toBe('SUCCESS');
    expect(logisticsFinishRes.body.data.currentStep).toBe('ACTIVATION');

    const activateRes = await request(app)
      .post('/api/replacement/activate')
      .send({
        replacementId,
        newCardNumber: '6222020987654321',
        operatorId: 'op_002',
        operatorName: '客服小美'
      });

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.success).toBe(true);
    expect(activateRes.body.data.status).toBe('COMPLETED');

    statusRes = await request(app).get(`/api/replacement/${replacementId}/status`);
    expect(statusRes.body.data.status).toBe('COMPLETED');
    expect(statusRes.body.data.progress).toBe(100);

    const historyRes = await request(app).get(`/api/replacement/${replacementId}/history`);
    expect(historyRes.body.success).toBe(true);
    expect(historyRes.body.data.stepHistory.length).toBe(4);
    expect(historyRes.body.data.logisticsHistory.length).toBe(5);
  });
});

describe('卡点和拒绝测试', () => {
  it('应该能够拒绝步骤并查询卡点', async () => {
    const replacementId = await createReplacement();

    const rejectRes = await request(app)
      .post('/api/replacement/reject')
      .send({
        replacementId,
        step: 'OLD_CARD_FREEZE',
        reason: 'OLD_CARD_UNFREEZABLE',
        operatorId: 'op_001',
        operatorName: '风控员',
        remark: '旧卡存在异常交易，无法冻结'
      });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('STUCK');

    const stuckRes = await request(app).get(`/api/replacement/${replacementId}/stuck-point`);
    expect(stuckRes.body.success).toBe(true);
    expect(stuckRes.body.data.isStuck).toBe(true);
    expect(stuckRes.body.data.currentStep).toBe('OLD_CARD_FREEZE');
    expect(stuckRes.body.data.currentStatus).toBe('REJECTED');
    expect(stuckRes.body.data.lastSuccessfulStep).toBe('APPLICATION');
    expect(stuckRes.body.data.canProceed).toBe(false);
    expect(stuckRes.body.data.suggestedActions.length).toBeGreaterThan(0);

    const historyRes = await request(app).get(`/api/replacement/${replacementId}/history`);
    expect(historyRes.body.data.stepHistory.length).toBe(2);
    const rejectRecord = historyRes.body.data.stepHistory.find(
      (h: any) => h.step === 'OLD_CARD_FREEZE'
    );
    expect(rejectRecord.status).toBe('REJECTED');
    expect(rejectRecord.failureReason).toBe('OLD_CARD_UNFREEZABLE');
  });

  it('应该在物流丢失后执行补偿', async () => {
    const replacementId = await createReplacement();

    await request(app)
      .post('/api/replacement/freeze')
      .send({ replacementId });

    await request(app)
      .post('/api/replacement/logistics')
      .send({
        replacementId,
        step: 'PICKED_UP',
        location: '制卡中心'
      });

    await request(app)
      .post('/api/replacement/reject')
      .send({
        replacementId,
        step: 'LOGISTICS',
        reason: 'LOGISTICS_LOST',
        operatorId: 'op_001',
        operatorName: '物流客服',
        remark: '物流信息显示包裹已丢失'
      });

    let stuckRes = await request(app).get(`/api/replacement/${replacementId}/stuck-point`);
    expect(stuckRes.body.data.isStuck).toBe(true);

    const compensateRes = await request(app)
      .post('/api/replacement/compensate')
      .send({
        replacementId,
        method: 'NEW_CARD_REISSUE',
        operatorId: 'op_002',
        operatorName: '主管',
        remark: '同意重新制卡寄送'
      });

    expect(compensateRes.status).toBe(200);
    expect(compensateRes.body.success).toBe(true);
    const logisticsStep = compensateRes.body.data.steps.LOGISTICS;
    expect(logisticsStep.status).toBe('COMPENSATED');
    expect(logisticsStep.compensationInfo.compensated).toBe(true);
    expect(logisticsStep.compensationInfo.method).toBe('NEW_CARD_REISSUE');

    stuckRes = await request(app).get(`/api/replacement/${replacementId}/stuck-point`);
    expect(stuckRes.body.data.isStuck).toBe(false);
  });
});

describe('步骤顺序和错位处理测试', () => {
  it('应该不允许跳过依赖步骤直接执行后续步骤', async () => {
    const replacementId = await createReplacement();

    const activateRes = await request(app)
      .post('/api/replacement/activate')
      .send({
        replacementId,
        newCardNumber: '6222020987654321'
      });

    expect(activateRes.status).toBe(400);
    expect(activateRes.body.success).toBe(false);
    expect(activateRes.body.error.code).toBe('DEPENDENCY_STEP_IN_PROGRESS');
  });

  it('应该不允许物流节点倒序', async () => {
    const replacementId = await createReplacement();
    await request(app).post('/api/replacement/freeze').send({ replacementId });

    await request(app)
      .post('/api/replacement/logistics')
      .send({ replacementId, step: 'PICKED_UP', location: '制卡中心' });

    await request(app)
      .post('/api/replacement/logistics')
      .send({ replacementId, step: 'IN_TRANSIT', location: '广州' });

    const backwardsRes = await request(app)
      .post('/api/replacement/logistics')
      .send({ replacementId, step: 'PICKED_UP', location: '倒退' });

    expect(backwardsRes.status).toBe(400);
    expect(backwardsRes.body.error.code).toBe('LOGISTICS_STEP_OUT_OF_ORDER');
  });

  it('物流已签收后应该无法继续添加物流节点', async () => {
    const replacementId = await createReplacement();
    await request(app).post('/api/replacement/freeze').send({ replacementId });

    await request(app)
      .post('/api/replacement/logistics')
      .send({ replacementId, step: 'PICKED_UP', location: '制卡中心' });

    await request(app)
      .post('/api/replacement/logistics')
      .send({ replacementId, step: 'SIGNED', location: '签收' });

    const extraRes = await request(app)
      .post('/api/replacement/logistics')
      .send({ replacementId, step: 'DELIVERED', location: '额外节点' });

    expect(extraRes.status).toBe(400);
    expect(extraRes.body.error.code).toBe('LOGISTICS_ALREADY_DELIVERED');
  });
});

describe('客服查询和影响测试', () => {
  it('客服批注应该能记录，但不影响流程状态', async () => {
    const replacementId = await createReplacement();

    const csRes = await request(app)
      .post('/api/replacement/customer-service')
      .send({
        replacementId,
        csrId: 'csr_001',
        csrName: '客服小美',
        content: '用户来电询问进度，已告知正在处理中'
      });

    expect(csRes.status).toBe(200);
    expect(csRes.body.data.customerServiceNotes.length).toBe(1);
    expect(csRes.body.data.status).toBe('IN_PROGRESS');

    const historyRes = await request(app).get(`/api/replacement/${replacementId}/history`);
    expect(historyRes.body.data.csNotesHistory.length).toBe(1);
  });

  it('客服拒绝操作应该直接卡死流程', async () => {
    const replacementId = await createReplacement();

    const csRes = await request(app)
      .post('/api/replacement/customer-service')
      .send({
        replacementId,
        csrId: 'csr_001',
        csrName: '客服主管',
        content: '经过核实，用户身份存疑，拒绝继续处理',
        action: 'REJECT'
      });

    expect(csRes.status).toBe(200);
    expect(csRes.body.data.status).toBe('STUCK');

    const stuckRes = await request(app).get(`/api/replacement/${replacementId}/stuck-point`);
    expect(stuckRes.body.data.isStuck).toBe(true);
    expect(stuckRes.body.data.currentStatus).toBe('REJECTED');
  });
});

describe('补偿后重试测试', () => {
  it('旧卡冻结失败补偿后应该可以重新尝试', async () => {
    const replacementId = await createReplacement();

    await request(app)
      .post('/api/replacement/reject')
      .send({
        replacementId,
        step: 'OLD_CARD_FREEZE',
        reason: 'SYSTEM_ERROR',
        operatorId: 'op_001',
        remark: '系统异常导致冻结失败'
      });

    let stuckRes = await request(app).get(`/api/replacement/${replacementId}/stuck-point`);
    expect(stuckRes.body.data.isStuck).toBe(true);

    await request(app)
      .post('/api/replacement/compensate')
      .send({
        replacementId,
        method: 'MANUAL_HANDLING',
        operatorId: 'op_002',
        remark: '已通过人工渠道完成旧卡冻结，允许流程继续'
      });

    stuckRes = await request(app).get(`/api/replacement/${replacementId}/stuck-point`);
    expect(stuckRes.body.data.isStuck).toBe(false);
  });
});

describe('健康检查和错误处理', () => {
  it('健康检查应该返回正确状态', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('card-replacement-service');
  });

  it('查询不存在的换卡申请应该返回错误', async () => {
    const res = await request(app).get('/api/replacement/non-existent-id');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REPLACEMENT_NOT_FOUND');
  });

  it('创建换卡申请缺少必要参数应该返回错误', async () => {
    const res = await request(app)
      .post('/api/replacement/create')
      .send({ userId: 'user_001' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
