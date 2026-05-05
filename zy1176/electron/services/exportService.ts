import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { createObjectCsvWriter } from 'csv-writer';
import { getDatabase } from '../database';
import { ManifestEntry, RiskReport, CATEGORY_LABELS } from '../types';

export class ExportService {
  async exportProject(projectId: string, outputPath: string): Promise<{
    manifestPath: string;
    riskReportPath: string;
    outputPath: string;
  }> {
    const db = getDatabase();
    
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) throw new Error('Project not found');
    
    const files = db.prepare(`
      SELECT * FROM files WHERE project_id = ?
    `).all(projectId);
    
    const exportDir = path.join(outputPath, `${project.name}_脱敏交付_${format(new Date(), 'yyyyMMdd_HHmmss')}`);
    fs.ensureDirSync(exportDir);
    
    const filesDir = path.join(exportDir, '文件');
    fs.ensureDirSync(filesDir);
    
    const manifestEntries: ManifestEntry[] = [];
    
    for (const file of files) {
      const sourcePath = file.mask_output_path || file.file_path;
      const destPath = path.join(filesDir, file.file_name);
      
      if (fs.existsSync(sourcePath)) {
        fs.copySync(sourcePath, destPath);
      }
      
      manifestEntries.push({
        fileName: file.file_name,
        originalPath: file.file_path,
        outputPath: destPath,
        fileSize: file.file_size,
        fileType: file.file_type,
        sensitiveCount: file.sensitive_count,
        confirmedCount: file.confirmed_count,
        ignoredCount: file.ignored_count,
        maskingApplied: !!file.mask_output_path,
      });
    }
    
    const manifestPath = path.join(exportDir, 'DELIVERY_MANIFEST.csv');
    await this.writeManifest(manifestEntries, manifestPath);
    
    const riskReportPath = path.join(exportDir, 'RISK_REPORT.md');
    const riskReport = await this.generateRiskReport(project, files, projectId);
    fs.writeFileSync(riskReportPath, riskReport, 'utf-8');
    
    const readmePath = path.join(exportDir, 'README.txt');
    const readmeContent = this.generateReadme(project);
    fs.writeFileSync(readmePath, readmeContent, 'utf-8');
    
    const exportId = uuidv4();
    db.prepare(`
      INSERT INTO export_records (
        id, project_id, output_path, file_count, mask_count,
        manifest_path, risk_report_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      exportId, projectId, exportDir,
      files.length,
      files.filter((f: any) => f.mask_output_path).length,
      manifestPath,
      riskReportPath
    );
    
    db.prepare(`
      UPDATE projects SET status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(projectId);
    
    return {
      manifestPath,
      riskReportPath,
      outputPath: exportDir,
    };
  }

  private async writeManifest(entries: ManifestEntry[], outputPath: string): Promise<void> {
    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'fileName', title: '文件名' },
        { id: 'originalPath', title: '原始路径' },
        { id: 'outputPath', title: '输出路径' },
        { id: 'fileSize', title: '文件大小(字节)' },
        { id: 'fileType', title: '文件类型' },
        { id: 'sensitiveCount', title: '检测敏感项数' },
        { id: 'confirmedCount', title: '确认脱敏项数' },
        { id: 'ignoredCount', title: '忽略项数' },
        { id: 'maskingApplied', title: '已应用脱敏' },
      ],
      encoding: 'utf-8',
    });
    
    await csvWriter.writeRecords(entries.map(e => ({
      ...e,
      maskingApplied: e.maskingApplied ? '是' : '否',
    })));
  }

  private async generateRiskReport(
    project: any,
    files: any[],
    projectId: string
  ): Promise<string> {
    const db = getDatabase();
    
    const hitStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'ignored' THEN 1 ELSE 0 END) as ignored,
        SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as processed
      FROM sensitive_hits
      WHERE file_id IN (SELECT id FROM files WHERE project_id = ?)
    `).get(projectId);
    
    const categoryBreakdown: Record<string, number> = {};
    const categoryRows = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM sensitive_hits
      WHERE file_id IN (SELECT id FROM files WHERE project_id = ?)
      GROUP BY category
    `).all(projectId);
    
    for (const row of categoryRows) {
      const label = CATEGORY_LABELS[row.category as keyof typeof CATEGORY_LABELS] || row.category;
      categoryBreakdown[label] = row.count;
    }
    
    const fileDetails: RiskReport['fileDetails'] = [];
    for (const file of files) {
      const fileCategories = db.prepare(`
        SELECT DISTINCT category
        FROM sensitive_hits
        WHERE file_id = ?
      `).all(file.id);
      
      fileDetails.push({
        fileName: file.file_name,
        sensitiveCount: file.sensitive_count,
        confirmedCount: file.confirmed_count,
        ignoredCount: file.ignored_count,
        categories: fileCategories.map((c: any) => 
          CATEGORY_LABELS[c.category as keyof typeof CATEGORY_LABELS] || c.category
        ),
      });
    }
    
    const filesWithSensitive = files.filter((f: any) => f.sensitive_count > 0).length;
    
    const report: RiskReport = {
      projectName: project.name,
      exportTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      totalFiles: files.length,
      filesWithSensitiveData: filesWithSensitive,
      totalSensitiveHits: hitStats.total || 0,
      confirmedHits: hitStats.confirmed || 0,
      ignoredHits: hitStats.ignored || 0,
      processedHits: hitStats.processed || 0,
      categoryBreakdown,
      fileDetails,
    };
    
    return this.formatRiskReport(report);
  }

  private formatRiskReport(report: RiskReport): string {
    let markdown = `# 敏感信息风险评估报告

## 项目基本信息
- **项目名称**: ${report.projectName}
- **导出时间**: ${report.exportTime}

---

## 风险摘要

| 指标 | 数量 |
|------|------|
| 总文件数 | ${report.totalFiles} |
| 含敏感信息文件数 | ${report.filesWithSensitiveData} |
| 检测到的敏感项总数 | ${report.totalSensitiveHits} |
| 已确认脱敏项 | ${report.confirmedHits} |
| 已忽略项 | ${report.ignoredHits} |
| 已处理项 | ${report.processedHits} |

---

## 敏感信息分类统计

`;
    
    if (Object.keys(report.categoryBreakdown).length > 0) {
      markdown += `| 信息类别 | 数量 |\n|----------|------|\n`;
      for (const [category, count] of Object.entries(report.categoryBreakdown)) {
        markdown += `| ${category} | ${count} |\n`;
      }
    } else {
      markdown += `本项目未检测到敏感信息。\n`;
    }
    
    markdown += `

---

## 文件详情

`;
    
    if (report.fileDetails.length > 0) {
      markdown += `| 文件名 | 检测敏感项 | 确认脱敏 | 忽略 | 敏感类别 |\n`;
      markdown += `|--------|-----------|---------|------|----------|\n`;
      
      for (const detail of report.fileDetails) {
        const categories = detail.categories.length > 0 
          ? detail.categories.join(', ') 
          : '无';
        
        markdown += `| ${detail.fileName} | ${detail.sensitiveCount} | ${detail.confirmedCount} | ${detail.ignoredCount} | ${categories} |\n`;
      }
    }
    
    markdown += `

---

## 说明

1. **已确认脱敏**：用户确认需要进行脱敏处理的敏感信息项
2. **已忽略**：用户判断为误报或无需脱敏的项
3. **已处理**：已经应用了脱敏替换的项

### 脱敏规则说明

- **联系方式**：手机号、邮箱、QQ、微信等
- **身份信息**：身份证号、姓名、车牌号等
- **组织机构**：公司名称、机构名称等
- **金融信息**：银行卡号、账户信息等
- **地理位置**：地址信息等

---

*本报告由 DataMask Desktop 自动生成*
`;
    
    return markdown;
  }

  private generateReadme(project: any): string {
    return `DataMask Desktop - 交付包说明
================================

项目名称: ${project.name}
生成时间: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}

目录结构
--------

.
├── 文件/                    # 所有交付文件（已脱敏）
├── DELIVERY_MANIFEST.csv    # 交付清单
├── RISK_REPORT.md           # 风险评估报告
└── README.txt               # 本文件

说明
----

1. 文件目录包含所有经过脱敏处理的交付文件
2. DELIVERY_MANIFEST.csv 包含每个文件的详细信息
3. RISK_REPORT.md 包含敏感信息检测和处理的详细报告

注意事项
--------

- 所有敏感信息已根据您的确认进行了脱敏替换
- 原始敏感信息已被替换为占位符（如：[联系方式]、138****5678 等）
- 如有任何疑问，请联系数据安全负责人

--
DataMask Desktop v1.0.0
`;
  }
}
