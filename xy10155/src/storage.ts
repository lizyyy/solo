import fs from 'fs-extra';
import path from 'path';
import {
  ProjectConfig,
  Environment,
  Snapshot,
  ChangeRecord,
  RiskRule,
  EnvConfig
} from './types';

const DEFAULT_CONFIG_DIR = '.env-drift';
const CONFIG_FILE = 'config.json';
const ENVIRONMENTS_DIR = 'environments';
const SNAPSHOTS_DIR = 'snapshots';
const HISTORY_DIR = 'history';

export class Storage {
  private baseDir: string;
  private configDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
    this.configDir = path.join(baseDir, DEFAULT_CONFIG_DIR);
  }

  async isInitialized(): Promise<boolean> {
    return fs.pathExists(path.join(this.configDir, CONFIG_FILE));
  }

  async initialize(): Promise<ProjectConfig> {
    if (await this.isInitialized()) {
      throw new Error('项目已初始化，如需重新初始化请先清理 .env-drift 目录');
    }

    const now = new Date().toISOString();
    const defaultRules: RiskRule[] = [
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

    const config: ProjectConfig = {
      initialized: true,
      initializedAt: now,
      environments: [],
      rules: defaultRules,
      dataDir: this.configDir
    };

    await fs.ensureDir(this.configDir);
    await fs.ensureDir(path.join(this.configDir, ENVIRONMENTS_DIR));
    await fs.ensureDir(path.join(this.configDir, SNAPSHOTS_DIR));
    await fs.ensureDir(path.join(this.configDir, HISTORY_DIR));

    await this.saveConfig(config);
    return config;
  }

  async getConfig(): Promise<ProjectConfig> {
    if (!(await this.isInitialized())) {
      throw new Error('项目未初始化，请先运行 init 命令');
    }
    return fs.readJson(path.join(this.configDir, CONFIG_FILE));
  }

  async saveConfig(config: ProjectConfig): Promise<void> {
    await fs.writeJson(path.join(this.configDir, CONFIG_FILE), config, { spaces: 2 });
  }

  async addEnvironment(env: Environment): Promise<void> {
    const config = await this.getConfig();
    const exists = config.environments.some(e => e.name === env.name);
    if (exists) {
      throw new Error(`环境 "${env.name}" 已存在`);
    }
    config.environments.push(env);
    config.environments.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    await this.saveConfig(config);
    await fs.writeJson(path.join(this.configDir, ENVIRONMENTS_DIR, `${env.name}.json`), {});
  }

  async getEnvironment(name: string): Promise<Environment | undefined> {
    const config = await this.getConfig();
    return config.environments.find(e => e.name === name);
  }

  async listEnvironments(): Promise<Environment[]> {
    const config = await this.getConfig();
    return config.environments;
  }

  async saveEnvData(envName: string, data: EnvConfig): Promise<void> {
    const envPath = path.join(this.configDir, ENVIRONMENTS_DIR, `${envName}.json`);
    if (!(await fs.pathExists(envPath))) {
      throw new Error(`环境 "${envName}" 不存在`);
    }
    await fs.writeJson(envPath, data, { spaces: 2 });
  }

  async getEnvData(envName: string): Promise<EnvConfig> {
    const envPath = path.join(this.configDir, ENVIRONMENTS_DIR, `${envName}.json`);
    if (!(await fs.pathExists(envPath))) {
      throw new Error(`环境 "${envName}" 不存在`);
    }
    return fs.readJson(envPath);
  }

  async createSnapshot(snapshot: Snapshot): Promise<void> {
    const snapshotDir = path.join(this.configDir, SNAPSHOTS_DIR, snapshot.environment);
    await fs.ensureDir(snapshotDir);
    await fs.writeJson(path.join(snapshotDir, `${snapshot.id}.json`), snapshot, { spaces: 2 });
  }

  async listSnapshots(envName: string): Promise<Snapshot[]> {
    const snapshotDir = path.join(this.configDir, SNAPSHOTS_DIR, envName);
    if (!(await fs.pathExists(snapshotDir))) {
      return [];
    }
    const files = await fs.readdir(snapshotDir);
    const snapshots: Snapshot[] = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        snapshots.push(await fs.readJson(path.join(snapshotDir, file)));
      }
    }
    return snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getSnapshot(envName: string, snapshotId: string): Promise<Snapshot | undefined> {
    const snapshotPath = path.join(this.configDir, SNAPSHOTS_DIR, envName, `${snapshotId}.json`);
    if (!(await fs.pathExists(snapshotPath))) {
      return undefined;
    }
    return fs.readJson(snapshotPath);
  }

  async addChangeRecord(record: ChangeRecord): Promise<void> {
    const historyDir = path.join(this.configDir, HISTORY_DIR);
    const date = new Date(record.timestamp).toISOString().split('T')[0];
    const historyFile = path.join(historyDir, `${date}.json`);

    let records: ChangeRecord[] = [];
    if (await fs.pathExists(historyFile)) {
      records = await fs.readJson(historyFile);
    }
    records.push(record);
    await fs.writeJson(historyFile, records, { spaces: 2 });
  }

  async getHistory(startDate?: string, endDate?: string, envName?: string): Promise<ChangeRecord[]> {
    const historyDir = path.join(this.configDir, HISTORY_DIR);
    if (!(await fs.pathExists(historyDir))) {
      return [];
    }

    const files = await fs.readdir(historyDir);
    let allRecords: ChangeRecord[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const fileDate = file.replace('.json', '');

      if (startDate && fileDate < startDate) continue;
      if (endDate && fileDate > endDate) continue;

      const records: ChangeRecord[] = await fs.readJson(path.join(historyDir, file));
      allRecords.push(...records);
    }

    if (envName) {
      allRecords = allRecords.filter(r => r.environment === envName);
    }

    return allRecords.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async saveRules(rules: RiskRule[]): Promise<void> {
    const config = await this.getConfig();
    config.rules = rules;
    await this.saveConfig(config);
  }

  async getRules(): Promise<RiskRule[]> {
    const config = await this.getConfig();
    return config.rules.filter(r => r.enabled);
  }

  async clear(): Promise<void> {
    await fs.remove(this.configDir);
  }
}
