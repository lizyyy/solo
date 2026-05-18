const fs = require('fs');
const path = require('path');

class DataLoader {
  constructor() {
    this.nodes = [];
    this.deployLogs = [];
  }

  loadNodes(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      
      this.nodes = (data.nodes || []).map(node => ({
        ...node,
        nodeId: node.nodeId || node.id || node.name,
        nodeName: node.nodeName || node.name,
        environment: node.environment || 'unknown',
        domains: node.domains || [],
        certFingerprint: node.certFingerprint,
        certSerial: node.certSerial,
        deployedAt: node.deployedAt ? new Date(node.deployedAt) : null,
        isLegacy: node.isLegacy || false,
        status: node.status || 'active'
      }));

      return {
        success: true,
        filePath,
        nodeCount: this.nodes.length,
        domainsCount: this.nodes.reduce((sum, n) => sum + n.domains.length, 0),
        legacyCount: this.nodes.filter(n => n.isLegacy).length
      };
    } catch (e) {
      return {
        success: false,
        error: `节点列表加载失败: ${e.message}`,
        filePath
      };
    }
  }

  loadDeployLogs(dirPath) {
    const results = [];
    const allLogs = [];

    try {
      const files = fs.readdirSync(dirPath);
      
      files.forEach(file => {
        if (!/\.json$/i.test(file)) return;
        
        const filePath = path.join(dirPath, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const logs = JSON.parse(content);
          
          const parsedLogs = (Array.isArray(logs) ? logs : [logs]).map(log => ({
            ...log,
            logFile: file,
            deployedAt: log.deployedAt ? new Date(log.deployedAt) : null,
            success: log.success !== undefined ? log.success : true
          }));
          
          allLogs.push(...parsedLogs);
          
          results.push({
            success: true,
            filePath,
            logCount: parsedLogs.length
          });
        } catch (e) {
          results.push({
            success: false,
            error: `日志文件解析失败: ${e.message}`,
            filePath
          });
        }
      });

      this.deployLogs = allLogs.sort((a, b) => {
        if (!a.deployedAt) return 1;
        if (!b.deployedAt) return -1;
        return b.deployedAt - a.deployedAt;
      });

      return {
        success: true,
        dirPath,
        totalLogs: this.deployLogs.length,
        successfulDeploys: this.deployLogs.filter(l => l.success).length,
        fileResults: results
      };
    } catch (e) {
      return {
        success: false,
        error: `部署日志目录读取失败: ${e.message}`,
        dirPath
      };
    }
  }

  getLatestDeployForNode(nodeId, domain) {
    return this.deployLogs.find(log => 
      log.nodeId === nodeId && 
      log.domains?.includes(domain)
    );
  }

  getAllNodes() {
    return this.nodes;
  }

  getActiveNodes() {
    return this.nodes.filter(n => n.status === 'active');
  }

  getLegacyNodes() {
    return this.nodes.filter(n => n.isLegacy);
  }

  getAllDomains() {
    const domains = new Set();
    this.nodes.forEach(node => {
      node.domains.forEach(d => domains.add(d));
    });
    return Array.from(domains);
  }

  getNodesForDomain(domain) {
    return this.nodes.filter(node => node.domains.includes(domain));
  }
}

module.exports = DataLoader;
