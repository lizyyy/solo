"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = exports.ConfigStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIGS_FILE = path.join(DATA_DIR, 'configs.json');
const CHANGES_FILE = path.join(DATA_DIR, 'changes.json');
const DEFAULTS_FILE = path.join(DATA_DIR, 'defaults.json');
const SECRETS_FILE = path.join(DATA_DIR, 'secrets.json');
class ConfigStore {
    constructor() {
        this.ensureDataDir();
        this.data = this.loadData();
    }
    ensureDataDir() {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
    }
    loadData() {
        return {
            configs: this.loadFile(CONFIGS_FILE, []),
            changes: this.loadFile(CHANGES_FILE, []),
            defaults: this.loadFile(DEFAULTS_FILE, []),
            secretPatterns: this.loadSecretPatterns(),
        };
    }
    loadFile(filePath, defaultValue) {
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                return JSON.parse(content);
            }
            catch {
                return defaultValue;
            }
        }
        return defaultValue;
    }
    loadSecretPatterns() {
        if (fs.existsSync(SECRETS_FILE)) {
            try {
                const content = fs.readFileSync(SECRETS_FILE, 'utf-8');
                const parsed = JSON.parse(content);
                return parsed.map(p => ({
                    ...p,
                    pattern: new RegExp(p.pattern),
                }));
            }
            catch {
                return this.getDefaultSecretPatterns();
            }
        }
        return this.getDefaultSecretPatterns();
    }
    getDefaultSecretPatterns() {
        return [
            { pattern: /^AKIA[0-9A-Z]{16}$/, placeholder: '***AWS_ACCESS_KEY***', description: 'AWS Access Key' },
            { pattern: /^sk-[a-zA-Z0-9]{48}$/, placeholder: '***OPENAI_KEY***', description: 'OpenAI API Key' },
            { pattern: /^-----BEGIN (RSA|EC|PGP) PRIVATE KEY-----/, placeholder: '***PRIVATE_KEY***', description: 'Private Key' },
            { pattern: /^[a-zA-Z0-9_-]{32,}$/, placeholder: '***GENERIC_SECRET***', description: 'Generic Secret Token' },
            { pattern: /password|passwd|pwd|secret|token|api[_-]?key/i, placeholder: '***SENSITIVE***', description: 'Sensitive Field Name' },
        ];
    }
    saveData() {
        this.saveFile(CONFIGS_FILE, this.data.configs);
        this.saveFile(CHANGES_FILE, this.data.changes);
        this.saveFile(DEFAULTS_FILE, this.data.defaults);
    }
    saveFile(filePath, data) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }
    addConfig(config) {
        const existingIndex = this.data.configs.findIndex(c => c.environment === config.environment && c.path === config.path);
        if (existingIndex >= 0) {
            this.data.configs[existingIndex] = config;
        }
        else {
            this.data.configs.push(config);
        }
        this.saveData();
    }
    getConfigs() {
        return [...this.data.configs];
    }
    getConfigByEnvironment(env) {
        return this.data.configs.find(c => c.environment === env);
    }
    addChange(change) {
        this.data.changes.push(change);
        this.saveData();
    }
    getChanges() {
        return [...this.data.changes];
    }
    getChangesByKey(key) {
        return this.data.changes.filter(c => c.key === key);
    }
    addDefault(defaultValue) {
        const existingIndex = this.data.defaults.findIndex(d => d.key === defaultValue.key);
        if (existingIndex >= 0) {
            this.data.defaults[existingIndex] = defaultValue;
        }
        else {
            this.data.defaults.push(defaultValue);
        }
        this.saveData();
    }
    getDefaults() {
        return [...this.data.defaults];
    }
    getDefaultByKey(key) {
        return this.data.defaults.find(d => d.key === key);
    }
    getSecretPatterns() {
        return [...this.data.secretPatterns];
    }
    getEnvironments() {
        return [...new Set(this.data.configs.map(c => c.environment))];
    }
    clearAll() {
        this.data = {
            configs: [],
            changes: [],
            defaults: [],
            secretPatterns: this.getDefaultSecretPatterns(),
        };
        this.saveData();
    }
}
exports.ConfigStore = ConfigStore;
exports.store = new ConfigStore();
//# sourceMappingURL=store.js.map