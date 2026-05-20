"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconciliationService = exports.ReconciliationService = void 0;
const uuid_1 = require("uuid");
const dataStore_1 = require("../store/dataStore");
const MIN_TRIAL_RUN_DURATION = 30;
class ReconciliationService {
    async performReconciliation(batchId) {
        const diffs = [];
        const maintenanceRecords = dataStore_1.dataStore.getAllMaintenanceRecords();
        const sensorDataList = dataStore_1.dataStore.getAllSensorData();
        const approvalRecords = dataStore_1.dataStore.getAllApprovalRecords();
        const cableCarIds = new Set();
        maintenanceRecords.forEach(r => cableCarIds.add(r.cableCarId));
        sensorDataList.forEach(s => cableCarIds.add(s.cableCarId));
        approvalRecords.forEach(a => cableCarIds.add(a.cableCarId));
        for (const cableCarId of cableCarIds) {
            const carMaintenance = maintenanceRecords.filter(r => r.cableCarId === cableCarId);
            const carSensors = sensorDataList.filter(s => s.cableCarId === cableCarId);
            const carApprovals = approvalRecords.filter(a => a.cableCarId === cableCarId);
            diffs.push(...this.checkTrialRun(cableCarId, carSensors, carMaintenance));
            diffs.push(...this.checkKeyItems(cableCarId, carMaintenance));
            diffs.push(...this.checkOverdueRelease(cableCarId, carApprovals));
            diffs.push(...this.checkMaintenanceFail(cableCarId, carMaintenance));
            diffs.push(...this.checkSensorAbnormal(cableCarId, carSensors));
            diffs.push(...this.checkApprovalMissing(cableCarId, carApprovals, carMaintenance));
        }
        const summary = this.calculateSummary(diffs, cableCarIds.size);
        const passedCount = this.countPassedCableCars(cableCarIds, diffs);
        return dataStore_1.dataStore.addReconciliationResult({
            batchId,
            totalCableCars: cableCarIds.size,
            passedCount,
            failedCount: cableCarIds.size - passedCount,
            diffs,
            summary,
        });
    }
    checkTrialRun(cableCarId, sensors, maintenance) {
        const diffs = [];
        const trialRunSensors = sensors.filter(s => s.trialRunDuration !== undefined);
        if (trialRunSensors.length === 0 && maintenance.length > 0) {
            diffs.push(this.createDiff('trial_run_insufficient', 'high', '缺少试运行记录', `缆车 ${cableCarId} 检修后缺少试运行传感器数据记录`, cableCarId, maintenance.map(m => ({ type: 'maintenance', id: m.id }))));
            return diffs;
        }
        for (const sensor of trialRunSensors) {
            if (sensor.trialRunDuration < MIN_TRIAL_RUN_DURATION) {
                diffs.push(this.createDiff('trial_run_insufficient', 'high', '试运行时长不足', `缆车 ${cableCarId} 试运行时长 ${sensor.trialRunDuration} 分钟，低于要求的 ${MIN_TRIAL_RUN_DURATION} 分钟`, cableCarId, [{ type: 'sensor', id: sensor.id, field: 'trialRunDuration' }]));
            }
            if (sensor.trialRunPassed === false) {
                diffs.push(this.createDiff('trial_run_insufficient', 'high', '试运行未通过', `缆车 ${cableCarId} 试运行结果为未通过`, cableCarId, [{ type: 'sensor', id: sensor.id, field: 'trialRunPassed' }]));
            }
        }
        return diffs;
    }
    checkKeyItems(cableCarId, maintenance) {
        const diffs = [];
        for (const record of maintenance) {
            const keyItems = record.items.filter(item => item.isKeyItem);
            for (const item of keyItems) {
                if (!item.signedBy) {
                    diffs.push(this.createDiff('key_item_unsigned', 'high', '关键检修项未签字', `缆车 ${cableCarId} 的关键检修项「${item.itemName}(${item.itemCode})」缺少负责人签字`, cableCarId, [{ type: 'maintenance', id: record.id, field: `items.${item.itemCode}.signedBy` }]));
                }
            }
        }
        return diffs;
    }
    checkOverdueRelease(cableCarId, approvals) {
        const diffs = [];
        const now = new Date();
        for (const approval of approvals) {
            if (approval.approvalType === 'release' && approval.status === 'approved' && approval.validTo) {
                const validTo = new Date(approval.validTo);
                if (validTo < now) {
                    const daysOverdue = Math.floor((now.getTime() - validTo.getTime()) / (1000 * 60 * 60 * 24));
                    diffs.push(this.createDiff('overdue_release', 'high', '放行审批已超期', `缆车 ${cableCarId} 的放行审批已超期 ${daysOverdue} 天，有效期至 ${approval.validTo}`, cableCarId, [{ type: 'approval', id: approval.id, field: 'validTo' }]));
                }
            }
        }
        return diffs;
    }
    checkMaintenanceFail(cableCarId, maintenance) {
        const diffs = [];
        for (const record of maintenance) {
            const failedItems = record.items.filter(item => item.inspectionResult === 'fail');
            for (const item of failedItems) {
                diffs.push(this.createDiff('maintenance_fail', item.isKeyItem ? 'high' : 'medium', '检修项检查未通过', `缆车 ${cableCarId} 的${item.isKeyItem ? '关键' : '普通'}检修项「${item.itemName}(${item.itemCode})」检查结果为不合格`, cableCarId, [{ type: 'maintenance', id: record.id, field: `items.${item.itemCode}.inspectionResult` }]));
            }
        }
        return diffs;
    }
    checkSensorAbnormal(cableCarId, sensors) {
        const diffs = [];
        for (const sensor of sensors) {
            const abnormalReadings = sensor.readings.filter(r => r.status === 'error' || r.status === 'warning');
            if (abnormalReadings.length > 0) {
                const errorCount = abnormalReadings.filter(r => r.status === 'error').length;
                const warningCount = abnormalReadings.filter(r => r.status === 'warning').length;
                diffs.push(this.createDiff('sensor_abnormal', errorCount > 0 ? 'high' : 'medium', '传感器数据异常', `缆车 ${cableCarId} 的${sensor.sensorType}传感器(${sensor.sensorId})发现 ${errorCount} 个错误和 ${warningCount} 个警告`, cableCarId, [{ type: 'sensor', id: sensor.id, field: 'readings' }]));
            }
        }
        return diffs;
    }
    checkApprovalMissing(cableCarId, approvals, maintenance) {
        const diffs = [];
        if (maintenance.length > 0) {
            const hasReleaseApproval = approvals.some(a => a.approvalType === 'release' && a.status === 'approved');
            if (!hasReleaseApproval) {
                diffs.push(this.createDiff('approval_missing', 'high', '缺少放行审批', `缆车 ${cableCarId} 有检修记录但缺少有效的放行审批`, cableCarId, maintenance.map(m => ({ type: 'maintenance', id: m.id }))));
            }
            const pendingApprovals = approvals.filter(a => a.status === 'pending');
            for (const approval of pendingApprovals) {
                diffs.push(this.createDiff('approval_pending', 'medium', '审批待处理', `缆车 ${cableCarId} 的${approval.approvalType === 'trial_run' ? '试运行' : '放行'}审批正在等待处理`, cableCarId, [{ type: 'approval', id: approval.id, field: 'status' }]));
            }
        }
        return diffs;
    }
    createDiff(type, severity, title, description, cableCarId, relatedRecords) {
        return {
            id: (0, uuid_1.v4)(),
            type,
            severity,
            title,
            description,
            cableCarId,
            relatedRecords,
            status: 'open',
        };
    }
    calculateSummary(diffs, totalCableCars) {
        const byType = {
            trial_run_insufficient: 0,
            key_item_unsigned: 0,
            overdue_release: 0,
            maintenance_fail: 0,
            sensor_abnormal: 0,
            approval_missing: 0,
            approval_pending: 0,
        };
        const bySeverity = {
            high: 0,
            medium: 0,
            low: 0,
        };
        for (const diff of diffs) {
            byType[diff.type]++;
            bySeverity[diff.severity]++;
        }
        const cableCarsWithHighSeverity = new Set(diffs.filter(d => d.severity === 'high').map(d => d.cableCarId));
        const passedCount = totalCableCars - cableCarsWithHighSeverity.size;
        return {
            totalDiffs: diffs.length,
            byType,
            bySeverity,
            trialRunIssues: byType.trial_run_insufficient,
            unsignedKeyItems: byType.key_item_unsigned,
            overdueReleases: byType.overdue_release,
            passRate: totalCableCars > 0 ? (passedCount / totalCableCars) * 100 : 0,
        };
    }
    countPassedCableCars(cableCarIds, diffs) {
        const failedCableCars = new Set(diffs.filter(d => d.severity === 'high' && d.status !== 'resolved').map(d => d.cableCarId));
        return cableCarIds.size - failedCableCars.size;
    }
    async recalculateSummary(resultId) {
        const result = dataStore_1.dataStore.getReconciliationResult(resultId);
        if (!result)
            return undefined;
        const cableCarIds = new Set();
        result.diffs.forEach(d => cableCarIds.add(d.cableCarId));
        const summary = this.calculateSummary(result.diffs, result.totalCableCars);
        const passedCount = this.countPassedCableCars(cableCarIds, result.diffs);
        return dataStore_1.dataStore.updateReconciliationResult(resultId, {
            summary,
            passedCount,
            failedCount: result.totalCableCars - passedCount,
        });
    }
    getDiffsByCableCar(cableCarId, resultId) {
        const result = dataStore_1.dataStore.getReconciliationResult(resultId);
        if (!result)
            return undefined;
        return result.diffs.filter(d => d.cableCarId === cableCarId);
    }
    getTraceabilityChain(cableCarId, resultId) {
        const result = dataStore_1.dataStore.getReconciliationResult(resultId);
        if (!result)
            return undefined;
        const diffs = result.diffs.filter(d => d.cableCarId === cableCarId);
        const maintenance = dataStore_1.dataStore.getMaintenanceByCableCar(cableCarId);
        const sensors = dataStore_1.dataStore.getSensorByCableCar(cableCarId);
        const approvals = dataStore_1.dataStore.getApprovalByCableCar(cableCarId);
        return {
            cableCarId,
            diffs,
            maintenanceRecords: maintenance,
            sensorData: sensors,
            approvalRecords: approvals,
            finalStatus: diffs.some(d => d.severity === 'high' && d.status !== 'resolved') ? 'fail' :
                diffs.some(d => d.severity === 'medium' && d.status !== 'resolved') ? 'warning' : 'pass',
        };
    }
}
exports.ReconciliationService = ReconciliationService;
exports.reconciliationService = new ReconciliationService();
//# sourceMappingURL=reconciliationService.js.map