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
exports.NginxParser = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class NginxParser {
    constructor() {
        this.parseErrors = [];
    }
    parseDirectory(dirPath) {
        this.parseErrors = [];
        const serverBlocks = [];
        if (!fs.existsSync(dirPath)) {
            throw new Error(`目录不存在: ${dirPath}`);
        }
        const nginxFiles = this.findAllNginxFiles(dirPath);
        for (const file of nginxFiles) {
            try {
                const blocks = this.parseFile(file);
                serverBlocks.push(...blocks);
            }
            catch (error) {
                this.parseErrors.push({
                    file,
                    line: 0,
                    content: '',
                    reason: `文件解析失败: ${error instanceof Error ? error.message : String(error)}`
                });
            }
        }
        return { serverBlocks, errors: this.parseErrors };
    }
    findAllNginxFiles(dirPath) {
        const files = [];
        const scan = (dir) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    scan(fullPath);
                }
                else if (this.isNginxConfigFile(entry.name)) {
                    files.push(fullPath);
                }
            }
        };
        scan(dirPath);
        return files;
    }
    isNginxConfigFile(filename) {
        const ext = path.extname(filename);
        const name = path.basename(filename);
        return ext === '.conf' || name === 'nginx.conf' || !ext;
    }
    parseFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const serverBlocks = [];
        let i = 0;
        while (i < lines.length) {
            const line = lines[i].trim();
            if (line.startsWith('server') && line.includes('{')) {
                const block = this.extractServerBlock(lines, i, filePath);
                if (block) {
                    serverBlocks.push(block);
                }
            }
            i++;
        }
        return serverBlocks;
    }
    extractServerBlock(lines, startLine, filePath) {
        const blockLines = [];
        let braceDepth = 0;
        let i = startLine;
        let foundServerBlock = false;
        while (i < lines.length) {
            const line = lines[i];
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('#') || trimmedLine === '') {
                i++;
                continue;
            }
            if (trimmedLine.startsWith('server') && trimmedLine.includes('{')) {
                foundServerBlock = true;
                braceDepth = this.countBraces(trimmedLine);
                blockLines.push(line);
                i++;
                continue;
            }
            if (foundServerBlock) {
                blockLines.push(line);
                braceDepth += this.countBraces(trimmedLine);
                if (braceDepth === 0) {
                    break;
                }
            }
            i++;
        }
        if (!foundServerBlock || blockLines.length === 0) {
            return null;
        }
        return this.parseServerBlockContent(blockLines, startLine + 1, filePath);
    }
    countBraces(line) {
        let count = 0;
        for (const char of line) {
            if (char === '{')
                count++;
            if (char === '}')
                count--;
        }
        return count;
    }
    parseServerBlockContent(blockLines, startLine, filePath) {
        const serverBlock = {
            file: filePath,
            line: startLine,
            serverNames: [],
            listen: [],
            rawContent: blockLines.join('\n')
        };
        let inLocationBlock = false;
        let locationBraceDepth = 0;
        for (let i = 0; i < blockLines.length; i++) {
            const line = blockLines[i];
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('#') || trimmedLine === '') {
                continue;
            }
            if (trimmedLine.startsWith('location')) {
                inLocationBlock = true;
                locationBraceDepth = this.countBraces(trimmedLine);
                continue;
            }
            if (inLocationBlock) {
                locationBraceDepth += this.countBraces(trimmedLine);
                if (locationBraceDepth <= 0) {
                    inLocationBlock = false;
                }
                continue;
            }
            try {
                if (trimmedLine.startsWith('server_name')) {
                    const names = this.parseServerName(trimmedLine);
                    serverBlock.serverNames.push(...names);
                }
                else if (trimmedLine.startsWith('ssl_certificate')) {
                    if (trimmedLine.startsWith('ssl_certificate_key')) {
                        serverBlock.sslCertificateKey = this.parseCertPath(trimmedLine);
                    }
                    else {
                        serverBlock.sslCertificate = this.parseCertPath(trimmedLine);
                    }
                }
                else if (trimmedLine.startsWith('listen')) {
                    const listen = this.parseListen(trimmedLine);
                    if (listen) {
                        serverBlock.listen.push(listen);
                    }
                }
            }
            catch (error) {
                this.parseErrors.push({
                    file: filePath,
                    line: startLine + i,
                    content: trimmedLine,
                    reason: `解析失败: ${error instanceof Error ? error.message : String(error)}`
                });
            }
        }
        if (serverBlock.serverNames.length === 0 && serverBlock.listen.length === 0) {
            this.parseErrors.push({
                file: filePath,
                line: startLine,
                content: blockLines.slice(0, 3).join('\n'),
                reason: '无法识别的 server 块格式'
            });
            return null;
        }
        return serverBlock;
    }
    parseServerName(line) {
        const match = line.match(/server_name\s+(.+?);/);
        if (!match) {
            throw new Error('无效的 server_name 格式');
        }
        return match[1]
            .split(/\s+/)
            .map(n => n.trim())
            .filter(n => n && n !== '_')
            .map(n => n.replace(/^\*\./, ''));
    }
    parseCertPath(line) {
        const match = line.match(/ssl_certificate(?:_key)?\s+(.+?);/);
        if (!match) {
            throw new Error('无效的 ssl_certificate 格式');
        }
        return match[1].trim();
    }
    parseListen(line) {
        const match = line.match(/listen\s+(.+?);/);
        if (!match) {
            return null;
        }
        return match[1].trim();
    }
}
exports.NginxParser = NginxParser;
