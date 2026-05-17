"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const defaultConfig = {
    port: 3000,
    host: 'localhost',
    storageType: 'memory',
    logLevel: 'info'
};
function loadConfig() {
    const config = { ...defaultConfig };
    if (process.env.PORT) {
        config.port = parseInt(process.env.PORT, 10);
    }
    if (process.env.HOST) {
        config.host = process.env.HOST;
    }
    if (process.env.STORAGE_TYPE) {
        config.storageType = process.env.STORAGE_TYPE;
    }
    if (process.env.LOG_LEVEL) {
        config.logLevel = process.env.LOG_LEVEL;
    }
    validateConfig(config);
    return config;
}
function validateConfig(config) {
    const missing = [];
    if (isNaN(config.port)) {
        missing.push('PORT (必须是有效数字)');
    }
    if (!config.host) {
        missing.push('HOST');
    }
    if (missing.length > 0) {
        throw new Error(`配置缺失或无效: ${missing.join(', ')}\n` +
            `请复制 .env.example 为 .env 并配置必要参数，或设置环境变量。\n` +
            `本地开发可直接使用默认配置，无需额外设置。`);
    }
}
