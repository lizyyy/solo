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
exports.ProvisionParser = void 0;
const fs = __importStar(require("fs"));
const plist = __importStar(require("plist"));
class ProvisionParser {
    static parse(filePath) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Profile 文件不存在: ${filePath}`);
        }
        const content = fs.readFileSync(filePath);
        const plistContent = this.extractPlistFromPKCS7(content);
        if (!plistContent) {
            throw new Error(`无法从 Profile 中提取 plist 数据: ${filePath}`);
        }
        try {
            const data = plist.parse(plistContent);
            return this.mapToMobileProvision(data, filePath);
        }
        catch (e) {
            throw new Error(`解析 Profile plist 失败: ${filePath}, 错误: ${e}`);
        }
    }
    static extractPlistFromPKCS7(content) {
        const str = content.toString('utf8');
        const start = str.indexOf('<?xml');
        const end = str.indexOf('</plist>');
        if (start === -1 || end === -1) {
            return null;
        }
        return str.substring(start, end + 8);
    }
    static mapToMobileProvision(data, filePath) {
        const applicationIdentifier = data['Entitlements']?.['application-identifier'] || '';
        const bundleId = this.extractBundleId(applicationIdentifier);
        const developerCertificates = [];
        if (Array.isArray(data['DeveloperCertificates'])) {
            data['DeveloperCertificates'].forEach((cert) => {
                developerCertificates.push(cert.toString('base64'));
            });
        }
        return {
            filePath,
            name: data['Name'] || '',
            uuid: data['UUID'] || '',
            bundleId,
            teamId: data['TeamIdentifier']?.[0] || '',
            teamName: data['TeamName'] || '',
            expirationDate: data['ExpirationDate'] ? new Date(data['ExpirationDate']) : new Date(0),
            creationDate: data['CreationDate'] ? new Date(data['CreationDate']) : new Date(0),
            applicationIdentifier,
            entitlements: data['Entitlements'] || {},
            developerCertificates,
            provisionsAllDevices: data['ProvisionsAllDevices'],
            provisionedDevices: data['ProvisionedDevices']
        };
    }
    static extractBundleId(applicationIdentifier) {
        const parts = applicationIdentifier.split('.');
        if (parts.length <= 1) {
            return applicationIdentifier;
        }
        return parts.slice(1).join('.');
    }
    static parseDirectory(directory) {
        if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
            throw new Error(`目录不存在或不是目录: ${directory}`);
        }
        const profiles = [];
        const files = fs.readdirSync(directory);
        files.forEach(file => {
            if (file.endsWith('.mobileprovision')) {
                const fullPath = `${directory}/${file}`;
                try {
                    profiles.push(this.parse(fullPath));
                }
                catch (e) {
                    console.warn(`警告: 解析 Profile 失败 ${file}: ${e}`);
                }
            }
        });
        return profiles;
    }
    static parseFiles(paths) {
        const profiles = [];
        paths.forEach(path => {
            try {
                const stat = fs.statSync(path);
                if (stat.isDirectory()) {
                    profiles.push(...this.parseDirectory(path));
                }
                else if (path.endsWith('.mobileprovision')) {
                    profiles.push(this.parse(path));
                }
            }
            catch (e) {
                console.warn(`警告: 处理路径失败 ${path}: ${e}`);
            }
        });
        return profiles;
    }
}
exports.ProvisionParser = ProvisionParser;
//# sourceMappingURL=provisionParser.js.map