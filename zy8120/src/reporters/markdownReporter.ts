import * as fs from 'fs';
import * as path from 'path';
import { PrecheckResult, Issue, CoverageResult } from '../types';

export class MarkdownReporter {
  static generate(result: PrecheckResult, outputDir: string): string {
    const content = this.buildContent(result);
    const outputPath = path.join(outputDir, 'report.md');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, content, 'utf-8');
    return outputPath;
  }

  private static buildContent(result: PrecheckResult): string {
    const lines: string[] = [];
    
    lines.push('# 无人机巡检影像预检报告');
    lines.push('');
    lines.push(`> 生成时间: ${result.timestamp}`);
    lines.push('');
    
    lines.push('## 概览');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 检查结果 | ${result.success ? '✅ 通过' : '❌ 发现问题'} |`);
    lines.push(`| 总问题数 | ${result.summary.totalIssues} |`);
    lines.push(`| 严重问题 | ${result.summary.criticalIssues} 🔴 |`);
    lines.push(`| 主要问题 | ${result.summary.majorIssues} 🟠 |`);
    lines.push(`| 次要问题 | ${result.summary.minorIssues} 🟡 |`);
    lines.push(`| 信息提示 | ${result.summary.infoIssues} 🔵 |`);
    lines.push('');
    
    lines.push('## 航线检查');
    lines.push('');
    lines.push(`- **任务ID**: ${result.route.missionId}`);
    lines.push(`- **总航点数**: ${result.route.totalWaypoints}`);
    lines.push(`- **已拍摄航点**: ${result.route.waypointsWithPhotos}`);
    lines.push(`- **漏拍航点**: ${result.route.missingWaypoints.length}`);
    lines.push('');
    
    if (result.route.missingWaypoints.length > 0) {
      lines.push('### 漏拍航点列表');
      lines.push('');
      lines.push('```');
      lines.push(result.route.missingWaypoints.join(', '));
      lines.push('```');
      lines.push('');
    }
    
    lines.push('## 清单检查');
    lines.push('');
    lines.push(`- **总条目数**: ${result.manifest.totalEntries}`);
    lines.push(`- **有效条目**: ${result.manifest.validEntries}`);
    lines.push(`- **重复文件**: ${result.manifest.duplicateFiles.length}`);
    lines.push(`- **缺失文件**: ${result.manifest.missingFiles.length}`);
    lines.push('');
    
    if (result.manifest.duplicateFiles.length > 0) {
      lines.push('### 重复文件');
      lines.push('');
      lines.push('```');
      lines.push(result.manifest.duplicateFiles.join(', '));
      lines.push('```');
      lines.push('');
    }
    
    if (result.manifest.missingFiles.length > 0) {
      lines.push('### 缺失文件');
      lines.push('');
      lines.push('```');
      lines.push(result.manifest.missingFiles.join(', '));
      lines.push('```');
      lines.push('');
    }
    
    lines.push('## 缺陷标注检查');
    lines.push('');
    lines.push(`- **总标注数**: ${result.defects.totalAnnotations}`);
    lines.push(`- **有效标注**: ${result.defects.validAnnotations}`);
    lines.push(`- **无效 bbox**: ${result.defects.invalidBboxes.length}`);
    lines.push('');
    
    lines.push('## 覆盖情况');
    lines.push('');
    lines.push('| 杆塔 | 状态 | 总航点 | 已覆盖 | 漏拍 | 重飞次数 |');
    lines.push('|------|------|--------|--------|------|----------|');
    
    for (const cov of result.coverage) {
      const statusEmoji = {
        fully_covered: '✅',
        partially_covered: '⚠️',
        not_covered: '❌',
      }[cov.status];
      
      lines.push(`| ${cov.towerId} | ${statusEmoji} ${cov.status.replace('_', ' ')} | ${cov.totalWaypoints} | ${cov.coveredWaypoints} | ${cov.missingWaypoints.length} | ${cov.rerunCount} |`);
    }
    lines.push('');
    
    for (const cov of result.coverage) {
      if (cov.segments.length > 0 || cov.rerunCount > 0) {
        lines.push(`### 杆塔 ${cov.towerId} 飞行片段`);
        lines.push('');
        
        for (const segment of cov.segments) {
          const rerunTag = segment.isRerun ? '🔄 重飞' : '✈️ 主飞';
          lines.push(`- **${segment.name}** (${rerunTag})`);
          lines.push(`  - 时间: ${segment.startTime} ~ ${segment.endTime}`);
          lines.push(`  - 覆盖航点: ${segment.waypointsCovered.length} 个`);
          lines.push(`  - 照片数: ${segment.photosCount}`);
        }
        lines.push('');
      }
    }
    
    lines.push('## 问题详情');
    lines.push('');
    
    const criticalIssues = result.issues.filter(i => i.severity === 'critical');
    const majorIssues = result.issues.filter(i => i.severity === 'major');
    const minorIssues = result.issues.filter(i => i.severity === 'minor');
    const infoIssues = result.issues.filter(i => i.severity === 'info');
    
    if (criticalIssues.length > 0) {
      lines.push('### 🔴 严重问题');
      lines.push('');
      for (const issue of criticalIssues) {
        lines.push(`1. **[${issue.category}]** ${issue.message}`);
        if (issue.relatedFiles && issue.relatedFiles.length > 0) {
          lines.push(`   - 相关文件: ${issue.relatedFiles.join(', ')}`);
        }
        if (issue.relatedWaypoints && issue.relatedWaypoints.length > 0) {
          lines.push(`   - 相关航点: ${issue.relatedWaypoints.join(', ')}`);
        }
        lines.push('');
      }
    }
    
    if (majorIssues.length > 0) {
      lines.push('### 🟠 主要问题');
      lines.push('');
      for (const issue of majorIssues) {
        lines.push(`1. **[${issue.category}]** ${issue.message}`);
        if (issue.relatedFiles && issue.relatedFiles.length > 0) {
          lines.push(`   - 相关文件: ${issue.relatedFiles.join(', ')}`);
        }
        if (issue.relatedWaypoints && issue.relatedWaypoints.length > 0) {
          lines.push(`   - 相关航点: ${issue.relatedWaypoints.join(', ')}`);
        }
        lines.push('');
      }
    }
    
    if (minorIssues.length > 0) {
      lines.push('### 🟡 次要问题');
      lines.push('');
      for (const issue of minorIssues) {
        lines.push(`1. **[${issue.category}]** ${issue.message}`);
        lines.push('');
      }
    }
    
    if (infoIssues.length > 0) {
      lines.push('### 🔵 信息提示');
      lines.push('');
      for (const issue of infoIssues) {
        lines.push(`1. **[${issue.category}]** ${issue.message}`);
        lines.push('');
      }
    }
    
    lines.push('---');
    lines.push('');
    lines.push('*此报告由无人机巡检预检工具自动生成*');
    
    return lines.join('\n');
  }
}
