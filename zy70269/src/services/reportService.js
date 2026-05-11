const { storage, generateId } = require('../models/storage');
const { ErrorCode, BusinessError } = require('../errors/businessError');

const ReportType = {
  DAMAGED: 'DAMAGED',
  ROUTE_CHANGE: 'ROUTE_CHANGE',
  AD_BLOCKED: 'AD_BLOCKED'
};

const TeamConfig = {
  'TEAM-MAINT': {
    name: '设施维护队',
    allowedTypes: [ReportType.DAMAGED]
  },
  'TEAM-ROUTE': {
    name: '线路管理队',
    allowedTypes: [ReportType.ROUTE_CHANGE]
  },
  'TEAM-AD': {
    name: '广告巡查队',
    allowedTypes: [ReportType.AD_BLOCKED]
  }
};

const ReportStatus = {
  SUBMITTED: 'SUBMITTED',
  VALIDATED: 'VALIDATED',
  VERIFYING: 'VERIFYING',
  ROUTE_CHECKED: 'ROUTE_CHECKED',
  DISPATCHED: 'DISPATCHED',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  NEEDS_RETRY: 'NEEDS_RETRY'
};

const DispatchStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  MERGED: 'MERGED'
};

function verifyStopArchive(stopId) {
  const stop = storage.stops.get(stopId);
  
  if (!stop) {
    throw new BusinessError(
      ErrorCode.STOP_NOT_FOUND,
      `站牌 ${stopId} 不存在`
    );
  }
  
  if (stop.status !== 'ACTIVE') {
    throw new BusinessError(
      ErrorCode.STOP_INACTIVE,
      `站牌 ${stopId} 当前状态为 ${stop.status}，非激活状态`,
      { stopStatus: stop.status }
    );
  }
  
  const routes = [];
  for (const routeId of stop.routeIds) {
    const route = storage.routes.get(routeId);
    if (route) {
      routes.push({
        id: route.id,
        name: route.name,
        direction: route.direction,
        version: route.version
      });
    }
  }
  
  stop.lastVerifiedAt = new Date().toISOString();
  
  return {
    stop: {
      id: stop.id,
      name: stop.name,
      address: stop.address,
      status: stop.status,
      verifiedAt: stop.lastVerifiedAt
    },
    associatedRoutes: routes,
    verificationResult: 'PASS',
    message: '站牌档案验证通过'
  };
}

function validateTeamAndType(teamId, reportType) {
  const teamConfig = TeamConfig[teamId];
  
  if (!teamConfig) {
    throw new BusinessError(
      ErrorCode.TEAM_ID_INVALID,
      `队伍 ID ${teamId} 未注册`,
      { registeredTeams: Object.keys(TeamConfig) }
    );
  }
  
  if (!teamConfig.allowedTypes.includes(reportType)) {
    throw new BusinessError(
      ErrorCode.REPORT_TYPE_INVALID,
      `队伍 ${teamConfig.name} 不允许上报类型 ${reportType}`,
      {
        teamId,
        teamName: teamConfig.name,
        allowedTypes: teamConfig.allowedTypes
      }
    );
  }
  
  return teamConfig;
}

function validateRouteAssociation(stopId, reportedRouteIds) {
  const stop = storage.stops.get(stopId);
  if (!stop) {
    throw new BusinessError(
      ErrorCode.STOP_NOT_FOUND,
      `站牌 ${stopId} 不存在`
    );
  }
  
  const systemRouteIds = new Set(stop.routeIds);
  const reportedSet = new Set(reportedRouteIds);
  
  const missingInSystem = [];
  const versionMismatches = [];
  
  for (const reported of reportedRouteIds) {
    if (!systemRouteIds.has(reported.routeId)) {
      missingInSystem.push(reported.routeId);
    } else {
      const systemRoute = storage.routes.get(reported.routeId);
      if (systemRoute && reported.version !== undefined && reported.version !== systemRoute.version) {
        versionMismatches.push({
          routeId: reported.routeId,
          systemVersion: systemRoute.version,
          reportedVersion: reported.version
        });
      }
    }
  }
  
  if (versionMismatches.length > 0) {
    const firstMismatch = versionMismatches[0];
    throw new BusinessError(
      ErrorCode.ROUTE_VERSION_MISMATCH,
      `线路 ${firstMismatch.routeId} 版本不一致`,
      {
        systemVersion: firstMismatch.systemVersion,
        reportVersion: firstMismatch.reportedVersion,
        allMismatches: versionMismatches
      }
    );
  }
  
  if (missingInSystem.length > 0) {
    throw new BusinessError(
      ErrorCode.ROUTE_STOP_ASSOCIATION_INVALID,
      `线路 ${missingInSystem.join(', ')} 与站牌无关联`,
      {
        stopAssociatedRoutes: stop.routeIds,
        invalidReportedRoutes: missingInSystem
      }
    );
  }
  
  return {
    matchResult: 'PASS',
    systemRoutes: stop.routeIds,
    reportedRoutes: reportedRouteIds.map(r => r.routeId)
  };
}

function findDuplicateCluster(stopId, reportType) {
  for (const cluster of storage.reportClusters.values()) {
    if (cluster.stopId === stopId && 
        cluster.reportType === reportType &&
        cluster.activeDispatchId) {
      const dispatch = storage.dispatches.get(cluster.activeDispatchId);
      if (dispatch && dispatch.status === DispatchStatus.PENDING) {
        return cluster;
      }
    }
  }
  return null;
}

function createReport(payload) {
  const { teamId, stopId, reportType, description, affectedRoutes, reporterInfo } = payload;
  
  if (!stopId) {
    throw new BusinessError(
      ErrorCode.VALIDATION_ERROR,
      '缺少必填字段: stopId'
    );
  }
  
  if (!ReportType[reportType]) {
    throw new BusinessError(
      ErrorCode.REPORT_TYPE_INVALID,
      `上报类型 ${reportType} 不合法，有效值: ${Object.keys(ReportType).join(', ')}`
    );
  }
  
  const teamConfig = validateTeamAndType(teamId, reportType);
  
  const stop = storage.stops.get(stopId);
  if (!stop) {
    throw new BusinessError(
      ErrorCode.STOP_NOT_FOUND,
      `站牌 ${stopId} 不存在，请先同步站牌档案`
    );
  }
  
  if (!stop.lastVerifiedAt) {
    throw new BusinessError(
      ErrorCode.STOP_ARCHIVE_NOT_VERIFIED,
      `站牌 ${stopId} 档案未经验证，请先调用验证接口`
    );
  }
  
  let routeCheckResult = null;
  if (affectedRoutes && affectedRoutes.length > 0) {
    routeCheckResult = validateRouteAssociation(stopId, affectedRoutes);
  }
  
  const duplicateCluster = findDuplicateCluster(stopId, reportType);
  
  const reportId = generateId('RPT');
  const now = new Date().toISOString();
  
  const report = {
    id: reportId,
    teamId,
    teamName: teamConfig.name,
    stopId,
    stopName: stop.name,
    reportType,
    description,
    affectedRoutes: affectedRoutes || [],
    reporterInfo: reporterInfo || null,
    status: ReportStatus.SUBMITTED,
    statusHistory: [
      { status: ReportStatus.SUBMITTED, timestamp: now, actor: 'SYSTEM', comment: '上报提交成功' }
    ],
    createdAt: now,
    updatedAt: now,
    isDuplicate: !!duplicateCluster,
    clusterId: duplicateCluster ? duplicateCluster.id : null
  };
  
  storage.reports.set(reportId, report);
  
  report.status = ReportStatus.VALIDATED;
  report.statusHistory.push({
    status: ReportStatus.VALIDATED,
    timestamp: new Date().toISOString(),
    actor: 'SYSTEM',
    comment: '基础校验通过（队伍权限、站牌档案）'
  });
  report.updatedAt = new Date().toISOString();
  
  if (routeCheckResult) {
    report.status = ReportStatus.ROUTE_CHECKED;
    report.statusHistory.push({
      status: ReportStatus.ROUTE_CHECKED,
      timestamp: new Date().toISOString(),
      actor: 'SYSTEM',
      comment: '线路关联校验通过'
    });
    report.updatedAt = new Date().toISOString();
  }
  
  let dispatch = null;
  let isMergedToExisting = false;
  
  if (duplicateCluster) {
    isMergedToExisting = true;
    report.status = ReportStatus.COMPLETED;
    report.statusHistory.push({
      status: ReportStatus.COMPLETED,
      timestamp: new Date().toISOString(),
      actor: 'SYSTEM',
      comment: `系统自动去重，合并到已有派修单 ${duplicateCluster.activeDispatchId}`
    });
    report.updatedAt = new Date().toISOString();
    
    dispatch = storage.dispatches.get(duplicateCluster.activeDispatchId);
    if (!duplicateCluster.reportIds.includes(reportId)) {
      duplicateCluster.reportIds.push(reportId);
    }
  } else {
    const clusterId = generateId('CLUSTER');
    const newCluster = {
      id: clusterId,
      stopId,
      reportType,
      reportIds: [reportId],
      activeDispatchId: null,
      createdAt: new Date().toISOString()
    };
    storage.reportClusters.set(clusterId, newCluster);
    report.clusterId = clusterId;
    
    const dispatchId = generateId('DISP');
    dispatch = {
      id: dispatchId,
      clusterId,
      stopId,
      stopName: stop.name,
      reportType,
      teamId,
      status: DispatchStatus.PENDING,
      sourceReportIds: [reportId],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    storage.dispatches.set(dispatchId, dispatch);
    newCluster.activeDispatchId = dispatchId;
    
    report.status = ReportStatus.DISPATCHED;
    report.statusHistory.push({
      status: ReportStatus.DISPATCHED,
      timestamp: new Date().toISOString(),
      actor: 'SYSTEM',
      comment: `生成派修单 ${dispatchId}`
    });
    report.updatedAt = new Date().toISOString();
  }
  
  return {
    report: {
      id: report.id,
      stopId: report.stopId,
      stopName: report.stopName,
      reportType: report.reportType,
      status: report.status,
      teamId: report.teamId,
      teamName: report.teamName,
      isDuplicate: report.isDuplicate,
      createdAt: report.createdAt
    },
    dispatch: dispatch ? {
      id: dispatch.id,
      status: dispatch.status,
      isMerged: isMergedToExisting
    } : null,
    routeVerification: routeCheckResult,
    statusHistory: report.statusHistory,
    processingResult: isMergedToExisting ? 'MERGED' : 'NEW_DISPATCH'
  };
}

function getReport(reportId) {
  const report = storage.reports.get(reportId);
  
  if (!report) {
    throw new BusinessError(
      ErrorCode.REPORT_NOT_FOUND,
      `上报记录 ${reportId} 不存在`
    );
  }
  
  let dispatch = null;
  if (report.clusterId) {
    const cluster = storage.reportClusters.get(report.clusterId);
    if (cluster && cluster.activeDispatchId) {
      dispatch = storage.dispatches.get(cluster.activeDispatchId);
    }
  }
  
  return {
    report,
    dispatch: dispatch ? {
      id: dispatch.id,
      status: dispatch.status,
      sourceReportCount: dispatch.sourceReportIds.length
    } : null
  };
}

function retryReport(reportId, updates = {}) {
  const { report } = getReport(reportId);
  
  if (report.status === ReportStatus.COMPLETED || report.status === ReportStatus.DISPATCHED) {
    throw new BusinessError(
      ErrorCode.REPORT_ALREADY_PROCESSED,
      `上报 ${reportId} 已处理完成，无需重试`
    );
  }
  
  if (updates.affectedRoutes) {
    validateRouteAssociation(report.stopId, updates.affectedRoutes);
    report.affectedRoutes = updates.affectedRoutes;
  }
  
  report.status = ReportStatus.VALIDATED;
  report.statusHistory.push({
    status: ReportStatus.VALIDATED,
    timestamp: new Date().toISOString(),
    actor: 'RETRY',
    comment: '重试提交，重新校验通过'
  });
  report.updatedAt = new Date().toISOString();
  
  const cluster = storage.reportClusters.get(report.clusterId);
  if (cluster && cluster.activeDispatchId) {
    const dispatch = storage.dispatches.get(cluster.activeDispatchId);
    if (dispatch) {
      report.status = ReportStatus.DISPATCHED;
      report.statusHistory.push({
        status: ReportStatus.DISPATCHED,
        timestamp: new Date().toISOString(),
        actor: 'RETRY',
        comment: `关联派修单 ${dispatch.id}`
      });
    }
  } else {
    const dispatchId = generateId('DISP');
    const dispatch = {
      id: dispatchId,
      clusterId: report.clusterId,
      stopId: report.stopId,
      stopName: report.stopName,
      reportType: report.reportType,
      teamId: report.teamId,
      status: DispatchStatus.PENDING,
      sourceReportIds: [reportId],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    storage.dispatches.set(dispatchId, dispatch);
    if (cluster) {
      cluster.activeDispatchId = dispatchId;
    }
    
    report.status = ReportStatus.DISPATCHED;
    report.statusHistory.push({
      status: ReportStatus.DISPATCHED,
      timestamp: new Date().toISOString(),
      actor: 'RETRY',
      comment: `重试成功，生成派修单 ${dispatchId}`
    });
  }
  
  report.updatedAt = new Date().toISOString();
  
  return {
    retrySuccess: true,
    reportId: report.id,
    newStatus: report.status,
    statusHistory: report.statusHistory.slice(-3)
  };
}

module.exports = {
  ReportType,
  ReportStatus,
  DispatchStatus,
  TeamConfig,
  verifyStopArchive,
  createReport,
  getReport,
  retryReport,
  validateRouteAssociation
};
