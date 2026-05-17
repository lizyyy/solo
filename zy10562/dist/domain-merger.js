"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainMerger = void 0;
const cert_checker_1 = require("./cert-checker");
class DomainMerger {
    constructor() {
        this.certInfos = new Map();
        this.certChecker = new cert_checker_1.CertChecker();
    }
    mergeDomains(serverBlocks) {
        const domainMap = new Map();
        const missingReferences = [];
        const checkedCertPaths = new Set();
        for (const block of serverBlocks) {
            const hasSSL = block.sslCertificate || block.sslCertificateKey;
            const isHTTPS = block.listen.some(l => l.includes('443') || l.includes('ssl'));
            for (const domain of block.serverNames) {
                if (!domainMap.has(domain)) {
                    domainMap.set(domain, {
                        domain,
                        serverBlocks: []
                    });
                }
                const domainCert = domainMap.get(domain);
                domainCert.serverBlocks.push({
                    file: block.file,
                    line: block.line
                });
                if (block.sslCertificate && !domainCert.certPath) {
                    domainCert.certPath = block.sslCertificate;
                }
                if (block.sslCertificateKey && !domainCert.keyPath) {
                    domainCert.keyPath = block.sslCertificateKey;
                }
            }
            if (isHTTPS || hasSSL) {
                const missing = this.checkMissingCertificates(block);
                if (missing) {
                    missingReferences.push(missing);
                }
            }
        }
        for (const [, domainCert] of domainMap) {
            if (domainCert.certPath && !checkedCertPaths.has(domainCert.certPath)) {
                const certInfo = this.certChecker.checkCertificate(domainCert.certPath);
                this.certInfos.set(domainCert.certPath, certInfo);
                checkedCertPaths.add(domainCert.certPath);
                domainCert.certInfo = certInfo;
            }
            else if (domainCert.certPath) {
                domainCert.certInfo = this.certInfos.get(domainCert.certPath);
            }
        }
        return {
            domainCertMaps: Array.from(domainMap.values()),
            missingReferences,
            certInfos: this.certInfos
        };
    }
    checkMissingCertificates(block) {
        const hasCert = !!block.sslCertificate;
        const hasKey = !!block.sslCertificateKey;
        let type = null;
        if (!hasCert && !hasKey) {
            type = 'both';
        }
        else if (!hasCert) {
            type = 'cert';
        }
        else if (!hasKey) {
            type = 'key';
        }
        if (!type) {
            return null;
        }
        return {
            type,
            domain: block.serverNames[0] || 'unknown',
            serverBlock: {
                file: block.file,
                line: block.line
            }
        };
    }
    calculateSummary(domainCertMaps) {
        let expiringIn30Days = 0;
        let expiringIn7Days = 0;
        let expired = 0;
        let missingCerts = 0;
        const uniqueCerts = new Set();
        for (const domainCert of domainCertMaps) {
            if (domainCert.certPath) {
                uniqueCerts.add(domainCert.certPath);
            }
            else {
                missingCerts++;
            }
            if (domainCert.certInfo) {
                const days = domainCert.certInfo.daysUntilExpiry;
                if (days !== undefined) {
                    if (days <= 0) {
                        expired++;
                    }
                    else if (days <= 7) {
                        expiringIn7Days++;
                    }
                    else if (days <= 30) {
                        expiringIn30Days++;
                    }
                }
            }
        }
        return {
            totalDomains: domainCertMaps.length,
            totalCerts: uniqueCerts.size,
            expiringIn30Days,
            expiringIn7Days,
            expired,
            missingCerts
        };
    }
}
exports.DomainMerger = DomainMerger;
