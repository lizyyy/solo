import * as fs from 'fs';
import { OtaValidationResult, RetryPlan } from '../types';

export function generateRetryPlan(result: OtaValidationResult, outputPath: string): void {
  const failedDevices: string[] = [];
  
  result.versionValidation.devicesWithHigherVersion.forEach(id => {
    if (!failedDevices.includes(id)) failedDevices.push(id);
  });
  result.versionValidation.devicesBelowMinVersion.forEach(id => {
    if (!failedDevices.includes(id)) failedDevices.push(id);
  });
  result.versionValidation.incompatibleDevices.forEach(id => {
    if (!failedDevices.includes(id)) failedDevices.push(id);
  });
  result.capabilityValidation.unsupportedDevices.forEach(id => {
    if (!failedDevices.includes(id)) failedDevices.push(id);
  });

  const retryOrder = [...failedDevices].sort((a, b) => {
    const deviceA = result.rolloutDevices.find(d => d.deviceId === a);
    const deviceB = result.rolloutDevices.find(d => d.deviceId === b);
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return (priorityOrder[deviceA?.priority || 'low'] || 2) - (priorityOrder[deviceB?.priority || 'low'] || 2);
  });

  const retryDelays = retryOrder.map((deviceId, index) => ({
    deviceId,
    delayMinutes: Math.min(index * 5, 60)
  }));

  const estimatedMinutes = retryDelays.reduce((sum, d) => sum + d.delayMinutes, 0) + retryOrder.length * 2;
  const estimatedCompletion = new Date(Date.now() + estimatedMinutes * 60000).toISOString();

  const retryPlan: RetryPlan = {
    failedDevices,
    retryOrder,
    retryDelays,
    estimatedCompletion
  };

  fs.writeFileSync(outputPath, JSON.stringify(retryPlan, null, 2));
}
