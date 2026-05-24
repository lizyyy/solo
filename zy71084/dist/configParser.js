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
exports.ConfigParser = void 0;
const fs = __importStar(require("fs"));
const yaml = __importStar(require("js-yaml"));
class ConfigParser {
    static parseTargetsFromYaml(filePath) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`配置文件不存在: ${filePath}`);
        }
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const lineMap = this.buildLineMap(lines);
        try {
            const data = yaml.load(content);
            return this.parseTargetsData(data, filePath, lineMap);
        }
        catch (e) {
            throw new Error(`解析 YAML 配置失败: ${e}`);
        }
    }
    static parseTargetsFromJson(filePath) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`配置文件不存在: ${filePath}`);
        }
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const lineMap = this.buildLineMap(lines);
        try {
            const data = JSON.parse(content);
            return this.parseTargetsData(data, filePath, lineMap);
        }
        catch (e) {
            throw new Error(`解析 JSON 配置失败: ${e}`);
        }
    }
    static buildLineMap(lines) {
        const map = new Map();
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line && !line.startsWith('#') && !line.startsWith('//')) {
                const keyMatch = line.match(/^["']?(\w+)["']?\s*[:=]/);
                if (keyMatch) {
                    map.set(keyMatch[1].toLowerCase(), i + 1);
                }
                const bundleIdMatch = line.match(/["']?(bundleId|bundle_?id)["']?\s*[:=]\s*["']?([^"',\s]+)["']?/i);
                if (bundleIdMatch) {
                    map.set(`bundleid:${bundleIdMatch[2]}`, i + 1);
                }
                const nameMatch = line.match(/["']?(name|target)["']?\s*[:=]\s*["']?([^"',\s]+(?:\s+[^"',]+)*)["']?/i);
                if (nameMatch) {
                    map.set(`target:${nameMatch[2]}`, i + 1);
                }
                const profileNameMatch = line.match(/["']?(profileName|profile)["']?\s*[:=]\s*["']?([^"',]+(?:\s+[^"',]+)*)["']?/i);
                if (profileNameMatch) {
                    map.set(`profile:${profileNameMatch[2]}`, i + 1);
                }
                const certNameMatch = line.match(/["']?(certificateName|certificate)["']?\s*[:=]\s*["']?([^"',]+(?:\s+[^"',]+)*)["']?/i);
                if (certNameMatch) {
                    map.set(`cert:${certNameMatch[2]}`, i + 1);
                }
            }
        }
        return map;
    }
    static parseTargetsData(data, sourceFile, lineMap) {
        const targets = [];
        if (Array.isArray(data)) {
            data.forEach((item, index) => {
                const target = this.parseTargetItem(item, sourceFile, lineMap, index);
                targets.push(target);
            });
        }
        else if (data && typeof data === 'object') {
            if (data.targets && Array.isArray(data.targets)) {
                data.targets.forEach((item, index) => {
                    const target = this.parseTargetItem(item, sourceFile, lineMap, index);
                    targets.push(target);
                });
            }
            else {
                const target = this.parseTargetItem(data, sourceFile, lineMap, 0);
                targets.push(target);
            }
        }
        return targets;
    }
    static parseTargetItem(item, sourceFile, lineMap, index) {
        const name = item.name || item.target || `target-${index}`;
        const bundleId = item.bundleId || item.bundle_id || item.bundleid || '';
        const profileName = item.profileName || item.profile || item.profile_name;
        const certificateName = item.certificateName || item.certificate || item.certificate_name;
        let lineNumber = lineMap.get(`target:${name}`) ||
            lineMap.get(`bundleid:${bundleId}`);
        if (profileName) {
            lineNumber = lineNumber || lineMap.get(`profile:${profileName}`);
        }
        if (certificateName) {
            lineNumber = lineNumber || lineMap.get(`cert:${certificateName}`);
        }
        lineNumber = lineNumber || lineMap.get('targets') || (index + 1);
        return {
            name,
            bundleId,
            profileName,
            certificateName,
            source: sourceFile,
            lineNumber
        };
    }
    static parseTargetsFromFile(filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        if (ext === 'yaml' || ext === 'yml') {
            return this.parseTargetsFromYaml(filePath);
        }
        else if (ext === 'json') {
            return this.parseTargetsFromJson(filePath);
        }
        else {
            throw new Error(`不支持的配置文件格式: ${ext}`);
        }
    }
    static parseSimpleTarget(bundleId, name) {
        return {
            name: name || bundleId,
            bundleId,
            source: 'cli',
            lineNumber: 0
        };
    }
}
exports.ConfigParser = ConfigParser;
//# sourceMappingURL=configParser.js.map