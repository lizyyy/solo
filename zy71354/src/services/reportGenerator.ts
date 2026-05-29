import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import {
  installationDao,
  materialDao,
  signatureDao,
  riskCheckDao,
  versionHistoryDao,
} from '../database/dao';
import type { Installation, RiskCheck, Signature } from '../types';

export class ReportGenerator {
  private reportsDir: string;

  constructor() {
    this.reportsDir = path.join(process.cwd(), 'data', 'reports');
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  async generatePDF(installationId: string): Promise<string> {
    const installation = await installationDao.getById(installationId);
    if (!installation) {
      throw new Error(`Installation ${installationId} not found`);
    }

    const materials = await materialDao.getByInstallationId(installationId);
    const signatures = await signatureDao.getByInstallationId(installationId);
    const riskChecks = await riskCheckDao.getByInstallationId(installationId);
    const history = await versionHistoryDao.getByInstallationId(installationId);

    const reportPath = path.join(
      this.reportsDir,
      `risk-report-${installationId}-${Date.now()}.pdf`
    );

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
      });

      const stream = fs.createWriteStream(reportPath);
      doc.pipe(stream);

      this.renderHeader(doc, installation);
      this.renderInstallationInfo(doc, installation);
      this.renderRiskSummary(doc, riskChecks);
      this.renderRiskDetails(doc, riskChecks);
      this.renderMaterials(doc, materials);
      this.renderSignatures(doc, signatures);
      this.renderVersionHistory(doc, history);
      this.renderFooter(doc);

      doc.end();

      stream.on('finish', () => resolve(reportPath));
      stream.on('error', reject);
    });
  }

  private renderHeader(doc: PDFKit.PDFDocument, installation: Installation) {
    doc
      .fontSize(20)
      .fillColor('#1a365d')
      .text('雕塑安装风险评估报告', { align: 'center' })
      .moveDown();

    doc
      .fontSize(12)
      .fillColor('#4a5568')
      .text(`项目编号: ${installation.id}`, { align: 'center' })
      .moveDown(2);

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e2e8f0').moveDown(2);
  }

  private renderInstallationInfo(doc: PDFKit.PDFDocument, installation: Installation) {
    doc.fontSize(14).fillColor('#2d3748').text('一、安装基本信息').moveDown();

    const statusColors: Record<string, string> = {
      draft: '#f6ad55',
      pending: '#4299e1',
      risk_detected: '#fc8181',
      approved: '#68d391',
      completed: '#68d391',
    };

    const statusLabels: Record<string, string> = {
      draft: '草稿',
      pending: '待审核',
      risk_detected: '发现风险',
      approved: '已批准',
      completed: '已完成',
    };

    doc
      .fontSize(10)
      .fillColor('#4a5568')
      .text(`项目名称: ${installation.projectName}`)
      .text(`雕塑名称: ${installation.sculptureName}`)
      .text(`雕塑尺寸: ${installation.dimensions.height}m × ${installation.dimensions.width}m × ${installation.dimensions.depth}m`)
      .text(`雕塑重量: ${installation.dimensions.weight} kg`)
      .text(`计划安装日期: ${installation.plannedInstallationDate}`)
      .text(`实际安装日期: ${installation.actualInstallationDate || '未安装'}`)
      .fillColor(statusColors[installation.status] || '#4a5568')
      .text(`当前状态: ${statusLabels[installation.status]}`)
      .fillColor('#4a5568')
      .text(`版本号: v${installation.version}`)
      .moveDown(2);
  }

  private renderRiskSummary(doc: PDFKit.PDFDocument, checks: RiskCheck[]) {
    doc.fontSize(14).fillColor('#2d3748').text('二、风险评估摘要').moveDown();

    const stats = {
      total: checks.length,
      safe: checks.filter((c) => c.level === 'safe').length,
      warning: checks.filter((c) => c.level === 'warning').length,
      critical: checks.filter((c) => c.level === 'critical').length,
    };

    let overallLevel = '安全';
    let overallColor = '#68d391';
    if (stats.critical > 0) {
      overallLevel = '高风险';
      overallColor = '#fc8181';
    } else if (stats.warning > 0) {
      overallLevel = '中风险';
      overallColor = '#f6ad55';
    }

    doc
      .fontSize(12)
      .fillColor(overallColor)
      .text(`整体风险等级: ${overallLevel}`, { underline: true })
      .moveDown();

    doc
      .fontSize(10)
      .fillColor('#4a5568')
      .text(`检查项总数: ${stats.total}`)
      .fillColor('#68d391')
      .text(`通过: ${stats.safe}`)
      .fillColor('#f6ad55')
      .text(`警告: ${stats.warning}`)
      .fillColor('#fc8181')
      .text(`严重: ${stats.critical}`)
      .fillColor('#4a5568')
      .moveDown(2);
  }

  private renderRiskDetails(doc: PDFKit.PDFDocument, checks: RiskCheck[]) {
    doc.fontSize(14).fillColor('#2d3748').text('三、风险检查明细').moveDown();

    const typeLabels: Record<string, string> = {
      lifting_point_missing: '吊点检查',
      wind_load_exceed: '风载检查',
      signature_late: '签字时间检查',
    };

    const levelColors: Record<string, string> = {
      safe: '#68d391',
      warning: '#f6ad55',
      critical: '#fc8181',
    };

    const levelLabels: Record<string, string> = {
      safe: '通过',
      warning: '警告',
      critical: '严重',
    };

    checks.forEach((check, index) => {
      doc
        .fontSize(11)
        .fillColor('#2d3748')
        .text(`${index + 1}. ${typeLabels[check.type] || check.type}`);

      doc
        .fontSize(10)
        .fillColor(levelColors[check.level])
        .text(`  结果: ${levelLabels[check.level]}`)
        .fillColor('#4a5568')
        .text(`  描述: ${check.description}`)
        .text(`  详情说明: ${check.details.suggestion || '无'}`)
        .text(`  检查时间: ${new Date(check.checkedAt).toLocaleString('zh-CN')}`);

      if (check.details.reason) {
        doc.text(`  原因代码: ${check.details.reason}`);
      }

      doc.moveDown();
    });

    doc.moveDown();
  }

  private renderMaterials(doc: PDFKit.PDFDocument, materials: any[]) {
    doc.fontSize(14).fillColor('#2d3748').text('四、上传材料清单').moveDown();

    const typeLabels: Record<string, string> = {
      base_drawing: '底座图',
      lifting_plan: '吊装计划',
      wind_load_params: '风载参数',
      on_site_signature: '现场签字',
      risk_report: '风险报告',
    };

    if (materials.length === 0) {
      doc.fontSize(10).fillColor('#718096').text('暂无上传材料').moveDown(2);
      return;
    }

    materials.forEach((mat, index) => {
      doc
        .fontSize(10)
        .fillColor('#4a5568')
        .text(
          `${index + 1}. [${typeLabels[mat.type] || mat.type}] ${mat.name} (v${mat.version})`
        )
        .text(`   上传时间: ${new Date(mat.uploadedAt).toLocaleString('zh-CN')}`);
    });

    doc.moveDown(2);
  }

  private renderSignatures(doc: PDFKit.PDFDocument, signatures: Signature[]) {
    doc.fontSize(14).fillColor('#2d3748').text('五、签字留痕').moveDown();

    if (signatures.length === 0) {
      doc.fontSize(10).fillColor('#718096').text('暂无签字记录').moveDown(2);
      return;
    }

    signatures.forEach((sig, index) => {
      doc
        .fontSize(10)
        .fillColor('#4a5568')
        .text(`${index + 1}. ${sig.signerName} (${sig.signerRole})`)
        .text(`   签字日期: ${sig.signatureDate}`)
        .text(`   签字时间: ${new Date(sig.signedAt).toLocaleString('zh-CN')}`);
    });

    doc.moveDown(2);
  }

  private renderVersionHistory(doc: PDFKit.PDFDocument, history: any[]) {
    doc.fontSize(14).fillColor('#2d3748').text('六、版本历史').moveDown();

    if (history.length === 0) {
      doc.fontSize(10).fillColor('#718096').text('暂无版本记录').moveDown(2);
      return;
    }

    history.forEach((h, index) => {
      doc
        .fontSize(10)
        .fillColor('#4a5568')
        .text(`${index + 1}. v${h.version} - ${h.changeType}`)
        .text(`   操作人: ${h.changedBy}`)
        .text(`   时间: ${new Date(h.changedAt).toLocaleString('zh-CN')}`);
    });

    doc.moveDown(2);
  }

  private renderFooter(doc: PDFKit.PDFDocument) {
    const pageCount = (doc as any)._pageCount;
    doc
      .fontSize(8)
      .fillColor('#a0aec0')
      .text(
        `本报告由雕塑安装风险单系统自动生成 | 生成时间: ${new Date().toLocaleString('zh-CN')}`,
        50,
        780,
        { align: 'center', width: 500 }
      );
  }
}

export const reportGenerator = new ReportGenerator();
