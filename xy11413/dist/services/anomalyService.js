"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAnomaly = exports.getOpenAnomalies = exports.getAnomaliesByTaskId = exports.createAnomaly = void 0;
const connection_1 = require("../database/connection");
const schema_1 = require("../database/schema");
const uuid_1 = require("uuid");
const createAnomaly = async (taskId, anomalyType, severity, description, relatedFactIds = []) => {
    const anomalyId = `anomaly_${(0, uuid_1.v4)().slice(0, 24)}`;
    await (0, connection_1.runInsert)(`INSERT INTO ${schema_1.TABLES.ANOMALY_RECORDS} (
      anomaly_id, task_id, anomaly_type, severity, description, related_fact_ids, status
    ) VALUES (?, ?, ?, ?, ?, ?, 'open')`, [
        anomalyId,
        taskId,
        anomalyType,
        severity,
        description,
        relatedFactIds.join(',')
    ]);
    return anomalyId;
};
exports.createAnomaly = createAnomaly;
const getAnomaliesByTaskId = async (taskId) => {
    return await (0, connection_1.runQuery)(`SELECT * FROM ${schema_1.TABLES.ANOMALY_RECORDS} WHERE task_id = ? ORDER BY created_at DESC`, [taskId]);
};
exports.getAnomaliesByTaskId = getAnomaliesByTaskId;
const getOpenAnomalies = async () => {
    return await (0, connection_1.runQuery)(`SELECT * FROM ${schema_1.TABLES.ANOMALY_RECORDS} WHERE status = 'open' ORDER BY severity DESC, created_at DESC`);
};
exports.getOpenAnomalies = getOpenAnomalies;
const resolveAnomaly = async (anomalyId, resolution, resolvedBy) => {
    const changes = await (0, connection_1.runUpdate)(`UPDATE ${schema_1.TABLES.ANOMALY_RECORDS} 
     SET status = 'resolved', resolution = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE anomaly_id = ?`, [resolution, resolvedBy, anomalyId]);
    return changes > 0;
};
exports.resolveAnomaly = resolveAnomaly;
