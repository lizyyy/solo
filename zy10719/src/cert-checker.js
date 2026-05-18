const CertParser = require('./cert-parser');
const DataLoader = require('./data-loader');

class CertChecker {
  constructor() {
    this.certParser = new CertParser();
    this.dataLoader = new DataLoader();
    this.results = {
      summary: {},
      domainChecks: [],
      nodeDifferences: [],
      issues: []
    };
  }

  loadData(certsDir, nodesFile, logsDir) {
    const certResults = this.certParser.loadCertificatesFromDir(certsDir);
    const nodesResult = this.dataLoader.loadNodes(nodesFile);
    const logsResult = this.dataLoader.loadDeployLogs(logsDir);

    this.results.summary = {
      certFiles: certResults.length,
      validCerts: certResults.filter(r => r.success).length,
      totalDomains: this.certParser.getAllCerts().length,
      totalNodes: this.dataLoader.getAllNodes().length,
      activeNodes: this.dataLoader.getActiveNodes().length,
      legacyNodes: this.dataLoader.getLegacyNodes().length,
      deployLogs: logsResult.totalLogs,
      successfulDeploys: logsResult.successfulDeploys
    };

    return {
      certResults,
      nodesResult,
      logsResult
    };
  }

  runChecks() {
    const domains = this.dataLoader.getAllDomains();
    const nodes = this.dataLoader.getAllNodes();

    domains.forEach(domain => {
      const domainResult = this.checkDomain(domain);
      this.results.domainChecks.push(domainResult);
    });

    nodes.forEach(node => {
      node.domains.forEach(domain => {
        const diffResult = this.checkNodeCertificate(node, domain);
        if (diffResult.hasDifference) {
          this.results.nodeDifferences.push(diffResult);
        }
      });
    });

    this.summarizeIssues();

    return this.results;
  }

  checkDomain(domain) {
    const result = {
      domain,
      hasCert: false,
      certs: [],
      isWildcardMatch: false,
      wildcardSource: null,
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: null,
      chainComplete: true,
      chainLength: 0,
      nodes: this.dataLoader.getNodesForDomain(domain).map(n => ({
        nodeId: n.nodeId,
        nodeName: n.nodeName,
        isLegacy: n.isLegacy,
        environment: n.environment
      }))
    };

    const certs = this.certParser.findCertForDomain(domain);
    
    if (certs && certs.length > 0) {
      result.hasCert = true;
      result.certs = certs.map(c => ({
        sourceFile: c.sourceFile,
        commonName: c.certInfo.commonName,
        validFrom: c.certInfo.validFrom,
        validTo: c.certInfo.validTo,
        daysRemaining: c.certInfo.daysRemaining,
        fingerprintSha256: c.certInfo.fingerprintSha256,
        isWildcard: c.certInfo.isWildcard,
        chainComplete: c.chainInfo.chainComplete,
        chainLength: c.chainInfo.chainLength
      }));

      const latestCert = certs[0].certInfo;
      const chainInfo = certs[0].chainInfo;
      
      result.isExpired = latestCert.isExpired;
      result.isExpiringSoon = latestCert.isExpiringSoon;
      result.daysRemaining = latestCert.daysRemaining;
      result.chainComplete = chainInfo.chainComplete;
      result.chainLength = chainInfo.chainLength;

      if (certs[0].domain.startsWith('*.')) {
        result.isWildcardMatch = true;
        result.wildcardSource = certs[0].domain;
      }
    }

    return result;
  }

  checkNodeCertificate(node, domain) {
    const result = {
      domain,
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      environment: node.environment,
      isLegacy: node.isLegacy,
      hasDifference: false,
      differences: [],
      expectedCert: null,
      actualCert: null,
      deployHistory: null
    };

    const certs = this.certParser.findCertForDomain(domain);
    
    if (certs && certs.length > 0) {
      const expectedCert = certs[0].certInfo;
      result.expectedCert = {
        fingerprint: expectedCert.fingerprintSha256,
        serial: expectedCert.serialNumber,
        validTo: expectedCert.validTo,
        commonName: expectedCert.commonName,
        sourceFile: certs[0].sourceFile
      };

      if (node.certFingerprint || node.certSerial) {
        result.actualCert = {
          fingerprint: node.certFingerprint,
          serial: node.certSerial,
          deployedAt: node.deployedAt
        };

        if (node.certFingerprint && node.certFingerprint !== expectedCert.fingerprintSha256) {
          result.hasDifference = true;
          result.differences.push({
            type: 'fingerprint_mismatch',
            field: '证书指纹',
            expected: expectedCert.fingerprintSha256,
            actual: node.certFingerprint,
            severity: node.isLegacy ? 'warning' : 'error'
          });
        }

        if (node.certSerial && node.certSerial.toLowerCase() !== expectedCert.serialNumber.toLowerCase()) {
          result.hasDifference = true;
          result.differences.push({
            type: 'serial_mismatch',
            field: '证书序列号',
            expected: expectedCert.serialNumber.toUpperCase(),
            actual: node.certSerial,
            severity: node.isLegacy ? 'warning' : 'error'
          });
        }
      } else {
        result.hasDifference = true;
        result.differences.push({
          type: 'no_cert_info',
          field: '节点证书信息',
          expected: '有证书指纹/序列号',
          actual: '无证书信息',
          severity: node.isLegacy ? 'warning' : 'error'
        });
      }
    } else {
      result.hasDifference = true;
      result.differences.push({
        type: 'no_cert_found',
        field: '证书文件',
        expected: `找到 ${domain} 的证书`,
        actual: '未找到匹配证书',
        severity: 'error'
      });
    }

    const latestDeploy = this.dataLoader.getLatestDeployForNode(node.nodeId, domain);
    if (latestDeploy) {
      result.deployHistory = {
        latestDeployAt: latestDeploy.deployedAt,
        latestDeploySuccess: latestDeploy.success,
        deployLog: latestDeploy.logFile
      };
    }

    return result;
  }

  summarizeIssues() {
    const issues = [];

    this.results.domainChecks.forEach(check => {
      if (!check.hasCert) {
        issues.push({
          type: 'missing_cert',
          domain: check.domain,
          message: `域名 ${check.domain} 未找到匹配证书`,
          severity: 'error',
          affectedNodes: check.nodes.length
        });
      } else {
        if (check.isExpired) {
          issues.push({
            type: 'cert_expired',
            domain: check.domain,
            message: `域名 ${check.domain} 证书已过期`,
            severity: 'critical',
            daysRemaining: check.daysRemaining,
            affectedNodes: check.nodes.length
          });
        } else if (check.isExpiringSoon) {
          issues.push({
            type: 'cert_expiring_soon',
            domain: check.domain,
            message: `域名 ${check.domain} 证书将在 ${check.daysRemaining} 天后过期`,
            severity: 'warning',
            daysRemaining: check.daysRemaining,
            affectedNodes: check.nodes.length
          });
        }

        if (!check.chainComplete) {
          issues.push({
            type: 'incomplete_chain',
            domain: check.domain,
            message: `域名 ${check.domain} 证书链不完整`,
            severity: 'warning',
            chainLength: check.chainLength,
            affectedNodes: check.nodes.length
          });
        }

        if (check.isWildcardMatch) {
          issues.push({
            type: 'wildcard_match',
            domain: check.domain,
            message: `域名 ${check.domain} 使用通配符证书 ${check.wildcardSource}`,
            severity: 'info',
            wildcardSource: check.wildcardSource,
            affectedNodes: check.nodes.length
          });
        }
      }
    });

    this.results.nodeDifferences.forEach(diff => {
      diff.differences.forEach(d => {
        issues.push({
          type: d.type,
          domain: diff.domain,
          nodeId: diff.nodeId,
          nodeName: diff.nodeName,
          isLegacy: diff.isLegacy,
          message: `节点 ${diff.nodeName} (${diff.domain}) ${d.field} 不一致`,
          severity: d.severity,
          field: d.field,
          expected: d.expected,
          actual: d.actual
        });
      });
    });

    const legacyNodes = this.dataLoader.getLegacyNodes();
    legacyNodes.forEach(node => {
      issues.push({
        type: 'legacy_node',
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        message: `节点 ${node.nodeName} 是旧节点，需确认证书状态`,
        severity: 'info',
        domains: node.domains
      });
    });

    this.results.issues = issues.sort((a, b) => {
      const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
      return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    });

    this.results.summary.issues = {
      total: issues.length,
      critical: issues.filter(i => i.severity === 'critical').length,
      error: issues.filter(i => i.severity === 'error').length,
      warning: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length
    };
  }

  getResults() {
    return this.results;
  }
}

module.exports = CertChecker;
