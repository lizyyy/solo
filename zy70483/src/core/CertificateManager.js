const chalk = require('chalk');
const Table = require('cli-table3');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class CertificateManager {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.certsFile = path.join(this.dataDir, 'certificates.json');
    this.failedFile = path.join(this.dataDir, 'failed-items.json');
    this.ensureDataDir();
    this.certificates = this.loadCertificates();
    this.failedItems = this.loadFailedItems();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  loadCertificates() {
    if (fs.existsSync(this.certsFile)) {
      return JSON.parse(fs.readFileSync(this.certsFile, 'utf8'));
    }
    return this.getDemoCertificates();
  }

  saveCertificates() {
    fs.writeFileSync(this.certsFile, JSON.stringify(this.certificates, null, 2));
  }

  loadFailedItems() {
    if (fs.existsSync(this.failedFile)) {
      return JSON.parse(fs.readFileSync(this.failedFile, 'utf8'));
    }
    return [];
  }

  saveFailedItems() {
    fs.writeFileSync(this.failedFile, JSON.stringify(this.failedItems, null, 2));
  }

  getDemoCertificates() {
    const batchId = uuidv4().substring(0, 8);
    const now = new Date().toISOString();
    
    return [
      {
        id: uuidv4(),
        batchId: batchId,
        name: '服务器证书-001',
        operator: 'admin',
        issueDate: now,
        status: 'issued',
        riskType: 'low',
        hasEvidence: true,
        evidence: '审批流#2024001',
        ruleVersion: 'v1.0',
        remark: '生产环境服务器证书'
      },
      {
        id: uuidv4(),
        batchId: batchId,
        name: 'API网关证书-002',
        operator: 'operator1',
        issueDate: now,
        status: 'issued',
        riskType: 'medium',
        hasEvidence: true,
        evidence: '审批流#2024002',
        ruleVersion: 'v1.0',
        remark: 'API网关HTTPS证书'
      },
      {
        id: uuidv4(),
        batchId: batchId,
        name: '回滚测试证书-NOEVIDENCE',
        operator: 'operator2',
        issueDate: now,
        status: 'issued',
        riskType: 'high',
        hasEvidence: false,
        evidence: null,
        ruleVersion: 'v1.0',
        remark: '专门用于回滚复核测试，无审批证据'
      },
      {
        id: uuidv4(),
        batchId: uuidv4().substring(0, 8),
        name: '数据库证书-003',
        operator: 'dba',
        issueDate: now,
        status: 'issued',
        riskType: 'high',
        hasEvidence: true,
        evidence: '审批流#2024003',
        ruleVersion: 'v1.0',
        remark: '数据库连接加密证书'
      }
    ];
  }

  issueCertificate(options) {
    if (options.demo) {
      this.certificates = this.getDemoCertificates();
      this.saveCertificates();
      return {
        success: true,
        count: this.certificates.length,
        message: '演示数据已加载',
        batchIds: [...new Set(this.certificates.map(c => c.batchId))]
      };
    }

    const cert = {
      id: uuidv4(),
      batchId: uuidv4().substring(0, 8),
      name: options.name || `证书-${Date.now()}`,
      operator: options.operator || 'system',
      issueDate: new Date().toISOString(),
      status: 'issued',
      riskType: options.riskType || 'medium',
      hasEvidence: options.hasEvidence !== false,
      evidence: options.evidence || null,
      ruleVersion: 'v1.0',
      remark: options.remark || ''
    };

    this.certificates.push(cert);
    this.saveCertificates();

    return {
      success: true,
      certificate: cert,
      message: '证书签发成功'
    };
  }

  generateRollbackCandidates(options) {
    let candidates = [...this.certificates];

    if (options.batch) {
      candidates = candidates.filter(c => c.batchId === options.batch);
    }

    if (options.type) {
      candidates = candidates.filter(c => c.remark.includes(options.type));
    }

    candidates = candidates.filter(c => c.status === 'issued');

    const candidatesWithRisk = candidates.map(c => ({
      ...c,
      rollbackRisk: this.calculateRollbackRisk(c)
    }));

    return {
      total: candidatesWithRisk.length,
      candidates: candidatesWithRisk,
      highRiskCount: candidatesWithRisk.filter(c => c.rollbackRisk === 'high').length,
      noEvidenceCount: candidatesWithRisk.filter(c => !c.hasEvidence).length
    };
  }

  calculateRollbackRisk(cert) {
    if (!cert.hasEvidence) return 'high';
    if (cert.riskType === 'high') return 'high';
    if (cert.riskType === 'medium') return 'medium';
    return 'low';
  }

  printCandidates(candidates) {
    console.log(chalk.yellow(`📋 回滚候选清单 (共 ${candidates.total} 项)`));
    console.log(chalk.red(`   ⚠️  高风险: ${candidates.highRiskCount} 项`));
    console.log(chalk.red(`   ❌ 无证据: ${candidates.noEvidenceCount} 项\n`));

    const table = new Table({
      head: ['ID', '证书名称', '批次', '操作者', '风险', '有证据', '回滚风险'],
      colWidths: [10, 25, 12, 12, 10, 10, 12]
    });

    candidates.candidates.forEach(c => {
      table.push([
        c.id.substring(0, 8),
        c.name,
        c.batchId,
        c.operator,
        c.riskType,
        c.hasEvidence ? '是' : chalk.red('否'),
        c.rollbackRisk === 'high' ? chalk.red('高') : 
        c.rollbackRisk === 'medium' ? chalk.yellow('中') : chalk.green('低')
      ]);
    });

    console.log(table.toString());
    console.log(chalk.yellow('\n⚠️  请确认上述清单无误后再执行回滚操作\n'));
  }

  executeRollback(candidates) {
    const success = [];
    const failed = [];

    candidates.candidates.forEach(cert => {
      try {
        if (!cert.hasEvidence) {
          throw new Error('无审批证据，无法回滚');
        }

        const index = this.certificates.findIndex(c => c.id === cert.id);
        if (index !== -1) {
          this.certificates[index].status = 'rolled_back';
          this.certificates[index].rollbackDate = new Date().toISOString();
          success.push({
            id: cert.id,
            name: cert.name,
            batchId: cert.batchId
          });
        }
      } catch (error) {
        const failedItem = {
          id: cert.id,
          name: cert.name,
          batchId: cert.batchId,
          error: error.message,
          failedAt: new Date().toISOString(),
          operator: cert.operator,
          hasEvidence: cert.hasEvidence,
          riskType: cert.riskType
        };
        failed.push(failedItem);
        this.failedItems.push(failedItem);
      }
    });

    this.saveCertificates();
    this.saveFailedItems();

    return {
      success: true,
      successCount: success.length,
      failedCount: failed.length,
      successItems: success,
      failedItems: failed,
      message: `回滚完成: 成功 ${success.length} 项, 失败 ${failed.length} 项`
    };
  }

  printRollbackResult(result) {
    console.log(chalk.green(`✅ ${result.message}\n`));

    if (result.failedCount > 0) {
      console.log(chalk.red('❌ 失败项已保存，供后续处理:\n'));
      const table = new Table({
        head: ['证书名称', '批次', '操作者', '失败原因', '无证据'],
        colWidths: [25, 12, 12, 25, 10]
      });

      result.failedItems.forEach(item => {
        table.push([
          item.name,
          item.batchId,
          item.operator,
          item.error,
          item.hasEvidence ? '否' : chalk.red('是')
        ]);
      });

      console.log(table.toString());
    }
  }

  printResult(result) {
    if (!result.success) {
      console.log(chalk.red('❌ 操作失败:'), result.message);
      return;
    }

    console.log(chalk.green(`✅ ${result.message}\n`));

    if (result.batchIds) {
      console.log(chalk.blue('涉及批次:'), result.batchIds.join(', '));
      console.log(chalk.blue('证书数量:'), result.count);
    }

    if (result.certificate) {
      console.log(chalk.blue('证书名称:'), result.certificate.name);
      console.log(chalk.blue('批次ID:'), result.certificate.batchId);
      console.log(chalk.blue('操作者:'), result.certificate.operator);
      console.log(chalk.blue('风险类型:'), result.certificate.riskType);
    }
  }
}

module.exports = CertificateManager;
