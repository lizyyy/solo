import fs from 'fs/promises';
import path from 'path';

export class ReportGenerator {
  constructor(outputDir) {
    this.outputDir = outputDir;
  }

  async generateAll(configData, validationResult, manifest) {
    await fs.mkdir(this.outputDir, { recursive: true });

    const markdownPath = path.join(this.outputDir, 'isp_audit.md');
    await this.generateMarkdownReport(
      markdownPath,
      configData,
      validationResult,
      manifest
    );

    const csvPath = path.join(this.outputDir, 'violations.csv');
    await this.generateViolationsCsv(csvPath, validationResult);

    const manifestPath = path.join(this.outputDir, 'package_manifest.json');
    await this.writeManifest(manifestPath, manifest);

    return {
      markdownPath,
      csvPath,
      manifestPath
    };
  }

  async generateMarkdownReport(filePath, configData, validationResult, manifest) {
    const report = this.buildMarkdownContent(configData, validationResult, manifest);
    await fs.writeFile(filePath, report, 'utf-8');
  }

  buildMarkdownContent(configData, validationResult, manifest) {
    const lines = [];

    lines.push('# ISP 标定参数包审计报告');
    lines.push('');
    lines.push(`> 生成时间: ${new Date().toISOString()}`);
    lines.push('');

    lines.push('## 包健康状态');
    lines.push('');
    
    const health = manifest.package_health;
    const statusEmoji = health.status === 'HEALTHY' ? '✅' : 
                        health.status === 'CAUTION' ? '⚠️' : '❌';
    
    lines.push(`**状态**: ${statusEmoji} ${health.status}`);
    lines.push(`**分数**: ${health.score}/100`);
    lines.push(`**说明**: ${health.reason}`);
    lines.push('');

    lines.push('## 校验结果概览');
    lines.push('');
    lines.push(`- **通过**: ${validationResult.valid ? '是' : '否'}`);
    lines.push(`- **错误数**: ${validationResult.totalErrors}`);
    lines.push(`- **警告数**: ${validationResult.totalWarnings}`);
    lines.push('');

    lines.push('## 包内容概览');
    lines.push('');
    lines.push('### 机型配置');
    lines.push('');
    lines.push(`- 相机配置文件数: ${manifest.camera_profiles.count}`);
    lines.push(`- 支持机型: ${manifest.camera_profiles.profiles.map(p => p.model).join(', ')}`);
    lines.push('');

    lines.push('### 传感器模式');
    lines.push('');
    lines.push(`- 模式数量: ${manifest.sensor_modes.count}`);
    lines.push(`- 支持分辨率: ${manifest.sensor_modes.resolutions.join(', ')}`);
    lines.push('');

    lines.push('### 标定文件');
    lines.push('');
    lines.push(`- 文件数量: ${manifest.calibration_files.count}`);
    lines.push(`- 覆盖机型: ${manifest.calibration_files.models.join(', ')}`);
    lines.push('');

    if (validationResult.totalErrors > 0) {
      lines.push('## 错误详情');
      lines.push('');
      lines.push('### 必须修复的错误');
      lines.push('');
      
      for (const violation of validationResult.errors) {
        lines.push(`#### ${violation.category}`);
        lines.push('');
        lines.push(`- **级别**: ${violation.level}`);
        lines.push(`- **校验器**: ${violation.validator}`);
        lines.push(`- **描述**: ${violation.message}`);
        if (violation.context && Object.keys(violation.context).length > 0) {
          lines.push('- **上下文**:');
          for (const [key, value] of Object.entries(violation.context)) {
            const valueStr = typeof value === 'object' ? 
              JSON.stringify(value, null, 2).split('\n').map(l => `  ${l}`).join('\n') : 
              String(value);
            lines.push(`  - ${key}: ${valueStr}`);
          }
        }
        lines.push('');
      }
    }

    if (validationResult.totalWarnings > 0) {
      lines.push('## 警告详情');
      lines.push('');
      lines.push('### 建议检查的警告');
      lines.push('');
      
      for (const violation of validationResult.warnings) {
        lines.push(`#### ${violation.category}`);
        lines.push('');
        lines.push(`- **级别**: ${violation.level}`);
        lines.push(`- **校验器**: ${violation.validator}`);
        lines.push(`- **描述**: ${violation.message}`);
        if (violation.context && Object.keys(violation.context).length > 0) {
          lines.push('- **上下文**:');
          for (const [key, value] of Object.entries(violation.context)) {
            const valueStr = typeof value === 'object' ? 
              JSON.stringify(value, null, 2).split('\n').map(l => `  ${l}`).join('\n') : 
              String(value);
            lines.push(`  - ${key}: ${valueStr}`);
          }
        }
        lines.push('');
      }
    }

    lines.push('## 各校验器结果');
    lines.push('');

    const validatorNames = {
      exposureGain: '曝光/增益曲线',
      whiteBalance: '白平衡矩阵',
      lensShading: '镜头阴影表',
      model: '机型适配',
      resolution: '分辨率档位'
    };

    for (const [validatorName, result] of Object.entries(validationResult.byValidator)) {
      const displayName = validatorNames[validatorName] || validatorName;
      const errors = result.violations.filter(v => v.level === 'error').length;
      const warnings = result.violations.filter(v => v.level === 'warning').length;
      const status = result.valid ? '✅ 通过' : '❌ 失败';
      
      lines.push(`### ${displayName}`);
      lines.push('');
      lines.push(`- **状态**: ${status}`);
      lines.push(`- **错误**: ${errors}`);
      lines.push(`- **警告**: ${warnings}`);
      lines.push('');
    }

    lines.push('## 附录');
    lines.push('');
    lines.push('### 校验规则说明');
    lines.push('');
    lines.push('| 校验项 | 说明 | 级别 |');
    lines.push('|--------|------|------|');
    lines.push('| 曝光曲线单调性 | 确保曝光时间曲线严格递增 | 错误 |');
    lines.push('| 增益曲线单调性 | 确保模拟增益曲线严格递增 | 错误 |');
    lines.push('| 白平衡矩阵维度 | 确保 WB 矩阵为 3x4 维度 | 错误 |');
    lines.push('| CCM 矩阵维度 | 确保颜色校正矩阵为 3x4 维度 | 错误 |');
    lines.push('| 镜头阴影覆盖 | 确保所有分辨率有对应的 LSC 表 | 错误 |');
    lines.push('| 机型匹配 | 确保标定文件与相机配置机型一致 | 错误 |');
    lines.push('| 分辨率覆盖 | 确保所有传感器模式有标定数据 | 错误 |');
    lines.push('| 数值有效性 | 检查 NaN、Infinity 等无效数值 | 错误 |');
    lines.push('| 重复标定 | 检查同一机型是否存在多份标定 | 警告 |');
    lines.push('| 参数范围 | 检查参数是否在合理范围内 | 警告 |');
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push(`*本报告由 ISP Audit CLI v${manifest.version} 生成*`);

    return lines.join('\n');
  }

  async generateViolationsCsv(filePath, validationResult) {
    const headers = [
      'level',
      'validator',
      'category',
      'message',
      'context',
      'timestamp'
    ];

    const rows = [headers.join(',')];

    for (const violation of validationResult.violations) {
      const contextStr = violation.context ? 
        JSON.stringify(violation.context).replace(/"/g, '""') : '';
      
      const row = [
        violation.level,
        violation.validator,
        violation.category,
        `"${violation.message.replace(/"/g, '""')}"`,
        `"${contextStr}"`,
        violation.timestamp
      ];
      rows.push(row.join(','));
    }

    const csvContent = rows.join('\n');
    await fs.writeFile(filePath, csvContent, 'utf-8');
  }

  async writeManifest(filePath, manifest) {
    const content = JSON.stringify(manifest, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
  }
}
