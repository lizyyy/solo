"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultStore = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const isEqual_1 = __importDefault(require("lodash/isEqual"));
class ResultStore {
    constructor(dataDir = './data') {
        this.dataDir = dataDir;
        this.resultsFile = path_1.default.join(dataDir, 'results.json');
        this.partitionsFile = path_1.default.join(dataDir, 'partitions.json');
        this.failuresFile = path_1.default.join(dataDir, 'failures.json');
        this.ensureDataDir();
    }
    ensureDataDir() {
        fs_extra_1.default.ensureDirSync(this.dataDir);
        if (!fs_extra_1.default.existsSync(this.resultsFile)) {
            fs_extra_1.default.writeJsonSync(this.resultsFile, []);
        }
        if (!fs_extra_1.default.existsSync(this.partitionsFile)) {
            fs_extra_1.default.writeJsonSync(this.partitionsFile, []);
        }
        if (!fs_extra_1.default.existsSync(this.failuresFile)) {
            fs_extra_1.default.writeJsonSync(this.failuresFile, []);
        }
    }
    findPreviousResult(orderId) {
        const results = this.loadResults();
        const matching = results.filter(r => r.orderId === orderId);
        if (matching.length === 0)
            return null;
        return matching.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    }
    detectConflict(orderId, schemaDiffs) {
        const previous = this.findPreviousResult(orderId);
        if (previous) {
            const schemaUnchanged = (0, isEqual_1.default)(previous.schemaDiffs, schemaDiffs);
            if (schemaUnchanged) {
                return {
                    conflict: false,
                    previousResult: previous,
                    canReuse: true
                };
            }
            else if (previous.humanRemarks) {
                return {
                    conflict: true,
                    previousResult: previous,
                    reason: 'Schema已变更，但有人工备注未处理，请重新审核',
                    canReuse: false
                };
            }
            else {
                return {
                    conflict: false,
                    previousResult: previous,
                    canReuse: false
                };
            }
        }
        return { conflict: false, canReuse: false };
    }
    storeResult(result) {
        const results = this.loadResults();
        const now = new Date().toISOString();
        const stored = {
            ...result,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now
        };
        results.push(stored);
        this.saveResults(results);
        if (result.status === 'failed') {
            this.storeFailure(stored);
        }
        return stored;
    }
    addHumanRemark(resultId, remark, operator) {
        const results = this.loadResults();
        const index = results.findIndex(r => r.id === resultId);
        if (index === -1)
            return null;
        results[index] = {
            ...results[index],
            humanRemarks: results[index].humanRemarks
                ? `${results[index].humanRemarks}\n${remark}`
                : remark,
            updatedAt: new Date().toISOString()
        };
        this.saveResults(results);
        return results[index];
    }
    confirmResult(resultId, confirmed, operator) {
        const results = this.loadResults();
        const index = results.findIndex(r => r.id === resultId);
        if (index === -1)
            return null;
        results[index] = {
            ...results[index],
            humanConfirmed: confirmed,
            confirmedAt: new Date().toISOString(),
            confirmedBy: operator,
            updatedAt: new Date().toISOString()
        };
        this.saveResults(results);
        return results[index];
    }
    loadResults() {
        return fs_extra_1.default.readJsonSync(this.resultsFile, { throws: false }) || [];
    }
    saveResults(results) {
        fs_extra_1.default.writeJsonSync(this.resultsFile, results, { spaces: 2 });
    }
    storeFailure(result) {
        const failures = this.loadFailures();
        failures.push(result);
        fs_extra_1.default.writeJsonSync(this.failuresFile, failures, { spaces: 2 });
    }
    loadFailures() {
        return fs_extra_1.default.readJsonSync(this.failuresFile, { throws: false }) || [];
    }
    getFailuresByGroup(group) {
        return this.loadFailures().filter(f => f.failureGroup === group);
    }
    getFailureGroups() {
        const failures = this.loadFailures();
        return [...new Set(failures.map(f => f.failureGroup).filter(Boolean))];
    }
    getPartitions() {
        return fs_extra_1.default.readJsonSync(this.partitionsFile, { throws: false }) || [];
    }
    confirmPartition(partitionName, operator) {
        const partitions = this.getPartitions();
        const index = partitions.findIndex(p => p.name === partitionName);
        if (index === -1)
            return null;
        partitions[index] = {
            ...partitions[index],
            humanConfirmed: true,
            confirmedAt: new Date().toISOString(),
            confirmedBy: operator
        };
        fs_extra_1.default.writeJsonSync(this.partitionsFile, partitions, { spaces: 2 });
        return partitions[index];
    }
    addPartitions(partitions) {
        const existing = this.getPartitions();
        const newPartitions = partitions.map(p => ({
            ...p,
            humanConfirmed: false
        }));
        const merged = [...existing, ...newPartitions];
        fs_extra_1.default.writeJsonSync(this.partitionsFile, merged, { spaces: 2 });
    }
    addOrUpdatePartitions(partitions) {
        const existing = this.getPartitions();
        const existingMap = new Map(existing.map(p => [p.name, p]));
        for (const p of partitions) {
            if (existingMap.has(p.name)) {
                const existing = existingMap.get(p.name);
                existingMap.set(p.name, {
                    ...existing,
                    recordCount: existing.recordCount + p.recordCount
                });
            }
            else {
                existingMap.set(p.name, {
                    ...p,
                    humanConfirmed: false
                });
            }
        }
        const merged = Array.from(existingMap.values());
        fs_extra_1.default.writeJsonSync(this.partitionsFile, merged, { spaces: 2 });
    }
    getUnconfirmedPartitions() {
        return this.getPartitions().filter(p => !p.humanConfirmed);
    }
    filterByFailure(items, failureGroup) {
        return items.filter(item => item.failureGroup === failureGroup);
    }
    getAllResults() {
        return this.loadResults();
    }
}
exports.ResultStore = ResultStore;
