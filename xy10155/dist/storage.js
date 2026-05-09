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
            dataDir: this.configDir
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
        return fs_extra_1.default.readJson(path_1.default.join(this.configDir, CONFIG_FILE));
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
}
exports.Storage = Storage;
