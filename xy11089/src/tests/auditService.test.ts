import { v4 as uuidv4 } from 'uuid';
import { auditService, ErrorCodes } from '../services/auditService';
import { store } from '../store/memoryStore';
import {
  AuditStatus,
  AuditAction,
  SubmissionSource,
  WindWarningLevel,
  CreateAuditRequest
} from '../types';

describe('AuditService - 基础功能测试', () => {
  beforeEach(() => {
    store.clear();
  });

  const createValidRequest = (): CreateAuditRequest => ({
    installationTeam: {
      teamName: '测试安装队',
      leaderName: '测试队长',
      leaderPhone: '13800000000',
      teamSize: 5,
      certificationLevel: 'A',
      certificationExpiryDate: '2027-12-31'
    },
    advertisement: {
      adTitle: '测试广告',
      adType: '户外大牌',
      adSize: '10m x 5m',
      adWeight: 500,
      installationHeight: 25,
      installationLocation: '测试地址',
      buildingType: '商业楼',
      coordinates: {
        latitude: 39.9042,
        longitude: 116.4074
      }
    },
    safetyEquipments: [
      {
        equipmentName: '安全带',
        inspectionDate: '2027-12-31',
        status: 'VALID'
      }
    ],
    plannedInstallationDate: '2025-01-15',
    plannedInstallationTime: '09:00',
    applicantId: 'U001',
    applicantName: '测试申请人',
    submissionSource: SubmissionSource.WEB_PORTAL
  });

  test('创建审批申请 - 成功', () => {
    const request = createValidRequest();
    const result = auditService.createAudit(request);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.status).toBe(AuditStatus.DRAFT);
    expect(result.data?.applicationNo).toBeDefined();
    expect(result.data?.operationHistories.length).toBe(1);
  });

  test('创建审批申请 - 必填字段验证失败', () => {
    const request = createValidRequest();
    request.installationTeam.teamName = '';
    request.advertisement.adTitle = '';

    const result = auditService.createAudit(request);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(result.error).toContain('安装队名称不能为空');
    expect(result.error).toContain('广告标题不能为空');
  });

  test('获取所有审批记录', () => {
    auditService.createAudit(createValidRequest());
    auditService.createAudit(createValidRequest());

    const result = auditService.getAllAudits();

    expect(result.success).toBe(true);
    expect(result.data?.length).toBe(2);
  });

  test('按状态查询审批记录', () => {
    const req1 = auditService.createAudit(createValidRequest());
    const req2 = auditService.createAudit(createValidRequest());

    if (req1.data) {
      auditService.executeAction({
        recordId: req1.data.id,
        action: AuditAction.SUBMIT,
        operatorId: 'U001',
        operatorName: '测试',
        submissionSource: SubmissionSource.WEB_PORTAL
      });
    }

    const pendingResult = auditService.getAuditsByStatus(AuditStatus.PENDING_REVIEW);
    const draftResult = auditService.getAuditsByStatus(AuditStatus.DRAFT);

    expect(pendingResult.data?.length).toBe(1);
    expect(draftResult.data?.length).toBe(1);
  });
});

describe('AuditService - 状态流转测试', () => {
  beforeEach(() => {
    store.clear();
  });

  const createAndSubmit = () => {
    const createResult = auditService.createAudit({
      installationTeam: {
        teamName: '测试队',
        leaderName: '队长',
        leaderPhone: '13800000000',
        teamSize: 5,
        certificationLevel: 'A',
        certificationExpiryDate: '2027-12-31'
      },
      advertisement: {
        adTitle: '测试广告',
        adType: '户外大牌',
        adSize: '10m x 5m',
        adWeight: 500,
        installationHeight: 25,
        installationLocation: '测试地址',
        buildingType: '商业楼',
        coordinates: { latitude: 39.9042, longitude: 116.4074 }
      },
      safetyEquipments: [
        { equipmentName: '安全带', inspectionDate: '2025-12-31', status: 'VALID' }
      ],
      plannedInstallationDate: '2027-01-15',
      plannedInstallationTime: '09:00',
      applicantId: 'U001',
      applicantName: '测试',
      submissionSource: SubmissionSource.WEB_PORTAL
    });

    const recordId = createResult.data!.id;
    auditService.executeAction({
      recordId,
      action: AuditAction.SUBMIT,
      operatorId: 'U001',
      operatorName: '测试',
      submissionSource: SubmissionSource.WEB_PORTAL
    });

    return recordId;
  };

  test('完整审批流程 - 成功', () => {
    const recordId = createAndSubmit();

    let result = auditService.executeAction({
      recordId,
      action: AuditAction.REVIEW,
      operatorId: 'R001',
      operatorName: '审核员',
      submissionSource: SubmissionSource.WEB_PORTAL
    });
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe(AuditStatus.SAFETY_CHECK);

    result = auditService.executeAction({
      recordId,
      action: AuditAction.SAFETY_VERIFY,
      operatorId: 'S001',
      operatorName: '安全员',
      submissionSource: SubmissionSource.WEB_PORTAL
    });
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe(AuditStatus.WIND_WARNING_CHECK);

    result = auditService.executeAction({
      recordId,
      action: AuditAction.WIND_VERIFY,
      operatorId: 'W001',
      operatorName: '气象员',
      submissionSource: SubmissionSource.WEB_PORTAL,
      windWarning: {
        warningId: uuidv4(),
        warningLevel: WindWarningLevel.NONE,
        windSpeed: 5.0,
        warningTime: new Date().toISOString(),
        affectedArea: '北京',
        source: '气象局'
      }
    });
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe(AuditStatus.APPROVED);
    expect(result.data?.operationHistories.length).toBe(5);
  });

  test('状态越级流转 - 拒绝', () => {
    const recordId = createAndSubmit();

    const result = auditService.executeAction({
      recordId,
      action: AuditAction.APPROVE,
      operatorId: 'A001',
      operatorName: '审批员',
      submissionSource: SubmissionSource.WEB_PORTAL
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ErrorCodes.INVALID_TRANSITION);
    expect(result.error).toContain(AuditStatus.PENDING_REVIEW);
    expect(result.error).toContain(AuditAction.APPROVE);
  });

  test('重复执行相同动作 - 拒绝', () => {
    const recordId = createAndSubmit();

    auditService.executeAction({
      recordId,
      action: AuditAction.REVIEW,
      operatorId: 'R001',
      operatorName: '审核员',
      submissionSource: SubmissionSource.WEB_PORTAL
    });

    const result = auditService.executeAction({
      recordId,
      action: AuditAction.REVIEW,
      operatorId: 'R001',
      operatorName: '审核员',
      submissionSource: SubmissionSource.WEB_PORTAL
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ErrorCodes.INVALID_TRANSITION);
  });

  test('拒绝审批 - 成功', () => {
    const recordId = createAndSubmit();

    const result = auditService.executeAction({
      recordId,
      action: AuditAction.REJECT,
      operatorId: 'R001',
      operatorName: '审核员',
      submissionSource: SubmissionSource.WEB_PORTAL,
      remark: '资料不全，需要补充'
    });

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe(AuditStatus.REJECTED);
    expect(result.data?.rejectReason).toBe('资料不全，需要补充');
  });
});

describe('AuditService - 大风预警测试', () => {
  beforeEach(() => {
    store.clear();
  });

  const createAndReachWindCheck = () => {
    const createResult = auditService.createAudit({
      installationTeam: {
        teamName: '测试队',
        leaderName: '队长',
        leaderPhone: '13800000000',
        teamSize: 5,
        certificationLevel: 'A',
        certificationExpiryDate: '2027-12-31'
      },
      advertisement: {
        adTitle: '测试广告',
        adType: '户外大牌',
        adSize: '10m x 5m',
        adWeight: 500,
        installationHeight: 25,
        installationLocation: '测试地址',
        buildingType: '商业楼',
        coordinates: { latitude: 39.9042, longitude: 116.4074 }
      },
      safetyEquipments: [
        { equipmentName: '安全带', inspectionDate: '2025-12-31', status: 'VALID' }
      ],
      plannedInstallationDate: '2027-01-15',
      plannedInstallationTime: '09:00',
      applicantId: 'U001',
      applicantName: '测试',
      submissionSource: SubmissionSource.WEB_PORTAL
    });

    const recordId = createResult.data!.id;
    auditService.executeAction({ recordId, action: AuditAction.SUBMIT, operatorId: 'U001', operatorName: '测试', submissionSource: SubmissionSource.WEB_PORTAL });
    auditService.executeAction({ recordId, action: AuditAction.REVIEW, operatorId: 'R001', operatorName: '审核', submissionSource: SubmissionSource.WEB_PORTAL });
    auditService.executeAction({ recordId, action: AuditAction.SAFETY_VERIFY, operatorId: 'S001', operatorName: '安全', submissionSource: SubmissionSource.WEB_PORTAL });

    return recordId;
  };

  test('大风预警时审批 - 拒绝（风速超标）', () => {
    const recordId = createAndReachWindCheck();

    const result = auditService.executeAction({
      recordId,
      action: AuditAction.WIND_VERIFY,
      operatorId: 'W001',
      operatorName: '气象员',
      submissionSource: SubmissionSource.WEB_PORTAL,
      windWarning: {
        warningId: uuidv4(),
        warningLevel: WindWarningLevel.LEVEL_3,
        windSpeed: 20.0,
        warningTime: new Date().toISOString(),
        affectedArea: '北京',
        source: '气象局'
      }
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ErrorCodes.CONDITION_CHECK_FAILED);
    expect(result.error).toContain('大风预警');
  });

  test('大风预警时审批 - 拒绝（预警等级超标）', () => {
    const recordId = createAndReachWindCheck();

    const result = auditService.executeAction({
      recordId,
      action: AuditAction.WIND_VERIFY,
      operatorId: 'W001',
      operatorName: '气象员',
      submissionSource: SubmissionSource.WEB_PORTAL,
      windWarning: {
        warningId: uuidv4(),
        warningLevel: WindWarningLevel.LEVEL_4,
        windSpeed: 10.0,
        warningTime: new Date().toISOString(),
        affectedArea: '北京',
        source: '气象局'
      }
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ErrorCodes.CONDITION_CHECK_FAILED);
    expect(result.error).toContain('大风预警');
  });

  test('查询大风预警违规记录', () => {
    const recordId = createAndReachWindCheck();

    store.update(recordId, {
      hasWindWarningViolation: true,
      windWarning: {
        warningId: uuidv4(),
        warningLevel: WindWarningLevel.LEVEL_3,
        windSpeed: 20.0,
        warningTime: new Date().toISOString(),
        affectedArea: '北京',
        source: '气象局'
      }
    });

    const violations = auditService.getWindWarningViolations();
    expect(violations.data?.length).toBe(1);
  });
});

describe('AuditService - 一致性检查测试', () => {
  beforeEach(() => {
    store.clear();
  });

  test('正常流程 - 一致性检查通过', () => {
    const createResult = auditService.createAudit({
      installationTeam: {
        teamName: '测试队',
        leaderName: '队长',
        leaderPhone: '13800000000',
        teamSize: 5,
        certificationLevel: 'A',
        certificationExpiryDate: '2027-12-31'
      },
      advertisement: {
        adTitle: '测试广告',
        adType: '户外大牌',
        adSize: '10m x 5m',
        adWeight: 500,
        installationHeight: 25,
        installationLocation: '测试地址',
        buildingType: '商业楼',
        coordinates: { latitude: 39.9042, longitude: 116.4074 }
      },
      safetyEquipments: [
        { equipmentName: '安全带', inspectionDate: '2025-12-31', status: 'VALID' }
      ],
      plannedInstallationDate: '2027-01-15',
      plannedInstallationTime: '09:00',
      applicantId: 'U001',
      applicantName: '测试',
      submissionSource: SubmissionSource.WEB_PORTAL
    });

    const recordId = createResult.data!.id;
    auditService.executeAction({ recordId, action: AuditAction.SUBMIT, operatorId: 'U001', operatorName: '测试', submissionSource: SubmissionSource.WEB_PORTAL });
    auditService.executeAction({ recordId, action: AuditAction.REVIEW, operatorId: 'R001', operatorName: '审核', submissionSource: SubmissionSource.WEB_PORTAL });

    const result = auditService.checkConsistency(recordId);
    expect(result.success).toBe(true);
    expect(result.data?.consistent).toBe(true);
    expect(result.data?.issues.length).toBe(0);
  });

  test('记录不存在 - 一致性检查失败', () => {
    const result = auditService.checkConsistency('non-existent-id');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ErrorCodes.RECORD_NOT_FOUND);
  });
});

describe('AuditService - 边界条件测试', () => {
  beforeEach(() => {
    store.clear();
  });

  test('查询不存在的记录', () => {
    const result = auditService.getAuditById('non-existent-id');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ErrorCodes.RECORD_NOT_FOUND);
  });

  test('执行不存在记录的动作', () => {
    const result = auditService.executeAction({
      recordId: 'non-existent-id',
      action: AuditAction.SUBMIT,
      operatorId: 'U001',
      operatorName: '测试',
      submissionSource: SubmissionSource.WEB_PORTAL
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ErrorCodes.RECORD_NOT_FOUND);
  });

  test('安全装备过期 - 提交失败', () => {
    const createResult = auditService.createAudit({
      installationTeam: {
        teamName: '测试队',
        leaderName: '队长',
        leaderPhone: '13800000000',
        teamSize: 5,
        certificationLevel: 'A',
        certificationExpiryDate: '2027-12-31'
      },
      advertisement: {
        adTitle: '测试广告',
        adType: '户外大牌',
        adSize: '10m x 5m',
        adWeight: 500,
        installationHeight: 25,
        installationLocation: '测试地址',
        buildingType: '商业楼',
        coordinates: { latitude: 39.9042, longitude: 116.4074 }
      },
      safetyEquipments: [
        { equipmentName: '安全带', inspectionDate: '2025-12-31', status: 'EXPIRED' }
      ],
      plannedInstallationDate: '2027-01-15',
      plannedInstallationTime: '09:00',
      applicantId: 'U001',
      applicantName: '测试',
      submissionSource: SubmissionSource.WEB_PORTAL
    });

    const result = auditService.executeAction({
      recordId: createResult.data!.id,
      action: AuditAction.SUBMIT,
      operatorId: 'U001',
      operatorName: '测试',
      submissionSource: SubmissionSource.WEB_PORTAL
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ErrorCodes.CONDITION_CHECK_FAILED);
    expect(result.error).toContain('安全装备已过期');
  });

  test('团队资质过期 - 安全检查失败', () => {
    const createResult = auditService.createAudit({
      installationTeam: {
        teamName: '测试队',
        leaderName: '队长',
        leaderPhone: '13800000000',
        teamSize: 5,
        certificationLevel: 'A',
        certificationExpiryDate: '2020-01-01'
      },
      advertisement: {
        adTitle: '测试广告',
        adType: '户外大牌',
        adSize: '10m x 5m',
        adWeight: 500,
        installationHeight: 25,
        installationLocation: '测试地址',
        buildingType: '商业楼',
        coordinates: { latitude: 39.9042, longitude: 116.4074 }
      },
      safetyEquipments: [
        { equipmentName: '安全带', inspectionDate: '2027-12-31', status: 'VALID' }
      ],
      plannedInstallationDate: '2027-01-15',
      plannedInstallationTime: '09:00',
      applicantId: 'U001',
      applicantName: '测试',
      submissionSource: SubmissionSource.WEB_PORTAL
    });

    const recordId = createResult.data!.id;
    auditService.executeAction({ recordId, action: AuditAction.SUBMIT, operatorId: 'U001', operatorName: '测试', submissionSource: SubmissionSource.WEB_PORTAL });
    auditService.executeAction({ recordId, action: AuditAction.REVIEW, operatorId: 'R001', operatorName: '审核', submissionSource: SubmissionSource.WEB_PORTAL });

    const result = auditService.executeAction({
      recordId,
      action: AuditAction.SAFETY_VERIFY,
      operatorId: 'S001',
      operatorName: '安全员',
      submissionSource: SubmissionSource.WEB_PORTAL
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ErrorCodes.CONDITION_CHECK_FAILED);
    expect(result.error).toContain('资质已过期');
  });
});
