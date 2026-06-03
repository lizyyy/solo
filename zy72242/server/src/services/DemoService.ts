import RecordRepository from '../repositories/RecordRepository';
import AdjustmentRepository from '../repositories/AdjustmentRepository';
import AuditRepository from '../repositories/AuditRepository';
import ReconciliationService from './ReconciliationService';
import HolidayService from './HolidayService';
import { format, addDays, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

class DemoService {
  resetDemoData() {
    AuditRepository.deleteAllDemoData();
    AdjustmentRepository.deleteAllDemoData();
    RecordRepository.deleteAllDemoData();
  }

  initStep1_HolidayImport() {
    this.resetDemoData();

    const tradeDate = '2024-04-30';
    const expectedDate = HolidayService.calculateExpectedArrivalDate(tradeDate);
    
    const holidayExplanation = HolidayService.getHolidayExplanation(expectedDate, '2024-05-06');
    
    const record1 = RecordRepository.create({
      tradeDate,
      expectedArrivalDate: expectedDate,
      actualArrivalDate: '2024-05-06',
      amount: 1500000.00,
      fundCode: 'FUND-001',
      futuresCode: 'IF2405',
      hasManualModification: true,
      modificationType: 't1_to_t2',
      modifiedBy: '张三',
      modificationReason: '节假日顺延+手工调整',
      whyKept: `T+1到账（${expectedDate}）被手工修改为T+2（2024-05-06），延迟4天；${holidayExplanation}；修改原因：节假日顺延+手工调整；修改人：张三`,
      missingMaterials: '银行交割凭证、支付平台流水单、修改授权确认书',
      nextAction: '请基金经理复核T+1→T+2修改原因，不急着归正常；确认后联系支付平台产品阿南'
    });

    const record2 = RecordRepository.create({
      tradeDate: '2024-06-08',
      expectedArrivalDate: HolidayService.calculateExpectedArrivalDate('2024-06-08'),
      actualArrivalDate: '2024-06-11',
      amount: 850000.00,
      fundCode: 'FUND-002',
      futuresCode: 'IC2406',
      hasManualModification: false,
      whyKept: '到账延迟0天；节假日顺延：2024-06-10（星期一）端午节；延迟属于正常节假日顺延',
      missingMaterials: '',
      nextAction: '无需处理，自动标记为正常'
    });

    AuditRepository.create({
      recordId: record1.id,
      action: 'import',
      reason: '导入交割数据（演示Step1）',
      operator: '系统',
      operatorRole: 'system',
      affectedResults: '预期到账日、金额、基金代码、对账说明已生成'
    });

    AuditRepository.create({
      recordId: record1.id,
      action: 'modify',
      fieldName: 'actual_arrival_date',
      oldValue: expectedDate,
      newValue: '2024-05-06',
      reason: '导入时检测到人工修改到账日（演示数据）',
      operator: '张三',
      operatorRole: 'product_manager',
      affectedResults: '对账状态变为reviewing，触发基金经理复核'
    });

    AuditRepository.create({
      recordId: record2.id,
      action: 'import',
      reason: '导入交割数据（演示Step1）',
      operator: '系统',
      operatorRole: 'system',
      affectedResults: '预期到账日、金额、基金代码、对账说明已生成'
    });

    return {
      message: 'Step1 完成：节假日顺延数据已导入',
      details: {
        step: 1,
        description: '导入包含节假日顺延的演示数据，系统自动标记T+1→T+2修改',
        records: [record1, record2],
        keyPoint: '注意demo-001记录已被标记为T+1→T+2修改，状态为reviewing，留待基金经理复核'
      }
    };
  }

  initStep2_TailAdjustment() {
    const tradeDate = '2024-09-16';
    const expectedDate = HolidayService.calculateExpectedArrivalDate(tradeDate);
    
    const record3 = RecordRepository.create({
      tradeDate,
      expectedArrivalDate: expectedDate,
      actualArrivalDate: '2024-09-19',
      amount: 2200000.00,
      fundCode: 'FUND-001',
      futuresCode: 'IF2409',
      hasManualModification: true,
      modificationType: 't1_to_t2',
      modifiedBy: '李四',
      modificationReason: '中秋节假日影响',
      whyKept: `T+1到账（${expectedDate}）被手工修改为T+2（2024-09-19），延迟1天；节假日顺延：2024-09-17（星期二）中秋节；修改原因：中秋节假日影响；修改人：李四`,
      missingMaterials: '交割确认书',
      nextAction: '请基金经理复核T+1→T+2修改原因，不急着归正常；确认后联系支付平台产品阿南'
    });

    AuditRepository.create({
      recordId: record3.id,
      action: 'import',
      reason: '导入交割数据（演示Step2）',
      operator: '系统',
      operatorRole: 'system',
      affectedResults: '预期到账日、金额、基金代码、对账说明已生成'
    });

    AuditRepository.create({
      recordId: record3.id,
      action: 'modify',
      fieldName: 'actual_arrival_date',
      oldValue: expectedDate,
      newValue: '2024-09-19',
      reason: '导入时检测到人工修改到账日（演示数据）',
      operator: '李四',
      operatorRole: 'product_manager',
      affectedResults: '对账状态变为reviewing，触发基金经理复核'
    });

    const adjustment = AdjustmentRepository.create({
      recordId: record3.id,
      amount: 125.50,
      reason: '银行手续费尾差调整',
      adjustedBy: '支付平台阿南'
    });

    AuditRepository.create({
      recordId: record3.id,
      action: 'adjust',
      reason: '银行手续费尾差调整（演示Step2）',
      operator: '支付平台阿南',
      operatorRole: 'product_manager',
      affectedResults: '对账说明自动更新，增加尾差调整说明'
    });

    ReconciliationService.autoGenerateReconciliationNote(record3.id);
    const updatedRecord = RecordRepository.findById(record3.id);

    return {
      message: 'Step2 完成：尾差调整条已补录',
      details: {
        step: 2,
        description: '支付平台产品阿南补看尾差调整条，对账说明自动更新',
        record: updatedRecord,
        adjustment,
        keyPoint: '尾差调整后，对账说明已自动更新，增加了"已补录尾差调整条"说明'
      }
    };
  }

  initStep3_ReconciliationUpdate() {
    const record = RecordRepository.findById('demo-001');
    if (!record) {
      return this.initStep1_HolidayImport();
    }

    const oldWhyKept = record.whyKept;
    const updatedNote = {
      whyKept: `${oldWhyKept}；已补录尾差调整条，调整金额125.50元，原因为银行手续费`,
      missingMaterials: '银行交割凭证',
      nextAction: '尾差调整已完成，请基金经理最终复核；确认后联系支付平台产品阿南归档',
      updatedBy: '支付平台阿南'
    };

    ReconciliationService.updateReconciliationNote(record.id, updatedNote);
    ReconciliationService.rerunReconciliation(record.id, '支付平台阿南');

    const updatedRecord = ReconciliationService.getRecordWithRelations(record.id);

    return {
      message: 'Step3 完成：对账说明已更新',
      details: {
        step: 3,
        description: '对账说明已根据尾差调整自动更新，完整流程演示完成',
        record: updatedRecord,
        keyPoint: '对账说明已包含：为什么被留下、缺什么材料、下一步找谁。T+1→T+2修改仍保留reviewing状态，留给基金经理复核',
        flowSummary: [
          'Step1: 导入节假日顺延数据 → 自动标记T+1→T+2修改',
          'Step2: 补录尾差调整条 → 触发对账说明更新',
          'Step3: 对账说明更新 → 保留异常状态待基金经理复核'
        ]
      }
    };
  }

  initFullDemo() {
    const step1 = this.initStep1_HolidayImport();
    const step2 = this.initStep2_TailAdjustment();
    const step3 = this.initStep3_ReconciliationUpdate();

    return {
      message: '完整演示数据已初始化',
      steps: [step1, step2, step3],
      demoGuide: {
        title: '期货交割仓单核查流程演示',
        audience: '新员工培训',
        presenter: '支付平台产品阿南',
        keyScenarios: [
          '节假日顺延说明：2024年五一劳动节、端午节、中秋节',
          '尾差调整条：银行手续费125.50元',
          '一次人工修正：张三将T+1改为T+2',
          '一次重跑：重跑对账逻辑更新对账说明'
        ],
        threeStepFlow: [
          '第一步：节假日顺延说明第一次导入 → 系统自动标记异常',
          '第二步：支付平台产品阿南补看尾差调整条 → 自动触发对账说明更新',
          '第三步：对账说明更新 → T+1→T+2修改不急着归正常，留给基金经理复核'
        ]
      }
    };
  }

  getDemoGuide() {
    return {
      title: '期货交割仓单核查系统使用指南',
      forRole: '支付平台产品阿南',
      threeStepProcess: [
        {
          step: 1,
          name: '导入数据',
          action: '导入包含节假日顺延的交割仓单数据',
          systemResponse: '系统自动标记T+1→T+2等人工修改记录，生成对账说明',
          keyPoint: 'T+1→T+2修改会被高亮标记，状态设为reviewing，留待基金经理复核'
        },
        {
          step: 2,
          name: '补录尾差调整',
          action: '补录尾差调整条，填写调整金额和原因',
          systemResponse: '系统自动更新所有关联记录的对账说明',
          keyPoint: '尾差调整后，对账说明会自动增加"已补录尾差调整条"说明'
        },
        {
          step: 3,
          name: '对账说明更新',
          action: '查看更新后的对账说明，确认信息完整',
          systemResponse: '对账说明包含：为什么被留下、缺什么材料、下一步找谁',
          keyPoint: 'T+1→T+2修改记录保持reviewing状态，不自动归正常，留给基金经理复核'
        }
      ],
      auditTrail: {
        description: '每一条记录都完整记录：',
        items: [
          '谁在什么时间改了什么',
          '为什么改（修改原因）',
          '改完影响哪些结果（状态变化、对账说明更新等）'
        ]
      },
      reconciliationNoteTemplate: {
        whyKept: '说明这条记录为什么被留下（异常原因、修改记录、节假日影响等）',
        missingMaterials: '列出还缺什么材料（银行凭证、流水单、授权书等）',
        nextAction: '明确下一步该找谁（基金经理复核、支付平台阿南处理等）'
      }
    };
  }
}

export default new DemoService();
