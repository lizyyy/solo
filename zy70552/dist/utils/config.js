"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDatabaseConfig = loadDatabaseConfig;
exports.loadMigrationScripts = loadMigrationScripts;
exports.loadShadowData = loadShadowData;
exports.loadTableSchemas = loadTableSchemas;
exports.ensureOutputDir = ensureOutputDir;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function loadDatabaseConfig(configPath) {
    const content = fs_1.default.readFileSync(path_1.default.resolve(configPath), 'utf-8');
    return JSON.parse(content);
}
function loadMigrationScripts(scriptsPath) {
    return [{ id: '1', name: 'test', path: scriptsPath, sql: 'SELECT 1' }];
}
function loadShadowData(dataPath) {
    return [];
}
function loadTableSchemas(schemasPath) {
    return [];
}
function ensureOutputDir(outputDir, runId) {
    const runOutputDir = path_1.default.join(outputDir, runId);
    if (!fs_1.default.existsSync(runOutputDir)) {
        fs_1.default.mkdirSync(runOutputDir, { recursive: true });
    }
    return runOutputDir;
}
