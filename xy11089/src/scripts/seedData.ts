import { v4 as uuidv4 } from 'uuid';
import { auditService } from '../services/auditService';
import {
  AuditStatus,
  AuditAction,
  SubmissionSource,
  WindWarningLevel
} from '../types';

export function seedSampleData() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const certExpiryStr = nextMonth.toISOString().split('T')[0];

  const draftResult = auditService.createAudit({
    installationTeam: {
      teamName: '蓝天广告安装一队',
      leaderName: '张三',
      leaderPhone: '13800138001',
      teamSize: 5,
      certificationLevel: 'A',
      certificationExpiryDate: certExpiryStr
    },
    advertisement: {
      adTitle: '万达广场户外大牌广告',
      adType: '户外大牌',
      adSize: '10m x 5m',
      adWeight: 500,
      installationHeight: 25,
      installationLocation: '北京市朝阳区建国路88号万达广场外墙',
      buildingType: '商业综合体',
      coordinates: {
        latitude: 39.9042,
        longitude: 116.4074
      }
    },
    safetyEquipments: [
      {
        equipmentName: '安全带',
        inspectionDate: tomorrowStr,
        status: 'VALID'
      },
      {
        equipmentName: '安全帽',
        inspectionDate: tomorrowStr,
        status: 'VALID'
      },
      {
        equipmentName: '安全绳',
        inspectionDate: tomorrowStr,
        status: 'VALID'
      }
    ],
    plannedInstallationDate: tomorrowStr,
    plannedInstallationTime: '09:00',
    applicantId: 'U001',
    applicantName: '张三',
    submissionSource: SubmissionSource.WEB_PORTAL
  });

  if (!draftResult.success || !draftResult.data) {
    console.error('创建样例数据失败:', draftResult.error);
    return;
  }

  const recordId = draftResult.data.id;

  auditService.executeAction({
    recordId,
    action: AuditAction.SUBMIT,
    operatorId: 'U001',
    operatorName: '张三',
    submissionSource: SubmissionSource.WEB_PORTAL,
    remark: '提交审批申请'
  });

  auditService.executeAction({
    recordId,
    action: AuditAction.REVIEW,
    operatorId: 'R001',
    operatorName: '李四',
    submissionSource: SubmissionSource.WEB_PORTAL,
    remark: '初审通过，进入安全检查'
  });

  auditService.executeAction({
    recordId,
    action: AuditAction.SAFETY_VERIFY,
    operatorId: 'S001',
    operatorName: '王五',
    submissionSource: SubmissionSource.WEB_PORTAL,
    remark: '安全装备检查合格'
  });

  const pendingReview = auditService.createAudit({
    installationTeam: {
      teamName: '红日广告安装队',
      leaderName: '赵六',
      leaderPhone: '13800138002',
      teamSize: 3,
      certificationLevel: 'B',
      certificationExpiryDate: certExpiryStr
    },
    advertisement: {
      adTitle: '地铁站灯箱广告',
      adType: '灯箱广告',
      adSize: '3m x 1.5m',
      adWeight: 100,
      installationHeight: 3,
      installationLocation: '北京市海淀区中关村地铁站',
      buildingType: '交通枢纽',
      coordinates: {
        latitude: 39.9847,
        longitude: 116.3160
      }
    },
    safetyEquipments: [
      {
        equipmentName: '安全带',
        inspectionDate: tomorrowStr,
        status: 'VALID'
      }
    ],
    plannedInstallationDate: tomorrowStr,
    plannedInstallationTime: '14:00',
    applicantId: 'U002',
    applicantName: '赵六',
    submissionSource: SubmissionSource.MOBILE_APP
  });

  if (pendingReview.success && pendingReview.data) {
    auditService.executeAction({
      recordId: pendingReview.data.id,
      action: AuditAction.SUBMIT,
      operatorId: 'U002',
      operatorName: '赵六',
      submissionSource: SubmissionSource.MOBILE_APP,
      remark: '提交审批申请'
    });
  }

  const rejected = auditService.createAudit({
    installationTeam: {
      teamName: '星光安装队',
      leaderName: '钱七',
      leaderPhone: '13800138003',
      teamSize: 4,
      certificationLevel: 'C',
      certificationExpiryDate: certExpiryStr
    },
    advertisement: {
      adTitle: '楼顶大字广告',
      adType: '楼顶大字',
      adSize: '8m x 2m',
      adWeight: 800,
      installationHeight: 45,
      installationLocation: '北京市西城区金融街某大厦楼顶',
      buildingType: '写字楼',
      coordinates: {
        latitude: 39.9128,
        longitude: 116.3634
      }
    },
    safetyEquipments: [
      {
        equipmentName: '安全带',
        inspectionDate: tomorrowStr,
        status: 'EXPIRED'
      }
    ],
    plannedInstallationDate: tomorrowStr,
    plannedInstallationTime: '10:00',
    applicantId: 'U003',
    applicantName: '钱七',
    submissionSource: SubmissionSource.API_INTEGRATION
  });

  if (rejected.success && rejected.data) {
    const rejectedId = rejected.data.id;
    auditService.executeAction({
      recordId: rejectedId,
      action: AuditAction.SUBMIT,
      operatorId: 'U003',
      operatorName: '钱七',
      submissionSource: SubmissionSource.API_INTEGRATION,
      remark: '提交审批申请'
    });
    auditService.executeAction({
      recordId: rejectedId,
      action: AuditAction.REVIEW,
      operatorId: 'R001',
      operatorName: '李四',
      submissionSource: SubmissionSource.WEB_PORTAL,
      remark: '进入初审'
    });
    auditService.executeAction({
      recordId: rejectedId,
      action: AuditAction.REJECT,
      operatorId: 'S001',
      operatorName: '王五',
      submissionSource: SubmissionSource.WEB_PORTAL,
      remark: '安全装备已过期，请更换后重新提交'
    });
  }

  const approved = auditService.createAudit({
    installationTeam: {
      teamName: '金牌安装队',
      leaderName: '孙八',
      leaderPhone: '13800138004',
      teamSize: 6,
      certificationLevel: 'A',
      certificationExpiryDate: certExpiryStr
    },
    advertisement: {
      adTitle: 'CBD商圈墙体广告',
      adType: '墙体广告',
      adSize: '15m x 6m',
      adWeight: 1200,
      installationHeight: 30,
      installationLocation: '北京市朝阳区CBD核心区',
      buildingType: '商业综合体',
      coordinates: {
        latitude: 39.9184,
        longitude: 116.4605
      }
    },
    safetyEquipments: [
      {
        equipmentName: '安全带',
        inspectionDate: tomorrowStr,
        status: 'VALID'
      },
      {
        equipmentName: '安全帽',
        inspectionDate: tomorrowStr,
        status: 'VALID'
      },
      {
        equipmentName: '安全网',
        inspectionDate: tomorrowStr,
        status: 'VALID'
      }
    ],
    plannedInstallationDate: tomorrowStr,
    plannedInstallationTime: '08:00',
    applicantId: 'U004',
    applicantName: '孙八',
    submissionSource: SubmissionSource.MANUAL_ENTRY
  });

  if (approved.success && approved.data) {
    const approvedId = approved.data.id;
    auditService.executeAction({
      recordId: approvedId,
      action: AuditAction.SUBMIT,
      operatorId: 'U004',
      operatorName: '孙八',
      submissionSource: SubmissionSource.MANUAL_ENTRY,
      remark: '提交审批申请'
    });
    auditService.executeAction({
      recordId: approvedId,
      action: AuditAction.REVIEW,
      operatorId: 'R001',
      operatorName: '李四',
      submissionSource: SubmissionSource.WEB_PORTAL,
      remark: '初审通过'
    });
    auditService.executeAction({
      recordId: approvedId,
      action: AuditAction.SAFETY_VERIFY,
      operatorId: 'S001',
      operatorName: '王五',
      submissionSource: SubmissionSource.WEB_PORTAL,
      remark: '安全检查通过'
    });
    auditService.executeAction({
      recordId: approvedId,
      action: AuditAction.WIND_VERIFY,
      operatorId: 'W001',
      operatorName: '周九',
      submissionSource: SubmissionSource.WEB_PORTAL,
      remark: '天气条件良好，风力正常',
      windWarning: {
        warningId: uuidv4(),
        warningLevel: WindWarningLevel.NONE,
        windSpeed: 5.2,
        warningTime: new Date().toISOString(),
        affectedArea: '北京市朝阳区',
        source: '北京市气象局'
      }
    });
  }

  const windViolation = auditService.createAudit({
    installationTeam: {
      teamName: '违规作业队',
      leaderName: '吴十',
      leaderPhone: '13800138005',
      teamSize: 2,
      certificationLevel: 'B',
      certificationExpiryDate: certExpiryStr
    },
    advertisement: {
      adTitle: '高速公路广告牌',
      adType: '高炮广告',
      adSize: '18m x 6m',
      adWeight: 2000,
      installationHeight: 20,
      installationLocation: '京承高速沿途',
      buildingType: '户外高炮',
      coordinates: {
        latitude: 40.0567,
        longitude: 116.6789
      }
    },
    safetyEquipments: [
      {
        equipmentName: '安全带',
        inspectionDate: tomorrowStr,
        status: 'VALID'
      }
    ],
    plannedInstallationDate: tomorrowStr,
    plannedInstallationTime: '11:00',
    applicantId: 'U005',
    applicantName: '吴十',
    submissionSource: SubmissionSource.WEB_PORTAL
  });

  if (windViolation.success && windViolation.data) {
    const violationId = windViolation.data.id;
    auditService.executeAction({
      recordId: violationId,
      action: AuditAction.SUBMIT,
      operatorId: 'U005',
      operatorName: '吴十',
      submissionSource: SubmissionSource.WEB_PORTAL,
      remark: '提交审批申请'
    });
    auditService.executeAction({
      recordId: violationId,
      action: AuditAction.REVIEW,
      operatorId: 'R001',
      operatorName: '李四',
      submissionSource: SubmissionSource.WEB_PORTAL,
      remark: '初审通过'
    });
    auditService.executeAction({
      recordId: violationId,
      action: AuditAction.SAFETY_VERIFY,
      operatorId: 'S001',
      operatorName: '王五',
      submissionSource: SubmissionSource.WEB_PORTAL,
      remark: '安全检查通过'
    });
  }

  console.log(`样例数据创建完成，共创建 ${auditService.getAllAudits().data?.length || 0} 条审批记录`);
  console.log('各状态记录统计:');
  Object.values(AuditStatus).forEach(status => {
    const count = auditService.getAuditsByStatus(status as AuditStatus).data?.length || 0;
    if (count > 0) {
      console.log(`  ${status}: ${count} 条`);
    }
  });
}
