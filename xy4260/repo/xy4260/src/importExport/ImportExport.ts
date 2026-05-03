import { LayoutModel, DetectionResult, ElementType, VisionOcclusion } from '../types';
import { getElementTypeName } from '../utils/layoutUtils';

export interface ReportData {
  model: LayoutModel;
  detectionResult: DetectionResult;
  reportDate: string;
  reportVersion: string;
}

const REPORT_VERSION = '1.0.0';

export class ImportExportManager {

  public async importLayout(file: File): Promise<LayoutModel> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const data = JSON.parse(content) as LayoutModel;
          
          if (!this.isValidLayoutModel(data)) {
            resolve(data);
          } else {
            reject(new Error('无效的展厅 JSON 格式，请检查文件内容'));
          }
        } catch (error) {
          reject(new Error('JSON 解析失败，请确保文件是有效的 JSON 格式'));
        }
      };

      reader.onerror = () => {
        reject(new Error('文件读取失败'));
      };

      reader.readAsText(file);
    });
  }

  private isValidLayoutModel(data: unknown): data is LayoutModel {
    if (typeof data !== 'object' || data === null) return false;
    
    const model = data as Record<string, unknown>;
    
    if (!model.hall || typeof model.hall !== 'object') return false;
    if (!Array.isArray(model.elements)) return false;
    
    const hall = model.hall as Record<string, unknown>;
    if (typeof hall.width !== 'number' || typeof hall.depth !== 'number') {
      return false;
    }
    
    return true;
  }

  public exportLayout(model: LayoutModel): void {
    const jsonString = JSON.stringify(model, null, 2);
    this.downloadFile(jsonString, `展厅布局方案_${this.getTimestamp()}.json`, 'application/json');
  }

  public exportMarkdownReport(data: ReportData): void {
    const markdown = this.generateMarkdownReport(data);
    this.downloadFile(markdown, `展厅布局评审报告_${this.getTimestamp()}.md`, 'text/markdown');
  }

  public exportPackage(model: LayoutModel, detectionResult: DetectionResult): void {
    const packageData = {
      version: REPORT_VERSION,
      exportDate: new Date().toISOString(),
      layout: model,
      detectionResult: detectionResult,
    };
    
    const jsonString = JSON.stringify(packageData, null, 2);
    this.downloadFile(jsonString, `展厅布局方案包_${this.getTimestamp()}.json`, 'application/json');
  }

  private generateMarkdownReport(data: ReportData): string {
    const { model, detectionResult, reportDate, reportVersion } = data;
    
    let markdown = `# 展厅布局评审报告\n\n`;
    
    markdown += `## 基本信息\n\n`;
    markdown += `- **报告版本**: ${reportVersion}\n`;
    markdown += `- **生成时间**: ${reportDate}\n`;
    markdown += `- **展厅名称**: ${model.hall.name}\n`;
    markdown += `- **展厅尺寸**: ${model.hall.width}m × ${model.hall.depth}m\n`;
    markdown += `- **元素总数**: ${model.elements.length}\n`;
    markdown += `- **检测问题总数**: ${detectionResult.totalIssues}\n\n`;

    markdown += `---\n\n`;

    markdown += `## 布局元素统计\n\n`;
    const elementStats = this.countElementsByType(model.elements);
    const typeNames: Record<ElementType, string> = {
      cabinet: '展柜',
      entrance: '入口',
      exit: '出口',
      interactive_screen: '互动屏',
      fire_exit: '消防通道',
    };

    (Object.keys(typeNames) as ElementType[]).forEach(type => {
      const count = elementStats[type] || 0;
      if (count > 0) {
        markdown += `- **${typeNames[type]}**: ${count} 个\n`;
      }
    });

    markdown += `\n`;

    if (model.elements.length > 0) {
      markdown += `### 元素详情\n\n`;
      markdown += `| 名称 | 类型 | 位置 (X, Z) | 旋转 (Y) |\n`;
      markdown += `|------|------|-------------|----------|\n`;
      
      model.elements.forEach(element => {
        markdown += `| ${element.name} | ${getElementTypeName(element.type)} | `;
        markdown += `(${element.position.x.toFixed(2)}, ${element.position.z.toFixed(2)}) | `;
        markdown += `${(element.rotation.y * 180 / Math.PI).toFixed(1)}° |\n`;
      });
      
      markdown += `\n`;
    }

    markdown += `---\n\n`;

    markdown += `## 检测结果\n\n`;

    if (detectionResult.totalIssues === 0) {
      markdown += `✅ **所有检测项均通过，布局方案符合规范！**\n\n`;
    } else {
      markdown += `⚠️ **发现 ${detectionResult.totalIssues} 个问题需要注意**\n\n`;
    }

    if (detectionResult.heatZones.length > 0) {
      markdown += `### 人流热区 (${detectionResult.heatZones.length})\n\n`;
      detectionResult.heatZones.forEach((zone, index) => {
        const intensity = (zone.intensity * 100).toFixed(0);
        markdown += `**热区 #${index + 1}\n`;
        markdown += `- **强度**: ${intensity}%\n`;
        markdown += `- **位置**: (${zone.position.x.toFixed(2)}, ${zone.position.z.toFixed(2)})\n`;
        markdown += `- **半径**: ${zone.radius.toFixed(1)}m\n`;
        markdown += `- **原因**: ${zone.reason}\n\n`;
      });
    }

    if (detectionResult.visionOcclusions.length > 0) {
      markdown += `### 视线遮挡 (${detectionResult.visionOcclusions.length})\n\n`;
      const uniqueOcclusions = this.getUniqueOcclusions(detectionResult.visionOcclusions);
      uniqueOcclusions.forEach((occlusion, index) => {
        markdown += `**遮挡 #${index + 1}\n`;
        markdown += `- **被遮挡元素**: ${occlusion.elementName}\n`;
        markdown += `- **遮挡元素**: ${occlusion.occludedByName}\n`;
        markdown += `- **遮挡程度**: ${occlusion.occlusionPercentage}%\n\n`;
      });
    }

    if (detectionResult.fireExitIssues.length > 0) {
      markdown += `### 消防通道问题 (${detectionResult.fireExitIssues.length})\n\n`;
      detectionResult.fireExitIssues.forEach((issue, index) => {
        markdown += `**问题 #${index + 1}\n`;
        markdown += `- **消防通道**: ${issue.elementName}\n`;
        markdown += `- **问题类型**: ${issue.issue === 'width_insufficient' ? '宽度不足' : '被阻挡'}\n`;
        markdown += `- **详情**: ${issue.details}\n\n`;
      });
    }

    if (detectionResult.entranceExitConflicts.length > 0) {
      markdown += `### 入口出口冲突 (${detectionResult.entranceExitConflicts.length})\n\n`;
      detectionResult.entranceExitConflicts.forEach((conflict, index) => {
        markdown += `**冲突 #${index + 1}\n`;
        markdown += `- **入口**: ${conflict.entranceName}\n`;
        markdown += `- **出口**: ${conflict.exitName}\n`;
        markdown += `- **当前距离**: ${conflict.distance}m\n`;
        markdown += `- **要求距离**: ≥ ${conflict.minimumRequiredDistance}m\n`;
        markdown += `- **状态**: ❌ 不满足要求\n\n`;
      });
    }

    markdown += `---\n\n`;

    markdown += `## 建议\n\n`;
    
    if (detectionResult.heatZones.length > 0) {
      markdown += `### 人流热区建议\n`;
      markdown += `- 分散展柜位置，避免在入口、出口和互动屏附近聚集过多展柜\n`;
      markdown += `- 在热区位置增加通道宽度，预留疏散空间\n`;
      markdown += `- 考虑设置导流标识，引导人流分散\n\n`;
    }

    if (detectionResult.visionOcclusions.length > 0) {
      markdown += `### 视线遮挡建议\n`;
      markdown += `- 调整展柜和互动屏的位置，确保展品可见性\n`;
      markdown += `- 保持展品之间至少 0.5 米的间距\n`;
      markdown += `- 考虑调整展柜高度，避免遮挡视线\n\n`;
    }

    if (detectionResult.fireExitIssues.length > 0) {
      markdown += `### 消防通道建议\n`;
      markdown += `- ⚠️ **消防问题必须优先解决**\n`;
      markdown += `- 确保消防通道宽度达到最低要求 (${detectionResult.fireExitIssues[0]?.issue === 'width_insufficient' ? '检查具体要求' : '1.2m'})\n`;
      markdown += `- 清除消防通道周围的障碍物\n`;
      markdown += `- 确保消防通道标识清晰可见\n\n`;
    }

    if (detectionResult.entranceExitConflicts.length > 0) {
      markdown += `### 入口出口冲突建议\n`;
      markdown += `- 重新规划入口和出口位置，确保间距至少 ${detectionResult.entranceExitConflicts[0]?.minimumRequiredDistance || 8} 米\n`;
      markdown += `- 避免人流对冲，减少拥堵\n`;
      markdown += `- 考虑设置单向流动路线\n\n`;
    }

    if (detectionResult.totalIssues === 0) {
      markdown += `✅ 布局方案设计合理，各项指标均符合规范要求。\n`;
      markdown += `建议在实际布展前可以按照此方案执行。\n\n`;
    }

    markdown += `---\n\n`;

    markdown += `## 附录\n\n`;
    markdown += `- 报告生成工具: 展厅动线热区排布器\n`;
    markdown += `- 数据来源: 本报告由系统自动生成\n`;

    return markdown;
  }

  private countElementsByType(elements: unknown[]): Record<ElementType, number> {
    const counts: Partial<Record<ElementType, number>> = {};
    elements.forEach(element => {
      const el = element as { type: ElementType };
      counts[el.type] = (counts[el.type] || 0) + 1;
    });
    return counts as Record<ElementType, number>;
  }

  private getUniqueOcclusions(occlusions: VisionOcclusion[]): VisionOcclusion[] {
    const uniquePairs = new Set<string>();
    const result: VisionOcclusion[] = [];

    occlusions.forEach(occlusion => {
      const pair = [occlusion.elementId, occlusion.occludedBy].sort().join('-');
      if (!uniquePairs.has(pair)) {
        uniquePairs.add(pair);
        result.push(occlusion);
      }
    });

    return result;
  }

  private getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}`;
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
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
}
