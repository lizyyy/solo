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
    const resolvedPath = path_1.default.resolve(configPath);
    if (!fs_1.default.existsSync(resolvedPath)) {
        throw new Error(`Database config file not found: ${resolvedPath}`);
    }
    const content = fs_1.default.readFileSync(resolvedPath, 'utf-8');
    return JSON.parse(content);
}
function loadMigrationScripts(scriptsPath) {
    const resolvedPath = path_1.default.resolve(scriptsPath);
    if (!fs_1.default.existsSync(resolvedPath)) {
        throw new Error(`Migration scripts directory not found: ${resolvedPath}`);
    }
    const scripts = [];
    const files = fs_1.default.readdirSync(resolvedPath)
        .filter(f => f.endsWith('.sql'))
        .sort();
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = path_1.default.join(resolvedPath, file);
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        const { upSql, rollbackSql } = parseMigrationSql(content);
        scripts.push({
            id: `migration_${String(i + 1).padStart(4, '0')}`,
            name: path_1.default.basename(file, '.sql'),
            path: filePath,
            sql: upSql,
            rollbackSql: rollbackSql,
            order: i + 1
        });
    }
    return scripts;
}
function parseMigrationSql(content) {
    const upMatch = content.match(/--\s*UP\s*([\s\S]*?)(?=--\s*ROLLBACK|$)/i);
    const rollbackMatch = content.match(/--\s*ROLLBACK\s*([\s\S]*)/i);
    return {
        upSql: upMatch ? upMatch[1].trim() : content.trim(),
        rollbackSql: rollbackMatch ? rollbackMatch[1].trim() : ''
    };
}
function loadShadowData(dataPath) {
    const resolvedPath = path_1.default.resolve(dataPath);
    if (!fs_1.default.existsSync(resolvedPath)) {
        throw new Error(`Shadow data directory not found: ${resolvedPath}`);
    }
    const shadowDataList = [];
    const files = fs_1.default.readdirSync(resolvedPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
        const filePath = path_1.default.join(resolvedPath, file);
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        shadowDataList.push({
            tableName: data.tableName || path_1.default.basename(file, '.json'),
            rows: Array.isArray(data.rows) ? data.rows : [data],
            primaryKey: data.primaryKey || []
        });
    }
    return shadowDataList;
}
function loadTableSchemas(schemasPath) {
    const resolvedPath = path_1.default.resolve(schemasPath);
    if (!fs_1.default.existsSync(resolvedPath)) {
        throw new Error(`Table schemas directory not found: ${resolvedPath}`);
    }
    const schemas = [];
    const files = fs_1.default.readdirSync(resolvedPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
        const filePath = path_1.default.join(resolvedPath, file);
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        schemas.push({
            tableName: data.tableName || path_1.default.basename(file, '.json'),
            columns: data.columns || [],
            primaryKey: data.primaryKey || [],
            indexes: data.indexes || []
        });
    }
    return schemas;
}
function ensureOutputDir(outputDir, runId) {
    const runOutputDir = path_1.default.join(path_1.default.resolve(outputDir), runId);
    if (!fs_1.default.existsSync(runOutputDir)) {
        fs_1.default.mkdirSync(runOutputDir, { recursive: true });
    }
    return runOutputDir;
}
