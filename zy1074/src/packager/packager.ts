import fs from 'fs-extra';
import path from 'path';
import { 
  ProjectValidationResult, 
  Report,
  ProjectFiles
} from '../types';

export interface PackageResult {
  outputDir: string;
  files: {
    source: string;
    destination: string;
    status: 'copied' | 'skipped' | 'error';
    error?: string;
  }[];
  reports: {
    markdown: string;
    json: string;
    html: string;
  };
  manifest: {
    projectPath: string;
    timestamp: string;
    overallStatus: string;
    summary: {
      totalErrors: number;
      totalWarnings: number;
      totalInfos: number;
    };
    includedFiles: string[];
    excludedFiles: string[];
  };
}

export interface PackageOptions {
  outputDir: string;
  includeWarnings?: boolean;
  copySourceFiles?: boolean;
  generateReports?: boolean;
}

export class Packager {
  private projectPath: string;
  private validationResult: ProjectValidationResult;
  private projectFiles: ProjectFiles;

  constructor(
    projectPath: string,
    validationResult: ProjectValidationResult,
    projectFiles: ProjectFiles
  ) {
    this.projectPath = projectPath;
    this.validationResult = validationResult;
    this.projectFiles = projectFiles;
  }

  async package(options: PackageOptions, report?: Report): Promise<PackageResult> {
    const {
      outputDir,
      includeWarnings = true,
      copySourceFiles = true,
      generateReports = true
    } = options;

    await fs.ensureDir(outputDir);

    const files: PackageResult['files'] = [];
    const includedFiles: string[] = [];
    const excludedFiles: string[] = [];

    const hasErrors = this.validationResult.summary.totalErrors > 0;
    const hasWarnings = this.validationResult.summary.totalWarnings > 0;

    if (copySourceFiles) {
      const canInclude = !hasErrors || includeWarnings;
      
      if (canInclude) {
        for (const subtitle of this.projectFiles.subtitles) {
          const result = await this.tryCopyFile(subtitle.path, outputDir, 'subtitles');
          files.push(result);
          if (result.status === 'copied') {
            includedFiles.push(path.join('subtitles', path.basename(subtitle.path)));
          } else {
            excludedFiles.push(subtitle.path);
          }
        }

        if (this.projectFiles.chapters) {
          const result = await this.tryCopyFile(this.projectFiles.chapters, outputDir, 'chapters');
          files.push(result);
          if (result.status === 'copied') {
            includedFiles.push(path.join('chapters', path.basename(this.projectFiles.chapters)));
          } else {
            excludedFiles.push(this.projectFiles.chapters);
          }
        }

        if (this.projectFiles.adPoints) {
          const result = await this.tryCopyFile(this.projectFiles.adPoints, outputDir, 'ad-points');
          files.push(result);
          if (result.status === 'copied') {
            includedFiles.push(path.join('ad-points', path.basename(this.projectFiles.adPoints)));
          } else {
            excludedFiles.push(this.projectFiles.adPoints);
          }
        }

        for (const deliveryFile of this.projectFiles.deliveryFiles) {
          const result = await this.tryCopyFile(deliveryFile, outputDir, 'delivery');
          files.push(result);
          if (result.status === 'copied') {
            includedFiles.push(path.join('delivery', path.basename(deliveryFile)));
          } else {
            excludedFiles.push(deliveryFile);
          }
        }
      } else {
        for (const subtitle of this.projectFiles.subtitles) {
          excludedFiles.push(subtitle.path);
        }
        if (this.projectFiles.chapters) {
          excludedFiles.push(this.projectFiles.chapters);
        }
        if (this.projectFiles.adPoints) {
          excludedFiles.push(this.projectFiles.adPoints);
        }
        for (const deliveryFile of this.projectFiles.deliveryFiles) {
          excludedFiles.push(deliveryFile);
        }
      }
    }

    const reports: PackageResult['reports'] = {
      markdown: '',
      json: '',
      html: ''
    };

    if (generateReports && report) {
      const reportsDir = path.join(outputDir, 'reports');
      await fs.ensureDir(reportsDir);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const baseName = `health-check-report-${timestamp}`;

      const mdPath = path.join(reportsDir, `${baseName}.md`);
      await fs.writeFile(mdPath, report.markdown, 'utf-8');
      reports.markdown = mdPath;
      includedFiles.push(path.join('reports', `${baseName}.md`));

      const jsonPath = path.join(reportsDir, `${baseName}.json`);
      await fs.writeFile(jsonPath, report.json, 'utf-8');
      reports.json = jsonPath;
      includedFiles.push(path.join('reports', `${baseName}.json`));

      const htmlPath = path.join(reportsDir, `${baseName}.html`);
      await fs.writeFile(htmlPath, report.html, 'utf-8');
      reports.html = htmlPath;
      includedFiles.push(path.join('reports', `${baseName}.html`));
    }

    const manifest: PackageResult['manifest'] = {
      projectPath: this.projectPath,
      timestamp: new Date().toISOString(),
      overallStatus: this.validationResult.overallStatus,
      summary: {
        totalErrors: this.validationResult.summary.totalErrors,
        totalWarnings: this.validationResult.summary.totalWarnings,
        totalInfos: this.validationResult.summary.totalInfos
      },
      includedFiles,
      excludedFiles
    };

    const manifestPath = path.join(outputDir, 'MANIFEST.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    const readmeContent = this.generateReadme(manifest, hasErrors, hasWarnings);
    await fs.writeFile(path.join(outputDir, 'README.txt'), readmeContent, 'utf-8');

    return {
      outputDir,
      files,
      reports,
      manifest
    };
  }

  private async tryCopyFile(
    sourcePath: string,
    outputDir: string,
    subDir: string
  ): Promise<PackageResult['files'][0]> {
    try {
      const targetDir = path.join(outputDir, subDir);
      await fs.ensureDir(targetDir);

      const fileName = path.basename(sourcePath);
      const targetPath = path.join(targetDir, fileName);

      if (!await fs.pathExists(sourcePath)) {
        return {
          source: sourcePath,
          destination: targetPath,
          status: 'error',
          error: '源文件不存在'
        };
      }

      await fs.copy(sourcePath, targetPath);
      
      return {
        source: sourcePath,
        destination: targetPath,
        status: 'copied'
      };
    } catch (error) {
      return {
        source: sourcePath,
        destination: '',
        status: 'error',
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  private generateReadme(
    manifest: PackageResult['manifest'],
    hasErrors: boolean,
    hasWarnings: boolean
  ): string {
    let content = '='.repeat(60) + '\n';
    content += '           字幕交付体检 - 打包清单\n';
    content += '='.repeat(60) + '\n\n';

    content += `生成时间: ${new Date(manifest.timestamp).toLocaleString('zh-CN')}\n`;
    content += `项目路径: ${manifest.projectPath}\n`;
    content += `整体状态: ${this.getStatusText(manifest.overallStatus)}\n\n`;

    content += '-'.repeat(60) + '\n';
    content += '检查统计\n';
    content += '-'.repeat(60) + '\n\n';
    content += `  🔴 错误: ${manifest.summary.totalErrors} 项\n`;
    content += `  🟡 警告: ${manifest.summary.totalWarnings} 项\n`;
    content += `  🔵 信息: ${manifest.summary.totalInfos} 项\n\n`;

    if (hasErrors) {
      content += '⚠️  注意：本次打包包含错误！\n';
      content += '   建议先修复错误后再交付。\n\n';
    } else if (hasWarnings) {
      content += '📝 注意：本次打包包含警告！\n';
      content += '   请检查报告中的警告项是否需要处理。\n\n';
    } else {
      content += '✅ 所有检查通过！\n\n';
    }

    content += '-'.repeat(60) + '\n';
    content += '目录结构\n';
    content += '-'.repeat(60) + '\n\n';
    content += `  output/\n`;
    content += `  ├── subtitles/      字幕文件 (.srt/.vtt)\n`;
    content += `  ├── chapters/       章节文件 (.csv)\n`;
    content += `  ├── ad-points/      广告点位文件 (.csv)\n`;
    content += `  ├── delivery/       交付文件\n`;
    content += `  ├── reports/        检查报告\n`;
    content += `  │   ├── *.md        Markdown 格式报告\n`;
    content += `  │   ├── *.json      JSON 格式报告\n`;
    content += `  │   └── *.html      HTML 格式报告\n`;
    content += `  ├── MANIFEST.json   打包清单\n`;
    content += `  └── README.txt      本文件\n\n`;

    if (manifest.includedFiles.length > 0) {
      content += '-'.repeat(60) + '\n';
      content += '包含的文件\n';
      content += '-'.repeat(60) + '\n\n';
      for (const file of manifest.includedFiles) {
        content += `  ✅ ${file}\n`;
      }
      content += '\n';
    }

    if (manifest.excludedFiles.length > 0) {
      content += '-'.repeat(60) + '\n';
      content += '排除的文件\n';
      content += '-'.repeat(60) + '\n\n';
      for (const file of manifest.excludedFiles) {
        content += `  ❌ ${file}\n`;
      }
      content += '\n';
      content += '说明：文件因存在错误未被包含在打包中。\n';
      content += '      请修复错误后重新运行 package 命令。\n\n';
    }

    content += '-'.repeat(60) + '\n';
    content += '下一步操作\n';
    content += '-'.repeat(60) + '\n\n';
    content += '1. 查看 reports/ 目录中的详细报告\n';
    content += '2. 根据报告修复发现的问题\n';
    content += '3. 重新运行 validate 命令确认问题已修复\n';
    content += '4. 修复完成后可安全交付\n\n';

    content += '='.repeat(60) + '\n';
    content += '报告由「字幕交付体检」工具自动生成\n';
    content += '='.repeat(60) + '\n';

    return content;
  }

  private getStatusText(status: string): string {
    switch (status) {
      case 'passed': return '✅ 通过';
      case 'warning': return '⚠️ 存在警告';
      case 'failed': return '❌ 存在错误';
      default: return '未知';
    }
  }
}

export async function createPackage(
  projectPath: string,
  validationResult: ProjectValidationResult,
  projectFiles: ProjectFiles,
  options: PackageOptions,
  report?: Report
): Promise<PackageResult> {
  const packager = new Packager(projectPath, validationResult, projectFiles);
  return packager.package(options, report);
}
