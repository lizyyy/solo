import { ReturnApplication, ValidationIssue, DeviceItem } from '../../shared/types';

export const validateOwnership = (application: ReturnApplication): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  
  application.devices.forEach((device: DeviceItem) => {
    if (device.borrowTeam !== application.teamName) {
      issues.push({
        type: 'ownership',
        severity: 'warning',
        message: `设备${device.deviceId}借出团队为"${device.borrowTeam}"，与归还团队"${application.teamName}"不一致`,
        deviceId: device.deviceId
      });
    }
  });
  
  return issues;
};

export const validateDeviceCount = (application: ReturnApplication): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  
  if (application.devices.length !== application.deviceCount) {
    issues.push({
      type: 'count_mismatch',
      severity: 'error',
      message: `申请设备数量${application.deviceCount}台，实际清单只有${application.devices.length}台，数量不一致`
    });
  }
  
  return issues;
};

export const validateDuplicateDevices = (applications: ReturnApplication[], currentId: string): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const currentApp = applications.find(a => a.id === currentId);
  if (!currentApp) return issues;
  
  const currentDeviceIds = new Set(currentApp.devices.map(d => d.deviceId));
  
  applications.forEach(app => {
    if (app.id === currentId) return;
    if (app.status === 'completed' || app.status === 'stored') return;
    
    app.devices.forEach(device => {
      if (currentDeviceIds.has(device.deviceId)) {
        issues.push({
          type: 'duplicate',
          severity: 'error',
          message: `设备${device.deviceId}已在归还单${app.id}中存在`,
          deviceId: device.deviceId
        });
      }
    });
  });
  
  return issues;
};

export const validateDeviceCondition = (application: ReturnApplication): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  
  application.devices.forEach((device: DeviceItem) => {
    if (device.condition === 'lost') {
      issues.push({
        type: 'other',
        severity: 'error',
        message: `设备${device.deviceId}状态为丢失，需特殊处理`,
        deviceId: device.deviceId
      });
    } else if (device.condition === 'damaged') {
      issues.push({
        type: 'other',
        severity: 'warning',
        message: `设备${device.deviceId}状态为损坏，需登记维修`,
        deviceId: device.deviceId
      });
    }
  });
  
  return issues;
};

export const validateReturnApplication = (
  application: ReturnApplication,
  allApplications: ReturnApplication[]
): { valid: boolean; issues: ValidationIssue[] } => {
  const allIssues: ValidationIssue[] = [];
  
  allIssues.push(...validateOwnership(application));
  allIssues.push(...validateDeviceCount(application));
  allIssues.push(...validateDuplicateDevices(allApplications, application.id));
  allIssues.push(...validateDeviceCondition(application));
  
  const hasErrors = allIssues.some(issue => issue.severity === 'error');
  
  return {
    valid: !hasErrors,
    issues: allIssues
  };
};
