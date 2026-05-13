"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Storage = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const DEFAULT_CONFIG_DIR = '.env-drift';
const CONFIG_FILE = 'config.json';
const ENVIRONMENTS_DIR = 'environments';
const SNAPSHOTS_DIR = 'snapshots';
const HISTORY_DIR = 'history';
class Storage {
    constructor(baseDir = process.cwd()) {
        this.baseDir = baseDir;
        this.configDir = path_1.default.join(baseDir, DEFAULT_CONFIG_DIR);
    }
    async isInitialized() {
        return fs_extra_1.default.pathExists(path_1.default.join(this.configDir, CONFIG_FILE));
    }
    async initialize() {
        if (await this.isInitialized()) {
            throw new Error('项目已初始化，如需重新初始化请先清理 .env-drift 目录');
        }
        const now = new Date().toISOString();
        const defaultRules = [
            {
                id: 'rule-1',
                name: '生产环境不应有 DEBUG 模式',
                type: 'value-mismatch',
                severity: 'critical',
                description: '生产环境的 DEBUG 变量必须为 false',
                enabled: true,
                config: {
                    keyPattern: 'DEBUG',
                    expectedValue: 'false',
                    environments: ['production', 'prod']
                }
            },
            {
                id: 'rule-2',
                name: '跨环境关键配置一致性',
                type: 'missing-key',
                severity: 'high',
                description: '关键配置必须在所有环境中存在',
                enabled: true,
                config: {
                    mustExist: ['DB_HOST', 'API_BASE_URL', 'AUTH_ENABLED']
                }
            }
        ];
        const config = {
            initialized: true,
            initializedAt: now,
            environments: [],
            rules: defaultRules,
            dataDir: this.configDir,
            cacheConfig: {
                snapshotRetentionDays: 90,
                historyRetentionDays: 180,
                autoInvalidationEnabled: false
            }
        };
        await fs_extra_1.default.ensureDir(this.configDir);
        await fs_extra_1.default.ensureDir(path_1.default.join(this.configDir, ENVIRONMENTS_DIR));
        await fs_extra_1.default.ensureDir(path_1.default.join(this.configDir, SNAPSHOTS_DIR));
        await fs_extra_1.default.ensureDir(path_1.default.join(this.configDir, HISTORY_DIR));
        await this.saveConfig(config);
        return config;
    }
    async getConfig() {
        if (!(await this.isInitialized())) {
            throw new Error('项目未初始化，请先运行 init 命令');
        }
        const config = await fs_extra_1.default.readJson(path_1.default.join(this.configDir, CONFIG_FILE));
        if (!config.cacheConfig) {
            config.cacheConfig = {
                snapshotRetentionDays: 90,
                historyRetentionDays: 180,
                autoInvalidationEnabled: false
            };
        }
        return config;
    }
    async saveConfig(config) {
        await fs_extra_1.default.writeJson(path_1.default.join(this.configDir, CONFIG_FILE), config, { spaces: 2 });
    }
    async addEnvironment(env) {
        const config = await this.getConfig();
        const exists = config.environments.some(e => e.name === env.name);
        if (exists) {
            throw new Error(`环境 "${env.name}" 已存在`);
        }
        config.environments.push(env);
        config.environments.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        await this.saveConfig(config);
        await fs_extra_1.default.writeJson(path_1.default.join(this.configDir, ENVIRONMENTS_DIR, `${env.name}.json`), {});
    }
    async getEnvironment(name) {
        const config = await this.getConfig();
        return config.environments.find(e => e.name === name);
    }
    async listEnvironments() {
        const config = await this.getConfig();
        return config.environments;
    }
    async saveEnvData(envName, data) {
        const envPath = path_1.default.join(this.configDir, ENVIRONMENTS_DIR, `${envName}.json`);
        if (!(await fs_extra_1.default.pathExists(envPath))) {
            throw new Error(`环境 "${envName}" 不存在`);
        }
        await fs_extra_1.default.writeJson(envPath, data, { spaces: 2 });
    }
    async getEnvData(envName) {
        const envPath = path_1.default.join(this.configDir, ENVIRONMENTS_DIR, `${envName}.json`);
        if (!(await fs_extra_1.default.pathExists(envPath))) {
            throw new Error(`环境 "${envName}" 不存在`);
        }
        return fs_extra_1.default.readJson(envPath);
    }
    async createSnapshot(snapshot) {
        const snapshotDir = path_1.default.join(this.configDir, SNAPSHOTS_DIR, snapshot.environment);
        await fs_extra_1.default.ensureDir(snapshotDir);
        await fs_extra_1.default.writeJson(path_1.default.join(snapshotDir, `${snapshot.id}.json`), snapshot, { spaces: 2 });
    }
    async listSnapshots(envName) {
        const snapshotDir = path_1.default.join(this.configDir, SNAPSHOTS_DIR, envName);
        if (!(await fs_extra_1.default.pathExists(snapshotDir))) {
            return [];
        }
        const files = await fs_extra_1.default.readdir(snapshotDir);
        const snapshots = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                snapshots.push(await fs_extra_1.default.readJson(path_1.default.join(snapshotDir, file)));
            }
        }
        return snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    async getSnapshot(envName, snapshotId) {
        const snapshotPath = path_1.default.join(this.configDir, SNAPSHOTS_DIR, envName, `${snapshotId}.json`);
        if (!(await fs_extra_1.default.pathExists(snapshotPath))) {
            return undefined;
        }
        return fs_extra_1.default.readJson(snapshotPath);
    }
    async addChangeRecord(record) {
        const historyDir = path_1.default.join(this.configDir, HISTORY_DIR);
        const date = new Date(record.timestamp).toISOString().split('T')[0];
        const historyFile = path_1.default.join(historyDir, `${date}.json`);
        let records = [];
        if (await fs_extra_1.default.pathExists(historyFile)) {
            records = await fs_extra_1.default.readJson(historyFile);
        }
        records.push(record);
        await fs_extra_1.default.writeJson(historyFile, records, { spaces: 2 });
    }
    async getHistory(startDate, endDate, envName) {
        const historyDir = path_1.default.join(this.configDir, HISTORY_DIR);
        if (!(await fs_extra_1.default.pathExists(historyDir))) {
            return [];
        }
        const files = await fs_extra_1.default.readdir(historyDir);
        let allRecords = [];
        for (const file of files) {
            if (!file.endsWith('.json'))
                continue;
            const fileDate = file.replace('.json', '');
            if (startDate && fileDate < startDate)
                continue;
            if (endDate && fileDate > endDate)
                continue;
            const records = await fs_extra_1.default.readJson(path_1.default.join(historyDir, file));
            allRecords.push(...records);
        }
        if (envName) {
            allRecords = allRecords.filter(r => r.environment === envName);
        }
        return allRecords.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
    async saveRules(rules) {
        const config = await this.getConfig();
        config.rules = rules;
        await this.saveConfig(config);
    }
    async getRules() {
        const config = await this.getConfig();
        return config.rules.filter(r => r.enabled);
    }
    async clear() {
        await fs_extra_1.default.remove(this.configDir);
    }
    async getCacheInfo() {
        const config = await this.getConfig();
        const envs = config.environments;
        const now = new Date();
        const snapshotRetentionMs = config.cacheConfig.snapshotRetentionDays * 24 * 60 * 60 * 1000;
        const historyRetentionMs = config.cacheConfig.historyRetentionDays * 24 * 60 * 60 * 1000;
        const snapshotByEnv = {};
        let totalSnapshots = 0;
        let expiredSnapshots = 0;
        for (const env of envs) {
            const snapshots = await this.listSnapshots(env.name);
            snapshotByEnv[env.name] = snapshots.length;
            totalSnapshots += snapshots.length;
            for (const s of snapshots) {
                if (now.getTime() - new Date(s.createdAt).getTime() > snapshotRetentionMs) {
                    expiredSnapshots++;
                }
            }
        }
        const allHistory = await this.getHistory();
        const historyByEnv = {};
        for (const env of envs) {
            historyByEnv[env.name] = allHistory.filter(h => h.environment === env.name).length;
        }
        let expiredHistory = 0;
        for (const h of allHistory) {
            if (now.getTime() - new Date(h.timestamp).getTime() > historyRetentionMs) {
                expiredHistory++;
            }
        }
        let storageSize = 0;
        try {
            const files = await fs_extra_1.default.readdir(this.configDir, { withFileTypes: true });
            for (const file of files) {
                const fullPath = path_1.default.join(this.configDir, file.name);
                if (file.isFile()) {
                    const stat = await fs_extra_1.default.stat(fullPath);
                    storageSize += stat.size;
                }
                else if (file.isDirectory()) {
                    storageSize += await this._getDirSize(fullPath);
                }
            }
        }
        catch (e) {
            storageSize = 0;
        }
        return {
            snapshots: {
                total: totalSnapshots,
                byEnvironment: snapshotByEnv,
                expired: expiredSnapshots
            },
            history: {
                total: allHistory.length,
                byEnvironment: historyByEnv,
                expired: expiredHistory
            },
            storageSize
        };
    }
    async _getDirSize(dir) {
        let size = 0;
        const files = await fs_extra_1.default.readdir(dir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path_1.default.join(dir, file.name);
            if (file.isFile()) {
                const stat = await fs_extra_1.default.stat(fullPath);
                size += stat.size;
            }
            else if (file.isDirectory()) {
                size += await this._getDirSize(fullPath);
            }
        }
        return size;
    }
    async invalidateExpiredSnapshots(days) {
        const config = await this.getConfig();
        let retentionDays;
        if (days !== undefined) {
            if (isNaN(days) || days < 0) {
                throw new Error(`无效的天数: ${days}，必须是非负整数`);
            }
            retentionDays = days;
        }
        else {
            retentionDays = config.cacheConfig.snapshotRetentionDays;
        }
        const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
        const now = new Date();
        let deletedCount = 0;
        const envs = config.environments;
        for (const env of envs) {
            const snapshots = await this.listSnapshots(env.name);
            for (const s of snapshots) {
                if (now.getTime() - new Date(s.createdAt).getTime() > retentionMs) {
                    const snapshotPath = path_1.default.join(this.configDir, SNAPSHOTS_DIR, env.name, `${s.id}.json`);
                    await fs_extra_1.default.remove(snapshotPath);
                    deletedCount++;
                }
            }
        }
        return deletedCount;
    }
    async invalidateExpiredHistory(days) {
        const config = await this.getConfig();
        let retentionDays;
        if (days !== undefined) {
            if (isNaN(days) || days < 0) {
                throw new Error(`无效的天数: ${days}，必须是非负整数`);
            }
            retentionDays = days;
        }
        else {
            retentionDays = config.cacheConfig.historyRetentionDays;
        }
        const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
        const now = new Date();
        let deletedCount = 0;
        const historyDir = path_1.default.join(this.configDir, HISTORY_DIR);
        if (!(await fs_extra_1.default.pathExists(historyDir))) {
            return 0;
        }
        const files = await fs_extra_1.default.readdir(historyDir);
        for (const file of files) {
            if (!file.endsWith('.json'))
                continue;
            const filePath = path_1.default.join(historyDir, file);
            const records = await fs_extra_1.default.readJson(filePath);
            const remaining = records.filter(r => {
                return now.getTime() - new Date(r.timestamp).getTime() <= retentionMs;
            });
            const deleted = records.length - remaining.length;
            deletedCount += deleted;
            if (remaining.length === 0) {
                await fs_extra_1.default.remove(filePath);
            }
            else {
                await fs_extra_1.default.writeJson(filePath, remaining, { spaces: 2 });
            }
        }
        return deletedCount;
    }
    async clearAllSnapshots(envName) {
        let deletedCount = 0;
        if (envName) {
            const env = await this.getEnvironment(envName);
            if (!env) {
                throw new Error(`环境 "${envName}" 不存在`);
            }
            const snapshotDir = path_1.default.join(this.configDir, SNAPSHOTS_DIR, envName);
            if (await fs_extra_1.default.pathExists(snapshotDir)) {
                const files = await fs_extra_1.default.readdir(snapshotDir);
                deletedCount = files.filter(f => f.endsWith('.json')).length;
                await fs_extra_1.default.remove(snapshotDir);
            }
        }
        else {
            const config = await this.getConfig();
            for (const env of config.environments) {
                const snapshotDir = path_1.default.join(this.configDir, SNAPSHOTS_DIR, env.name);
                if (await fs_extra_1.default.pathExists(snapshotDir)) {
                    const files = await fs_extra_1.default.readdir(snapshotDir);
                    deletedCount += files.filter(f => f.endsWith('.json')).length;
                    await fs_extra_1.default.remove(snapshotDir);
                }
            }
        }
        return deletedCount;
    }
    async clearAllHistory(envName) {
        let deletedCount = 0;
        const historyDir = path_1.default.join(this.configDir, HISTORY_DIR);
        if (!(await fs_extra_1.default.pathExists(historyDir))) {
            return 0;
        }
        if (envName) {
            const env = await this.getEnvironment(envName);
            if (!env) {
                throw new Error(`环境 "${envName}" 不存在`);
            }
            const files = await fs_extra_1.default.readdir(historyDir);
            for (const file of files) {
                if (!file.endsWith('.json'))
                    continue;
                const filePath = path_1.default.join(historyDir, file);
                const records = await fs_extra_1.default.readJson(filePath);
                const remaining = records.filter(r => r.environment !== envName);
                const deleted = records.length - remaining.length;
                deletedCount += deleted;
                if (remaining.length === 0) {
                    await fs_extra_1.default.remove(filePath);
                }
                else {
                    await fs_extra_1.default.writeJson(filePath, remaining, { spaces: 2 });
                }
            }
        }
        else {
            const files = await fs_extra_1.default.readdir(historyDir);
            for (const file of files) {
                if (!file.endsWith('.json'))
                    continue;
                const filePath = path_1.default.join(historyDir, file);
                const records = await fs_extra_1.default.readJson(filePath);
                deletedCount += records.length;
                await fs_extra_1.default.remove(filePath);
            }
        }
        return deletedCount;
    }
    async deleteSnapshot(envName, snapshotId) {
        const snapshotPath = path_1.default.join(this.configDir, SNAPSHOTS_DIR, envName, `${snapshotId}.json`);
        if (await fs_extra_1.default.pathExists(snapshotPath)) {
            await fs_extra_1.default.remove(snapshotPath);
            return true;
        }
        return false;
    }
    async updateCacheConfig(cacheConfig) {
        const config = await this.getConfig();
        config.cacheConfig = {
            ...config.cacheConfig,
            ...cacheConfig
        };
        await this.saveConfig(config);
    }
}
exports.Storage = Storage;
