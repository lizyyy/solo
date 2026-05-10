"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createObject = createObject;
exports.getObjectByKey = getObjectByKey;
exports.getObjectById = getObjectById;
exports.transitionObjectToClass = transitionObjectToClass;
exports.deleteObject = deleteObject;
exports.applyLifecycleRules = applyLifecycleRules;
exports.createLifecycleRule = createLifecycleRule;
exports.getActiveLifecycleRules = getActiveLifecycleRules;
const types_1 = require("../models/types");
const index_1 = require("../database/index");
const costService_1 = require("./costService");
const loggingService_1 = require("./loggingService");
async function createObject(obj) {
    await (0, index_1.runSql)(`INSERT INTO objects (
      object_id, bucket_name, object_key, size, storage_class,
      last_modified, created_time, e_tag, version_id,
      delete_protection, tags, current_thaw_job_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        obj.objectId,
        obj.bucketName,
        obj.objectKey,
        obj.size,
        obj.storageClass,
        obj.lastModified,
        obj.createdTime,
        obj.eTag,
        obj.versionId,
        obj.deleteProtection ? 1 : 0,
        JSON.stringify(obj.tags),
        obj.currentThawJobId
    ]);
    return obj;
}
async function getObjectByKey(bucketName, objectKey) {
    const row = await (0, index_1.queryOne)(`SELECT * FROM objects WHERE bucket_name = ? AND object_key = ?`, [bucketName, objectKey]);
    if (!row)
        return undefined;
    return {
        objectId: row.object_id,
        bucketName: row.bucket_name,
        objectKey: row.object_key,
        size: row.size,
        storageClass: row.storage_class,
        lastModified: row.last_modified,
        createdTime: row.created_time,
        eTag: row.e_tag,
        versionId: row.version_id,
        deleteProtection: row.delete_protection === 1,
        tags: row.tags ? JSON.parse(row.tags) : {},
        currentThawJobId: row.current_thaw_job_id
    };
}
async function getObjectById(objectId) {
    const row = await (0, index_1.queryOne)(`SELECT * FROM objects WHERE object_id = ?`, [objectId]);
    if (!row)
        return undefined;
    return {
        objectId: row.object_id,
        bucketName: row.bucket_name,
        objectKey: row.object_key,
        size: row.size,
        storageClass: row.storage_class,
        lastModified: row.last_modified,
        createdTime: row.created_time,
        eTag: row.e_tag,
        tags: row.tags ? JSON.parse(row.tags) : {},
        versionId: row.version_id,
        deleteProtection: row.delete_protection === 1,
        currentThawJobId: row.current_thaw_job_id
    };
}
async function transitionObjectToClass(objectId, targetClass, requestId, userId, requestContext = 'manual') {
    const object = await getObjectById(objectId);
    if (!object) {
        return {
            success: false,
            error: 'Object not found'
        };
    }
    if (object.storageClass === targetClass) {
        return {
            success: true,
            objectId,
            status: targetClass,
            warnings: ['Object already in target storage class']
        };
    }
    const costEstimate = (0, costService_1.estimateTransitionCost)(objectId, object.objectKey, object.size, object.storageClass, targetClass);
    try {
        await (0, index_1.runSql)(`UPDATE objects SET storage_class = ?, last_modified = ? WHERE object_id = ?`, [targetClass, new Date().toISOString(), objectId]);
        const logId = await (0, loggingService_1.logOperation)({
            operation: 'TRANSITION',
            objectId,
            bucketName: object.bucketName,
            objectKey: object.objectKey,
            requestId,
            userId,
            status: 'success',
            details: `Transitioned from ${object.storageClass} to ${targetClass} via ${requestContext}`,
            costEstimate: costEstimate.estimatedCost
        });
        return {
            success: true,
            objectId,
            status: targetClass,
            costEstimate,
            logId
        };
    }
    catch (error) {
        const logId = await (0, loggingService_1.logOperation)({
            operation: 'TRANSITION',
            objectId,
            bucketName: object.bucketName,
            objectKey: object.objectKey,
            requestId,
            userId,
            status: 'failed',
            details: `Failed to transition from ${object.storageClass} to ${targetClass}: ${error.message}`,
            costEstimate: costEstimate.estimatedCost
        });
        return {
            success: false,
            error: error.message,
            logId
        };
    }
}
async function deleteObject(objectId, requestId, userId) {
    const object = await getObjectById(objectId);
    if (!object) {
        return {
            success: false,
            error: 'Object not found'
        };
    }
    if (object.deleteProtection) {
        const logId = await (0, loggingService_1.logOperation)({
            operation: 'DELETE',
            objectId,
            bucketName: object.bucketName,
            objectKey: object.objectKey,
            requestId,
            userId,
            status: 'failed',
            details: 'Delete protection is enabled',
            costEstimate: 0
        });
        return {
            success: false,
            error: 'Delete protection is enabled',
            logId
        };
    }
    if (object.currentThawJobId) {
        const logId = await (0, loggingService_1.logOperation)({
            operation: 'DELETE',
            objectId,
            bucketName: object.bucketName,
            objectKey: object.objectKey,
            requestId,
            userId,
            status: 'failed',
            details: 'Object has active thaw job, cannot delete',
            costEstimate: 0
        });
        return {
            success: false,
            error: 'Object has active thaw job, cannot delete',
            logId
        };
    }
    const costEstimate = (0, costService_1.estimateDeletionCost)(objectId, object.objectKey, object.size, object.storageClass);
    try {
        await (0, index_1.runSql)(`DELETE FROM objects WHERE object_id = ?`, [objectId]);
        const logId = await (0, loggingService_1.logOperation)({
            operation: 'DELETE',
            objectId,
            bucketName: object.bucketName,
            objectKey: object.objectKey,
            requestId,
            userId,
            status: 'success',
            details: 'Object deleted permanently',
            costEstimate: costEstimate.estimatedCost
        });
        return {
            success: true,
            objectId,
            costEstimate,
            logId
        };
    }
    catch (error) {
        const logId = await (0, loggingService_1.logOperation)({
            operation: 'DELETE',
            objectId,
            bucketName: object.bucketName,
            objectKey: object.objectKey,
            requestId,
            userId,
            status: 'failed',
            details: `Failed to delete object: ${error.message}`,
            costEstimate: costEstimate.estimatedCost
        });
        return {
            success: false,
            error: error.message,
            logId
        };
    }
}
async function applyLifecycleRules(bucketName, requestId, userId) {
    const rules = await getActiveLifecycleRules(bucketName);
    const results = [];
    for (const rule of rules) {
        const objects = await (0, index_1.querySql)(`SELECT * FROM objects WHERE bucket_name = ? AND object_key LIKE ?`, [bucketName, `${rule.prefix || ''}%`]);
        for (const objRow of objects) {
            const object = {
                objectId: objRow.object_id,
                bucketName: objRow.bucket_name,
                objectKey: objRow.object_key,
                size: objRow.size,
                storageClass: objRow.storage_class,
                lastModified: objRow.last_modified,
                createdTime: objRow.created_time,
                eTag: objRow.e_tag,
                versionId: objRow.version_id,
                deleteProtection: objRow.delete_protection === 1,
                tags: objRow.tags ? JSON.parse(objRow.tags) : {},
                currentThawJobId: objRow.current_thaw_job_id
            };
            const createdDays = Math.floor((new Date().getTime() - new Date(object.createdTime).getTime()) / (1000 * 60 * 60 * 24));
            for (const action of rule.actions) {
                const days = action.daysAfterCreation || action.daysAfterModification || 0;
                if (createdDays >= days) {
                    if (action.action === types_1.LifecycleAction.TRANSITION && action.targetStorageClass) {
                        const result = await transitionObjectToClass(object.objectId, action.targetStorageClass, requestId, userId, `lifecycle:${rule.ruleName}`);
                        results.push(result);
                    }
                    else if (action.action === types_1.LifecycleAction.DELETE) {
                        const result = await deleteObject(object.objectId, requestId, userId);
                        results.push(result);
                    }
                }
            }
        }
    }
    return results;
}
async function createLifecycleRule(rule) {
    await (0, index_1.runSql)(`INSERT INTO lifecycle_rules (
      rule_id, bucket_name, rule_name, status,
      prefix, tags, actions, priority, created_time, last_modified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        rule.ruleId,
        rule.bucketName,
        rule.ruleName,
        rule.status,
        rule.prefix,
        rule.tags ? JSON.stringify(rule.tags) : undefined,
        JSON.stringify(rule.actions),
        rule.priority,
        rule.createdTime,
        rule.lastModified
    ]);
    return rule;
}
async function getActiveLifecycleRules(bucketName) {
    const rows = await (0, index_1.querySql)(`SELECT * FROM lifecycle_rules WHERE bucket_name = ? AND status = 'enabled' ORDER BY priority DESC`, [bucketName]);
    return rows.map(row => ({
        ruleId: row.rule_id,
        bucketName: row.bucket_name,
        ruleName: row.rule_name,
        status: row.status,
        prefix: row.prefix,
        tags: row.tags ? JSON.parse(row.tags) : undefined,
        actions: JSON.parse(row.actions),
        priority: row.priority,
        createdTime: row.created_time,
        lastModified: row.last_modified
    }));
}
