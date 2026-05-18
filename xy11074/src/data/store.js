const GiftSample = require('../models/GiftSample');

class SampleStore {
  constructor() {
    this.samples = new Map();
    this.initSampleData();
  }

  initSampleData() {
    const sampleData = [
      {
        companyId: 'COMP001',
        companyName: '阿里巴巴集团',
        contactPerson: '张经理',
        contactPhone: '13800138001',
        giftCategory: '数码配件',
        giftName: '无线充电器',
        giftModel: 'WC-2024-001',
        material: 'PC+ABS',
        specification: '15W快充',
        color: '白色',
        quantity: 50,
        unitPrice: 35.5,
        totalAmount: 1775,
        customizationType: 'LOGO印刷',
        printingMethod: '丝印',
        logoPosition: '正面居中',
        designVersion: 'V1',
        designConfirmed: true,
        designConfirmedBy: '李设计',
        designConfirmedAt: '2024-01-15T10:30:00.000Z',
        sampleStatus: '打样中',
        sampler: '王打样',
        sampleStartTime: '2024-01-16T09:00:00.000Z',
        expectedDeliveryDate: '2024-01-20T00:00:00.000Z',
        materialsNeeded: [
          { materialCode: 'MAT001', materialName: 'PC料', quantity: 10, unit: 'kg' },
          { materialCode: 'MAT002', materialName: '丝印油墨', quantity: 2, unit: '瓶' }
        ],
        materialsProvided: [
          { materialCode: 'MAT001', materialName: 'PC料', quantity: 10, unit: 'kg', providedAt: '2024-01-16T08:00:00.000Z' }
        ],
        sampleTracker: [
          { action: '创建打样单', operator: '系统管理员', remarks: '初始创建', timestamp: '2024-01-15T09:00:00.000Z' },
          { action: '设计稿确认', operator: '张经理', remarks: '客户确认V1设计稿', timestamp: '2024-01-15T10:30:00.000Z' }
        ],
        createdBy: '系统管理员'
      },
      {
        companyId: 'COMP002',
        companyName: '腾讯科技',
        contactPerson: '刘主管',
        contactPhone: '13900139002',
        giftCategory: '办公用品',
        giftName: '金属签字笔',
        giftModel: 'PEN-MTL-002',
        material: '铝合金',
        specification: '0.5mm黑色',
        color: '枪灰色',
        quantity: 100,
        unitPrice: 18.0,
        totalAmount: 1800,
        customizationType: '激光雕刻',
        printingMethod: '激光雕刻',
        logoPosition: '笔身侧面',
        designVersion: 'V2',
        designConfirmed: false,
        sampleStatus: '待客户确认',
        oldDesignOrderId: 'SMP1705000000000',
        orderId: 'ORD-TX-20240120',
        expectedDeliveryDate: '2024-01-25T00:00:00.000Z',
        materialsNeeded: [
          { materialCode: 'MAT003', materialName: '铝合金棒料', quantity: 50, unit: '根' }
        ],
        materialsProvided: [],
        sampleTracker: [
          { action: '创建打样单', operator: '系统管理员', remarks: '客户按新稿重新下单', timestamp: '2024-01-18T14:00:00.000Z' },
          { action: '关联旧单', operator: '系统管理员', remarks: '关联旧设计稿订单SMP1705000000000', timestamp: '2024-01-18T14:05:00.000Z' }
        ],
        createdBy: '系统管理员',
        remarks: '客户确认V1后要求修改logo位置，按V2重新打样'
      },
      {
        companyId: 'COMP003',
        companyName: '字节跳动',
        contactPerson: '王总监',
        contactPhone: '13700137003',
        giftCategory: '箱包类',
        giftName: '商务双肩包',
        giftModel: 'BAG-BUS-003',
        material: '牛津布',
        specification: '15.6寸电脑隔层',
        color: '黑色',
        quantity: 20,
        unitPrice: 89.0,
        totalAmount: 1780,
        customizationType: '刺绣',
        printingMethod: '电脑刺绣',
        logoPosition: '包正面右上角',
        designVersion: 'V1',
        designConfirmed: true,
        designConfirmedBy: '王总监',
        designConfirmedAt: '2024-01-10T16:00:00.000Z',
        sampleStatus: '质检完成',
        sampler: '赵师傅',
        sampleStartTime: '2024-01-11T08:00:00.000Z',
        sampleEndTime: '2024-01-14T18:00:00.000Z',
        actualDeliveryDate: '2024-01-15T10:00:00.000Z',
        qualityCheckResult: '合格',
        qualityCheckBy: '陈质检',
        qualityCheckAt: '2024-01-15T09:00:00.000Z',
        customerFeedback: '做工精细，刺绣位置准确',
        customerFeedbackAt: '2024-01-16T11:00:00.000Z',
        materialsNeeded: [
          { materialCode: 'MAT004', materialName: '牛津布料', quantity: 30, unit: '米' },
          { materialCode: 'MAT005', materialName: '刺绣线', quantity: 10, unit: '卷' }
        ],
        materialsProvided: [
          { materialCode: 'MAT004', materialName: '牛津布料', quantity: 30, unit: '米', providedAt: '2024-01-11T07:00:00.000Z' },
          { materialCode: 'MAT005', materialName: '刺绣线', quantity: 10, unit: '卷', providedAt: '2024-01-11T07:30:00.000Z' }
        ],
        sampleTracker: [
          { action: '创建打样单', operator: '系统管理员', remarks: '初始创建', timestamp: '2024-01-10T09:00:00.000Z' },
          { action: '设计稿确认', operator: '王总监', remarks: '确认设计方案', timestamp: '2024-01-10T16:00:00.000Z' },
          { action: '开始打样', operator: '赵师傅', remarks: '材料齐全，开始打样', timestamp: '2024-01-11T08:00:00.000Z' },
          { action: '完成打样', operator: '赵师傅', remarks: '打样完成，待质检', timestamp: '2024-01-14T18:00:00.000Z' },
          { action: '质检通过', operator: '陈质检', remarks: '质检合格，可以发货', timestamp: '2024-01-15T09:00:00.000Z' },
          { action: '客户签收', operator: '王总监', remarks: '客户确认收到样品', timestamp: '2024-01-15T10:00:00.000Z' },
          { action: '客户反馈', operator: '王总监', remarks: '客户满意，准备批量生产', timestamp: '2024-01-16T11:00:00.000Z' }
        ],
        createdBy: '系统管理员'
      }
    ];

    sampleData.forEach(data => {
      const sample = new GiftSample(data);
      this.samples.set(sample.sampleId, sample);
    });
  }

  addSample(sampleData, operator = '系统') {
    const sample = new GiftSample(sampleData);
    sample.addTracker('创建打样单', operator, sampleData.isBatchImport ? '批量补录创建' : '人工录入创建');
    this.samples.set(sample.sampleId, sample);
    return sample;
  }

  updateSample(sampleId, updateData, operator = '系统') {
    const sample = this.samples.get(sampleId);
    if (!sample) {
      return null;
    }
    Object.assign(sample, updateData);
    sample.addTracker('更新打样单', operator, '更新打样信息');
    sample.updatedAt = new Date().toISOString();
    sample.updatedBy = operator;
    this.samples.set(sampleId, sample);
    return sample;
  }

  getSample(sampleId) {
    return this.samples.get(sampleId) || null;
  }

  getSamples(filters = {}) {
    let result = Array.from(this.samples.values());
    if (filters.companyId) {
      result = result.filter(s => s.companyId === filters.companyId);
    }
    if (filters.sampleStatus) {
      result = result.filter(s => s.sampleStatus === filters.sampleStatus);
    }
    if (filters.batchId) {
      result = result.filter(s => s.batchId === filters.batchId);
    }
    return result;
  }

  batchImport(samplesData, operator = '系统') {
    const batchId = 'BATCH' + Date.now();
    const results = [];
    samplesData.forEach(data => {
      data.isBatchImport = true;
      data.batchId = batchId;
      const sample = this.addSample(data, operator);
      results.push(sample);
    });
    return { batchId, count: results.length, samples: results };
  }

  checkOldDesignNewOrder(sampleId) {
    const sample = this.samples.get(sampleId);
    if (!sample) return null;
    if (sample.oldDesignOrderId && sample.designVersion !== 'V1') {
      return {
        hasIssue: true,
        issueType: 'OLD_DESIGN_NEW_ORDER',
        message: '客户确认旧稿后按新稿重新下单',
        oldDesignOrderId: sample.oldDesignOrderId,
        currentDesignVersion: sample.designVersion
      };
    }
    return { hasIssue: false };
  }

  checkTrackerConsistency(sampleId) {
    const sample = this.samples.get(sampleId);
    if (!sample) return null;
    const requiredActions = ['创建打样单'];
    const statusActionMap = {
      '待客户确认': ['设计稿确认'],
      '打样中': ['设计稿确认', '开始打样'],
      '质检完成': ['设计稿确认', '开始打样', '完成打样', '质检通过'],
      '已完成': ['设计稿确认', '开始打样', '完成打样', '质检通过', '客户签收']
    };
    const actualActions = sample.sampleTracker.map(t => t.action);
    const missingActions = [];
    requiredActions.forEach(action => {
      if (!actualActions.includes(action)) {
        missingActions.push(action);
      }
    });
    if (statusActionMap[sample.sampleStatus]) {
      statusActionMap[sample.sampleStatus].forEach(action => {
        if (!actualActions.includes(action)) {
          missingActions.push(action);
        }
      });
    }
    if (missingActions.length > 0) {
      return {
        hasIssue: true,
        issueType: 'TRACKER_INCONSISTENCY',
        message: '打样轨迹不完整',
        missingActions,
        currentStatus: sample.sampleStatus
      };
    }
    return { hasIssue: false };
  }

  getNextSteps(sampleId) {
    const sample = this.samples.get(sampleId);
    if (!sample) return null;
    const nextSteps = [];
    const missingMaterials = sample.getMissingMaterials();
    if (missingMaterials.length > 0) {
      nextSteps.push({
        type: 'MATERIALS_NEEDED',
        message: '需要补充以下材料',
        materials: missingMaterials
      });
    }
    if (!sample.designConfirmed) {
      nextSteps.push({
        type: 'DESIGN_CONFIRMATION',
        message: '需要客户确认设计稿',
        designVersion: sample.designVersion
      });
    }
    const trackerCheck = this.checkTrackerConsistency(sampleId);
    if (trackerCheck.hasIssue) {
      nextSteps.push({
        type: 'TRACKER_COMPLETION',
        message: '需要补全打样轨迹',
        missingActions: trackerCheck.missingActions
      });
    }
    const oldDesignCheck = this.checkOldDesignNewOrder(sampleId);
    if (oldDesignCheck.hasIssue) {
      nextSteps.push({
        type: 'OLD_DESIGN_HANDLING',
        message: '需要处理旧稿新单情况',
        details: oldDesignCheck
      });
    }
    return {
      sampleId,
      sampleStatus: sample.sampleStatus,
      nextSteps
    };
  }
}

module.exports = new SampleStore();