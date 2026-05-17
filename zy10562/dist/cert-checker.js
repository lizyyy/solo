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
exports.CertChecker = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
class CertChecker {
    constructor() {
        this.opensslAvailable = this.checkOpensslAvailable();
    }
    checkOpensslAvailable() {
        try {
            (0, child_process_1.execSync)('openssl version', { stdio: 'ignore' });
            return true;
        }
        catch {
            return false;
        }
    }
    checkCertificate(certPath) {
        const result = {
            path: certPath,
            exists: false,
            isValid: false,
            domains: []
        };
        if (!fs.existsSync(certPath)) {
            result.error = '证书文件不存在';
            return result;
        }
        result.exists = true;
        if (!this.opensslAvailable) {
            result.error = '未检测到 openssl，无法解析证书内容';
            return result;
        }
        try {
            const certContent = fs.readFileSync(certPath, 'utf-8');
            const certInfo = this.parseCertificate(certContent);
            Object.assign(result, certInfo);
            result.isValid = true;
            if (result.validTo) {
                const now = new Date();
                const diffTime = result.validTo.getTime() - now.getTime();
                result.daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }
        }
        catch (error) {
            result.error = `证书解析失败: ${error instanceof Error ? error.message : String(error)}`;
        }
        return result;
    }
    parseCertificate(certContent) {
        const tempFile = path.join('/tmp', `cert-${Date.now()}.pem`);
        fs.writeFileSync(tempFile, certContent);
        try {
            const result = {
                domains: []
            };
            const textOutput = (0, child_process_1.execSync)(`openssl x509 -in "${tempFile}" -text -noout`, {
                encoding: 'utf-8'
            });
            const subjectMatch = textOutput.match(/Subject:\s*(.+)/);
            if (subjectMatch) {
                result.subject = subjectMatch[1].trim();
            }
            const issuerMatch = textOutput.match(/Issuer:\s*(.+)/);
            if (issuerMatch) {
                result.issuer = issuerMatch[1].trim();
            }
            const notBeforeMatch = textOutput.match(/Not Before:\s*(.+)/);
            if (notBeforeMatch) {
                result.validFrom = this.parseOpenSSLDate(notBeforeMatch[1].trim());
            }
            const notAfterMatch = textOutput.match(/Not After\s*:\s*(.+)/);
            if (notAfterMatch) {
                result.validTo = this.parseOpenSSLDate(notAfterMatch[1].trim());
            }
            const domains = [];
            const cnMatch = result.subject?.match(/CN\s*=\s*([^,\s]+)/);
            if (cnMatch && cnMatch[1] && !cnMatch[1].startsWith('*')) {
                domains.push(cnMatch[1].replace(/^\*\./, ''));
            }
            const sanMatch = textOutput.match(/X509v3 Subject Alternative Name:[\s\S]*?DNS:([^\n]+)/);
            if (sanMatch) {
                const sanDomains = sanMatch[1]
                    .split(/,?\s*DNS:/)
                    .map(d => d.trim())
                    .filter(d => d && !d.startsWith('*'))
                    .map(d => d.replace(/^\*\./, ''));
                domains.push(...sanDomains);
            }
            result.domains = [...new Set(domains)];
            return result;
        }
        finally {
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
    }
    parseOpenSSLDate(dateStr) {
        const months = {
            Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
            Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
        };
        const match = dateStr.match(/(\w+)\s+(\d+)\s+(\d+):(\d+):(\d+)\s+(\d+)\s+GMT/);
        if (match) {
            const [, month, day, hour, minute, second, year] = match;
            return new Date(Date.UTC(parseInt(year), months[month] || 0, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second)));
        }
        return new Date(dateStr);
    }
}
exports.CertChecker = CertChecker;
