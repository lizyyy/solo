"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlagLoader = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class FlagLoader {
    constructor() {
        this.badSamples = [];
    }
    async loadFlags(flagsFile, inlineFlags, defaultStrategy = { fileDefaultPriority: true, explicitDefaultOverride: true }) {
        const fileFlags = [];
        if (flagsFile) {
            const loaded = await this.loadFlagsFromFile(flagsFile);
            fileFlags.push(...loaded.flags);
            this.badSamples.push(...loaded.badSamples);
        }
        if (inlineFlags && inlineFlags.length > 0) {
            const merged = this.mergeFlags(fileFlags, inlineFlags, defaultStrategy);
            return { flags: merged, badSamples: this.badSamples };
        }
        return { flags: fileFlags, badSamples: this.badSamples };
    }
    async loadFlagsFromFile(filePath) {
        const flags = [];
        const badSamples = [];
        try {
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
            const ext = path_1.default.extname(filePath).toLowerCase();
            if (ext === '.json') {
                const parsed = JSON.parse(content);
                const flagList = Array.isArray(parsed) ? parsed : parsed.flags || parsed;
                if (!Array.isArray(flagList)) {
                    badSamples.push({
                        filePath,
                        reason: '无效的开关清单格式，期望是数组或包含flags字段的对象',
                        errorType: 'parse-error',
                        rawContent: content.slice(0, 500)
                    });
                    return { flags: [], badSamples };
                }
                for (let i = 0; i < flagList.length; i++) {
                    const item = flagList[i];
                    try {
                        const flag = this.validateAndNormalizeFlag(item, filePath);
                        flags.push(flag);
                    }
                    catch (error) {
                        badSamples.push({
                            filePath,
                            lineNumber: i + 1,
                            reason: error instanceof Error ? error.message : '未知错误',
                            errorType: 'invalid-default',
                            rawContent: JSON.stringify(item)
                        });
                    }
                }
            }
            else if (ext === '.csv') {
                const lines = content.split('\n');
                const headers = lines[0].split(',').map(h => h.trim());
                for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim())
                        continue;
                    const values = lines[i].split(',').map(v => v.trim());
                    try {
                        const flag = {
                            name: values[headers.indexOf('name')] || values[0],
                            defaultValue: this.parseBoolean(values[headers.indexOf('defaultValue')] || values[1]),
                            description: values[headers.indexOf('description')] || values[2],
                            source: filePath
                        };
                        flags.push(this.validateAndNormalizeFlag(flag, filePath));
                    }
                    catch (error) {
                        badSamples.push({
                            filePath,
                            lineNumber: i + 1,
                            reason: error instanceof Error ? error.message : '未知错误',
                            errorType: 'invalid-default',
                            rawContent: lines[i]
                        });
                    }
                }
            }
            else {
                badSamples.push({
                    filePath,
                    reason: `不支持的文件格式: ${ext}，仅支持 JSON 和 CSV`,
                    errorType: 'parse-error'
                });
            }
        }
        catch (error) {
            badSamples.push({
                filePath,
                reason: error instanceof Error ? error.message : '文件读取失败',
                errorType: 'parse-error',
                rawContent: error instanceof Error ? error.stack : undefined
            });
        }
        return { flags, badSamples };
    }
    validateAndNormalizeFlag(flag, source) {
        if (!flag || typeof flag !== 'object') {
            throw new Error('开关必须是对象类型');
        }
        if (!flag.name || typeof flag.name !== 'string' || flag.name.trim() === '') {
            throw new Error('开关名称(name)不能为空');
        }
        if (flag.defaultValue === undefined) {
            throw new Error(`开关 ${flag.name} 缺少 defaultValue 字段`);
        }
        const defaultValue = this.parseBoolean(flag.defaultValue);
        return {
            name: flag.name.trim(),
            defaultValue,
            description: flag.description?.toString(),
            source: flag.source || source
        };
    }
    parseBoolean(value) {
        if (typeof value === 'boolean')
            return value;
        if (typeof value === 'number')
            return value !== 0;
        if (typeof value === 'string') {
            const lower = value.toLowerCase().trim();
            if (['true', '1', 'yes', 'on'].includes(lower))
                return true;
            if (['false', '0', 'no', 'off'].includes(lower))
                return false;
        }
        throw new Error(`无法将 "${value}" 解析为布尔值`);
    }
    mergeFlags(fileFlags, inlineFlags, strategy) {
        const flagMap = new Map();
        const primarySource = strategy.fileDefaultPriority ? fileFlags : inlineFlags;
        const secondarySource = strategy.fileDefaultPriority ? inlineFlags : fileFlags;
        for (const flag of primarySource) {
            flagMap.set(flag.name, flag);
        }
        for (const flag of secondarySource) {
            const existing = flagMap.get(flag.name);
            if (!existing) {
                flagMap.set(flag.name, flag);
            }
            else if (strategy.explicitDefaultOverride && flag.source) {
                flagMap.set(flag.name, { ...existing, ...flag });
            }
        }
        return Array.from(flagMap.values());
    }
}
exports.FlagLoader = FlagLoader;
//# sourceMappingURL=flag-loader.js.map