import { ModelParser } from './model-parser.js';
import { ValidationSeverity, ValidationType } from './validation-rules.js';

export class StorageExporter {
  constructor() {
    this.modelParser = new ModelParser();
  }

  exportProject(projectData) {
    const project = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      caseId: projectData.caseId || 'unknown',
      annotation: projectData.annotation ? this.modelParser.createToothAnnotation(projectData.annotation) : null,
      config: projectData.config || {},
      validationResults: projectData.validationResults || null,
      notes: projectData.notes || ''
    };

    return JSON.stringify(project, null, 2);
  }

  importProject(jsonString) {
    try {
      const project = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      
      let annotation = null;
      if (project.annotation) {
        annotation = this.modelParser.parseToothAnnotation(project.annotation);
      }

      return {
        version: project.version || '1.0',
        timestamp: project.timestamp || new Date().toISOString(),
        caseId: project.caseId || 'unknown',
        annotation: annotation,
        config: project.config || {},
        validationResults: project.validationResults || null,
        notes: project.notes || ''
      };
    } catch (error) {
      throw new Error(`导入项目失败: ${error.message}`);
    }
  }

  saveProjectToLocalStorage(projectName, projectData) {
    const json = this.exportProject(projectData);
    localStorage.setItem(`occlusal_project_${projectName}`, json);
    return true;
  }

  loadProjectFromLocalStorage(projectName) {
    const json = localStorage.getItem(`occlusal_project_${projectName}`);
    if (!json) {
      return null;
    }
    return this.importProject(json);
  }

  listProjectsFromLocalStorage() {
    const projects = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('occlusal_project_')) {
        try {
          const projectName = key.replace('occlusal_project_', '');
          const data = JSON.parse(localStorage.getItem(key));
          projects.push({
            name: projectName,
            caseId: data.caseId || 'unknown',
            timestamp: data.timestamp,
            version: data.version
          });
        } catch (e) {
          // Skip invalid entries
        }
      }
    }
    return projects;
  }

  deleteProjectFromLocalStorage(projectName) {
    localStorage.removeItem(`occlusal_project_${projectName}`);
    return true;
  }

  exportMarkdownReport(projectData, validationResults) {
    const lines = [];
    const project = projectData || {};
    const validation = validationResults || (project.validationResults ? 
      (Array.isArray(project.validationResults) ? 
        project.validationResults : project.validationResults.all : []);
    
    const results = Array.isArray(validation) ? validation : validation.all || [];
    const grouped = this._groupResultsBySeverity(results);

    lines.push('# 口扫咬合预检报告');
    lines.push('');
    lines.push(`**病例编号**: ${project.caseId || '未命名'`);
    lines.push(`**生成时间**: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');

    lines.push('## 1. 校验摘要');
    lines.push('');
    
    const errorCount = grouped.errors.length;
    const warningCount = grouped.warnings.length;
    const infoCount = grouped.infos.length;

    lines.push(`| 类型 | 数量 | 状态 |`);
    lines.push(`|------|------|------|`);
    lines.push(`| 错误 | ${errorCount} | ${errorCount > 0 ? '❌ 存在问题' : '✅ 无错误'} |`);
    lines.push(`| 警告 | ${warningCount} | ${warningCount > 0 ? '⚠️ 需要注意' : '✅ 无警告'} |`);
    lines.push(`| 信息 | ${infoCount} | ℹ️ 参考信息 |`);
    lines.push('');

    const overallStatus = errorCount > 0 ? '❌ 未通过' : warningCount > 0 ? '⚠️ 存在警告' : '✅ 通过';
    lines.push(`**整体状态**: ${overallStatus}`);
    lines.push('');

    if (grouped.errors.length > 0) {
      lines.push('## 2. 错误详情');
      lines.push('');
      grouped.errors.forEach((error, index) => {
        lines.push(`### ${index + 1}. ${error.message}`);
        lines.push('');
        lines.push(`- **类型**: ${this._getTypeLabel(error.type)}`);
        if (error.fdiNumber) {
          lines.push(`- **牙位**: ${error.fdiNumber} (${error.toothName || '未知'})`);
        }
        if (error.otherFdiNumber) {
          lines.push(`- **关联牙位**: ${error.otherFdiNumber} (${error.otherToothName || '未知'})`);
        }
        if (error.details) {
          lines.push(`- **详情**: ${JSON.stringify(error.details, null, 2)}`);
        }
        lines.push('');
      });
    }

    if (grouped.warnings.length > 0) {
      lines.push('## 3. 警告详情');
      lines.push('');
      grouped.warnings.forEach((warning, index) => {
        lines.push(`### ${index + 1}. ${warning.message}`);
        lines.push('');
        lines.push(`- **类型**: ${this._getTypeLabel(warning.type)}`);
        if (warning.fdiNumber) {
          lines.push(`- **牙位**: ${warning.fdiNumber} (${warning.toothName || '未知'})`);
        }
        if (warning.otherFdiNumber) {
          lines.push(`- **关联牙位**: ${warning.otherFdiNumber} (${warning.otherToothName || '未知'})`);
        }
        if (warning.details) {
          lines.push(`- **详情**: ${JSON.stringify(warning.details, null, 2)}`);
        }
        lines.push('');
      });
    }

    if (grouped.infos.length > 0) {
      lines.push('## 4. 参考信息');
      lines.push('');
      grouped.infos.forEach((info, index) => {
        lines.push(`${index + 1}. ${info.message}`);
      });
      lines.push('');
    }

    if (project.annotation) {
      lines.push('## 5. 牙位清单');
      lines.push('');
      lines.push(this._generateToothTable(project.annotation));
      lines.push('');
    }

    lines.push('## 6. 配置信息');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(project.config || {}, null, 2));
    lines.push('```');
    lines.push('');

    if (project.notes) {
      lines.push('## 7. 备注');
      lines.push('');
      lines.push(project.notes);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push(`*报告由口扫咬合预检台生成*`);
    lines.push(`*版本: 1.0*`);

    return lines.join('\n');
  }

  exportCSVToothList(annotation) {
    if (!annotation || !annotation.teeth) {
      return '';
    }

    const lines = [];
    
    const headers = [
      'ID',
      'FDI牙位',
      '牙位名称',
      '是否存在',
      '是否有附件',
      '附件类型',
      '附件位置X',
      '附件位置Y',
      '附件位置Z',
      '附件尺寸X',
      '附件尺寸Y',
      '附件尺寸Z',
      '移动量X',
      '移动量Y',
      '移动量Z',
      '旋转量X(度)',
      '旋转量Y(度)',
      '旋转量Z(度)',
      '网格ID'
    ];
    lines.push(headers.join(','));

    annotation.teeth.forEach((tooth) => {
      const row = [
        tooth.id,
        tooth.fdiNumber,
        tooth.name,
        tooth.present ? '是' : '否',
        tooth.hasAttachment ? '是' : '否'
      ];

      if (tooth.attachment) {
        row.push(tooth.attachment.type || '');
        row.push(tooth.attachment.position.x.toFixed(3));
        row.push(tooth.attachment.position.y.toFixed(3));
        row.push(tooth.attachment.position.z.toFixed(3));
        row.push(tooth.attachment.size.x.toFixed(3));
        row.push(tooth.attachment.size.y.toFixed(3));
        row.push(tooth.attachment.size.z.toFixed(3));
      } else {
        row.push('', '', '', '', '', '', '');
      }

      if (tooth.movement) {
        row.push(tooth.movement.translation.x.toFixed(3));
        row.push(tooth.movement.translation.y.toFixed(3));
        row.push(tooth.movement.translation.z.toFixed(3));
        row.push((tooth.movement.rotation.x * 180 / Math.PI).toFixed(3));
        row.push((tooth.movement.rotation.y * 180 / Math.PI).toFixed(3));
        row.push((tooth.movement.rotation.z * 180 / Math.PI).toFixed(3));
      } else {
        row.push('', '', '', '', '', '');
      }

      row.push(tooth.meshId || '');
      
      lines.push(row.map(cell => `"${cell}"`).join(','));
    });

    return lines.join('\n');
  }

  exportCSVValidationResults(validationResults) {
    const results = Array.isArray(validationResults) ? validationResults : validationResults.all || [];
    
    if (results.length === 0) {
      return '';
    }

    const lines = [];
    
    const headers = [
      '序号',
      '严重程度',
      '类型',
      '牙位',
      '牙位名称',
      '关联牙位',
      '关联牙位名称',
      '消息',
      '详情'
    ];
    lines.push(headers.join(','));

    results.forEach((result, index) => {
      const row = [
        index + 1,
        this._getSeverityLabel(result.severity),
        this._getTypeLabel(result.type),
        result.fdiNumber || '',
        result.toothName || '',
        result.otherFdiNumber || '',
        result.otherToothName || '',
        result.message,
        result.details ? JSON.stringify(result.details) : ''
      ];
      
      lines.push(row.map(cell => `"${cell}"`).join(','));
    });

    return lines.join('\n');
  }

  downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  downloadJSON(data, filename) {
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    this.downloadFile(content, filename, 'application/json');
  }

  downloadMarkdown(content, filename) {
    this.downloadFile(content, filename, 'text/markdown');
  }

  downloadCSV(content, filename) {
    this.downloadFile(content, filename, 'text/csv;charset=utf-8');
  }

  _groupResultsBySeverity(results) {
    const errors = [];
    const warnings = [];
    const infos = [];

    (results || []).forEach(result => {
      switch (result.severity) {
        case ValidationSeverity.ERROR:
          errors.push(result);
          break;
        case ValidationSeverity.WARNING:
          warnings.push(result);
          break;
        case ValidationSeverity.INFO:
          infos.push(result);
          break;
      }
    });

    return { errors, warnings, infos };
  }

  _getSeverityLabel(severity) {
    const labels = {
      [ValidationSeverity.ERROR]: '错误',
      [ValidationSeverity.WARNING]: '警告',
      [ValidationSeverity.INFO]: '信息',
      [ValidationSeverity.OK]: '正常'
    };
    return labels[severity] || severity;
  }

  _getTypeLabel(type) {
    const labels = {
      [ValidationType.COLLISION]: '碰撞',
      [ValidationType.GAP]: '间隙',
      [ValidationType.MISSING_TOOTH]: '牙位缺失',
      [ValidationType.UNIT_SCALE]: '单位比例',
      [ValidationType.ATTACHMENT_POSITION]: '附件位置',
      [ValidationType.MOVEMENT_PATH]: '移动路径'
    };
    return labels[type] || type;
  }

  _generateToothTable(annotation) {
    const lines = [];
    
    const teeth = annotation.teeth || [];
    
    lines.push('| FDI牙位 | 牙位名称 | 状态 | 附件 | 移动量 |');
    lines.push('|----------|----------|------|------|--------|');

    const sortedTeeth = [...teeth].sort((a, b) => a.fdiNumber - b.fdiNumber);

    sortedTeeth.forEach((tooth) => {
      const status = tooth.present ? '✅ 存在' : '❌ 缺失';
      const hasAttachment = tooth.hasAttachment ? '✅ 有' : '❌ 无';
      
      let movement = '-';
      if (tooth.movement) {
        const trans = tooth.movement.translation;
        movement = `(${trans.x.toFixed(1)}, ${trans.y.toFixed(1)}, ${trans.z.toFixed(1)})`;
      }

      lines.push(`| ${tooth.fdiNumber} | ${tooth.name} | ${status} | ${hasAttachment} | ${movement} |`);
    });

    return lines.join('\n');
  }
}

export default StorageExporter;
