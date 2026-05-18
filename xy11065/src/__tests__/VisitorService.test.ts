import { VisitorService } from '../services/VisitorService';
import { store } from '../models/Store';
import { VisitorStatus, AccessType, ApprovalAction } from '../types';

describe('VisitorService - 共享工位前台工位访客放行测试', () => {
  let visitorService: VisitorService;

  beforeEach(() => {
    visitorService = new VisitorService();
    store.clear();
  });

  const createTestVisitor = (floor: number = 5) => {
    return visitorService.createVisitor({
      visitorName: '张三',
      visitorPhone: '13800138000',
      visitorIdCard: '110101199001011234',
      visitorCompany: 'ABC科技有限公司',
      hostName: '李四',
      hostDepartment: '技术部',
      hostPhone: '13900139000',
      visitDate: '2026-05-20',
      startTime: '09:00',
      endTime: '18:00',
      accessType: AccessType.SHARED_WORKSTATION,
      workstationId: 'WS-A-001',
      floor,
      building: 'A座',
      visitPurpose: '业务洽谈',
      numberOfVisitors: 1,
      hasCar: true,
      plateNumber: '京A12345',
      healthCodeStatus: 'green',
      temperature: 36.5
    }, '前台-小王');
  };

  test('访客改楼层但原门禁仍有效 - 场景测试', () => {
    const visitor = createTestVisitor(5);
    expect(visitor.floor).toBe(5);
    expect(visitor.status).toBe(VisitorStatus.DRAFT);

    visitorService.approveVisitor(visitor.id, '管理员', 'admin', '审批通过');
    
    let accessControls = visitorService.getVisitorAccessControls(visitor.id);
    expect(accessControls.length).toBe(1);
    expect(accessControls[0].floor).toBe(5);
    expect(accessControls[0].isActive).toBe(true);

    const updatedVisitor = visitorService.changeVisitorFloor(
      visitor.id,
      8,
      '管理员',
      'admin',
      '会议室变更到8楼，保留原楼层门禁权限',
      true
    );

    expect(updatedVisitor).not.toBeNull();
    expect(updatedVisitor!.floor).toBe(8);

    accessControls = visitorService.getVisitorAccessControls(visitor.id);
    expect(accessControls.length).toBe(2);

    const floor5Access = accessControls.find(ac => ac.floor === 5);
    const floor8Access = accessControls.find(ac => ac.floor === 8);
    
    expect(floor5Access).not.toBeUndefined();
    expect(floor5Access!.isActive).toBe(true);
    
    expect(floor8Access).not.toBeUndefined();
    expect(floor8Access!.isActive).toBe(true);

    const history = visitorService.getVisitorHistory(visitor.id);
    const floorChangeRecord = history.find(h => h.action === ApprovalAction.CHANGE_FLOOR);
    expect(floorChangeRecord).not.toBeUndefined();
    expect(floorChangeRecord!.changedFields).toContain('floor');
    expect(floorChangeRecord!.oldValues.floor).toBe(5);
    expect(floorChangeRecord!.newValues.floor).toBe(8);
  });

  test('访客台账一致性 - 状态变更与历史记录对应', () => {
    const visitor = createTestVisitor();
    const initialHistory = visitorService.getVisitorHistory(visitor.id);
    expect(initialHistory.length).toBe(0);

    visitorService.submitVisitor(visitor.id, '前台-小王', 'receptionist');
    let history = visitorService.getVisitorHistory(visitor.id);
    expect(history.length).toBe(1);
    expect(history[0].action).toBe(ApprovalAction.SUBMIT);
    expect(history[0].newValues.status).toBe(VisitorStatus.SUBMITTED);

    visitorService.addComment(visitor.id, '前台-小王', 'receptionist', '等待审批中');
    visitorService.approveVisitor(visitor.id, '张经理', 'manager', '同意放行');
    
    history = visitorService.getVisitorHistory(visitor.id);
    expect(history.length).toBe(3);
    
    const approveRecord = history.find(h => h.action === ApprovalAction.APPROVE);
    expect(approveRecord).not.toBeUndefined();
    expect(approveRecord!.newValues.status).toBe(VisitorStatus.APPROVED);
    expect(approveRecord!.comment).toBe('同意放行');

    const exported = visitorService.exportVisitorData(visitor.id);
    expect(exported).not.toBeNull();
    expect(exported!.visitor.status).toBe(VisitorStatus.APPROVED);
    expect(exported!.history.length).toBe(3);
    
    exported!.history.forEach(record => {
      expect(record.visitorId).toBe(visitor.id);
      expect(record.operator).toBeDefined();
      expect(record.operatorRole).toBeDefined();
    });
  });

  test('撤回后再次提交的组合情况 - 完整流程测试', () => {
    const visitor = createTestVisitor(3);
    expect(visitor.status).toBe(VisitorStatus.DRAFT);

    visitorService.submitVisitor(visitor.id, '前台-小王', 'receptionist');
    expect(visitorService.getVisitor(visitor.id)!.status).toBe(VisitorStatus.SUBMITTED);

    visitorService.addComment(visitor.id, '前台-小王', 'receptionist', '已通知接待人');

    visitorService.withdrawVisitor(visitor.id, '前台-小王', 'receptionist', '访客时间需要调整');
    const afterWithdraw = visitorService.getVisitor(visitor.id);
    expect(afterWithdraw!.status).toBe(VisitorStatus.WITHDRAWN);

    let accessControlsAfterWithdraw = visitorService.getVisitorAccessControls(visitor.id);
    accessControlsAfterWithdraw.forEach(ac => {
      expect(ac.isActive).toBe(false);
    });

    const resubmittedVisitor = visitorService.resubmitVisitor(
      visitor.id,
      '前台-小王',
      'receptionist',
      {
        visitDate: '2026-05-21',
        startTime: '14:00',
        endTime: '17:00'
      }
    );

    expect(resubmittedVisitor).not.toBeNull();
    expect(resubmittedVisitor!.status).toBe(VisitorStatus.SUBMITTED);
    expect(resubmittedVisitor!.visitDate).toBe('2026-05-21');
    expect(resubmittedVisitor!.startTime).toBe('14:00');

    visitorService.approveVisitor(resubmittedVisitor!.id, '李总监', 'director', '重新审批通过');
    const finalVisitor = visitorService.getVisitor(resubmittedVisitor!.id);
    expect(finalVisitor!.status).toBe(VisitorStatus.APPROVED);

    const history = visitorService.getVisitorHistory(visitor.id);
    expect(history.length).toBe(5);

    const withdrawRecord = history.find(h => h.action === ApprovalAction.WITHDRAW);
    expect(withdrawRecord).not.toBeUndefined();
    expect(withdrawRecord!.comment).toBe('访客时间需要调整');

    const resubmitRecord = history.find(h => h.action === ApprovalAction.RESUBMIT);
    expect(resubmitRecord).not.toBeUndefined();
    expect(resubmitRecord!.changedFields).toContain('visitDate');
    expect(resubmitRecord!.changedFields).toContain('startTime');
    expect(resubmitRecord!.changedFields).toContain('endTime');

    const finalAccessControls = visitorService.getVisitorAccessControls(visitor.id);
    const activeAccesses = finalAccessControls.filter(ac => ac.isActive);
    expect(activeAccesses.length).toBeGreaterThan(0);
  });

  test('进入人工处理后，备注和再次提交完整留痕', () => {
    const visitor = createTestVisitor(6);

    visitorService.submitVisitor(visitor.id, '前台-小王', 'receptionist');

    visitorService.addComment(visitor.id, '张经理', 'manager', '需要核实访客公司信息，请稍候');
    visitorService.addComment(visitor.id, '前台-小王', 'receptionist', '已核实，访客公司为正规合作企业');

    visitorService.modifyVisitor(
      visitor.id,
      '张经理',
      'manager',
      {
        visitPurpose: '合同签署与技术交流',
        numberOfVisitors: 2
      },
      '人工复核后补充完善信息'
    );

    visitorService.approveVisitor(visitor.id, '李总监', 'director', '人工审核通过');

    const history = visitorService.getVisitorHistory(visitor.id);
    
    const commentRecords = history.filter(h => h.action === ApprovalAction.ADD_COMMENT);
    expect(commentRecords.length).toBe(2);
    expect(commentRecords[0].comment).toBe('需要核实访客公司信息，请稍候');
    expect(commentRecords[1].comment).toBe('已核实，访客公司为正规合作企业');

    const modifyRecord = history.find(h => h.action === ApprovalAction.MODIFY);
    expect(modifyRecord).not.toBeUndefined();
    expect(modifyRecord!.comment).toBe('人工复核后补充完善信息');
    expect(modifyRecord!.changedFields).toContain('visitPurpose');
    expect(modifyRecord!.changedFields).toContain('numberOfVisitors');

    const finalVisitor = visitorService.getVisitor(visitor.id);
    expect(finalVisitor!.visitPurpose).toBe('合同签署与技术交流');
    expect(finalVisitor!.numberOfVisitors).toBe(2);

    const exported = visitorService.exportVisitorData(visitor.id);
    expect(exported!.history.length).toBe(5);
    
    exported!.history.forEach((record, index) => {
      expect(record.createdAt).toBeDefined();
      expect(record.operator).toBeDefined();
    });
  });

  test('完整流程 - 从创建到导出的验收流程', () => {
    const visitor = createTestVisitor(10);
    expect(visitor.visitorName).toBe('张三');
    expect(visitor.visitorCompany).toBe('ABC科技有限公司');
    expect(visitor.workstationId).toBe('WS-A-001');

    const allVisitors = visitorService.getAllVisitors();
    expect(allVisitors.length).toBe(1);
    expect(allVisitors[0].id).toBe(visitor.id);

    visitorService.submitVisitor(visitor.id, '前台-小王', 'receptionist');

    visitorService.approveVisitor(visitor.id, '张经理', 'manager', '符合访客规定，同意进入');

    const detail = visitorService.getVisitor(visitor.id);
    expect(detail).not.toBeUndefined();
    expect(detail!.status).toBe(VisitorStatus.APPROVED);
    expect(detail!.accessCardNumber).toBeUndefined();

    const history = visitorService.getVisitorHistory(visitor.id);
    expect(history.length).toBe(2);
    expect(history[0].action).toBe(ApprovalAction.SUBMIT);
    expect(history[1].action).toBe(ApprovalAction.APPROVE);

    const accessControls = visitorService.getVisitorAccessControls(visitor.id);
    expect(accessControls.length).toBe(1);
    expect(accessControls[0].floor).toBe(10);
    expect(accessControls[0].isActive).toBe(true);

    const exportedData = visitorService.exportVisitorData(visitor.id);
    expect(exportedData).not.toBeNull();
    expect(exportedData!.visitor.id).toBe(visitor.id);
    expect(exportedData!.history.length).toBe(2);
    expect(exportedData!.accessControls.length).toBe(1);
    expect(exportedData!.visitor.visitorName).toBe('张三');
    expect(exportedData!.visitor.hostName).toBe('李四');
    expect(exportedData!.visitor.workstationId).toBe('WS-A-001');
  });
});
