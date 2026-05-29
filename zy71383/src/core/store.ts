import * as fs from 'fs';
import * as path from 'path';
import { ConfigFile, ChangeRecord, DefaultValue, SecretPlaceholder, EnvironmentName } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIGS_FILE = path.join(DATA_DIR, 'configs.json');
const CHANGES_FILE = path.join(DATA_DIR, 'changes.json');
const DEFAULTS_FILE = path.join(DATA_DIR, 'defaults.json');
const SECRETS_FILE = path.join(DATA_DIR, 'secrets.json');

interface StoreData {
  configs: ConfigFile[];
  changes: ChangeRecord[];
  defaults: DefaultValue[];
  secretPatterns: SecretPlaceholder[];
}

export class ConfigStore {
  private data: StoreData;

  constructor() {
    this.ensureDataDir();
    this.data = this.loadData();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadData(): StoreData {
    return {
      configs: this.loadFile<ConfigFile[]>(CONFIGS_FILE, []),
      changes: this.loadFile<ChangeRecord[]>(CHANGES_FILE, []),
      defaults: this.loadFile<DefaultValue[]>(DEFAULTS_FILE, []),
      secretPatterns: this.loadSecretPatterns(),
    };
  }

  private loadFile<T>(filePath: string, defaultValue: T): T {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as T;
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  }

  private loadSecretPatterns(): SecretPlaceholder[] {
    if (fs.existsSync(SECRETS_FILE)) {
      try {
        const content = fs.readFileSync(SECRETS_FILE, 'utf-8');
        const parsed = JSON.parse(content) as Array<{ pattern: string; placeholder: string; description: string }>;
        return parsed.map(p => ({
          ...p,
          pattern: new RegExp(p.pattern),
        }));
      } catch {
        return this.getDefaultSecretPatterns();
      }
    }
    return this.getDefaultSecretPatterns();
  }

  private getDefaultSecretPatterns(): SecretPlaceholder[] {
    return [
      { pattern: /^AKIA[0-9A-Z]{16}$/, placeholder: '***AWS_ACCESS_KEY***', description: 'AWS Access Key' },
      { pattern: /^sk-[a-zA-Z0-9]{48}$/, placeholder: '***OPENAI_KEY***', description: 'OpenAI API Key' },
      { pattern: /^-----BEGIN (RSA|EC|PGP) PRIVATE KEY-----/, placeholder: '***PRIVATE_KEY***', description: 'Private Key' },
      { pattern: /^[a-zA-Z0-9_-]{32,}$/, placeholder: '***GENERIC_SECRET***', description: 'Generic Secret Token' },
      { pattern: /password|passwd|pwd|secret|token|api[_-]?key/i, placeholder: '***SENSITIVE***', description: 'Sensitive Field Name' },
    ];
  }

  private saveData(): void {
    this.saveFile(CONFIGS_FILE, this.data.configs);
    this.saveFile(CHANGES_FILE, this.data.changes);
    this.saveFile(DEFAULTS_FILE, this.data.defaults);
  }

  private saveFile<T>(filePath: string, data: T): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  addConfig(config: ConfigFile): void {
    const existingIndex = this.data.configs.findIndex(
      c => c.environment === config.environment && c.path === config.path
    );
    if (existingIndex >= 0) {
      this.data.configs[existingIndex] = config;
    } else {
      this.data.configs.push(config);
    }
    this.saveData();
  }

  getConfigs(): ConfigFile[] {
    return [...this.data.configs];
  }

  getConfigByEnvironment(env: EnvironmentName): ConfigFile | undefined {
    return this.data.configs.find(c => c.environment === env);
  }

  addChange(change: ChangeRecord): void {
    this.data.changes.push(change);
    this.saveData();
  }

  getChanges(): ChangeRecord[] {
    return [...this.data.changes];
  }

  getChangesByKey(key: string): ChangeRecord[] {
    return this.data.changes.filter(c => c.key === key);
  }

  addDefault(defaultValue: DefaultValue): void {
    const existingIndex = this.data.defaults.findIndex(d => d.key === defaultValue.key);
    if (existingIndex >= 0) {
      this.data.defaults[existingIndex] = defaultValue;
    } else {
      this.data.defaults.push(defaultValue);
    }
    this.saveData();
  }

  getDefaults(): DefaultValue[] {
    return [...this.data.defaults];
  }

  getDefaultByKey(key: string): DefaultValue | undefined {
    return this.data.defaults.find(d => d.key === key);
  }

  getSecretPatterns(): SecretPlaceholder[] {
    return [...this.data.secretPatterns];
  }

  getEnvironments(): EnvironmentName[] {
    return [...new Set(this.data.configs.map(c => c.environment))];
  }

  clearAll(): void {
    this.data = {
      configs: [],
      changes: [],
      defaults: [],
      secretPatterns: this.getDefaultSecretPatterns(),
    };
    this.saveData();
  }
}

export const store = new ConfigStore();
