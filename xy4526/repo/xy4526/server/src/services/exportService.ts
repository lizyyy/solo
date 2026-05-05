import * as XLSX from 'xlsx';
import {
  Project,
  CalculationResult,
  AdjustmentSuggestion,
  AbnormalData,
  CalculationStep,
} from '../models/types.js';

export class ExportService {
  generateMarkdownReport(
    project: Project,
    result: CalculationResult
  ): string {
    const now = new Date().toLocaleString('zh-CN');

    let report = `# 水力平衡调平建议报告\n\n`;
    report += `## 项目信息\n\n`;
    report += `- **项目名称**: ${project.name}\n`;
    report += `- **生成时间**: ${now}\n`;
    report += `- **计算时间**: ${new Date(result.timestamp).toLocaleString('zh-CN')}\n\n`;

    report += `## 系统概览\n\n`;
    report += `| 参数 | 值 |\n`;
    report += `|------|-----|\n`;
    report += `| 总流量 | ${result.totalFlowRate.toFixed(2)} m³/h |\n`;
    report += `| 系统总压降 | ${result.systemPressureDrop.toFixed(2)} kPa |\n`;
    report += `| 工作点流量 | ${result.operatingPoint.flowRate.toFixed(2)} m³/h |\n`;
    report += `| 工作点扬程 | ${result.operatingPoint.head.toFixed(2)} m |\n`;
    report += `| 异常数据项 | ${result.abnormalData.length} 项 |\n`;
    report += `| 调整建议 | ${result.suggestions.length} 项 |\n\n`;

    if (result.abnormalData.length > 0) {
      report += `## 异常数据提示\n\n`;

      const highSeverity = result.abnormalData.filter(a => a.severity === 'high');
      const mediumSeverity = result.abnormalData.filter(a => a.severity === 'medium');
      const lowSeverity = result.abnormalData.filter(a => a.severity === 'low');

      if (highSeverity.length > 0) {
        report += `### 🔴 高优先级异常\n\n`;
        for (const item of highSeverity) {
          report += `**${item.location}**\n`;
          report += `- 当前值: ${item.currentValue}\n`;
          report += `- 期望范围: ${item.expectedRange.min} ~ ${item.expectedRange.max}\n`;
          report += `- 建议: ${item.suggestion}\n\n`;
        }
      }

      if (mediumSeverity.length > 0) {
        report += `### 🟡 中优先级异常\n\n`;
        for (const item of mediumSeverity) {
          report += `**${item.location}**\n`;
          report += `- 当前值: ${item.currentValue}\n`;
          report += `- 期望范围: ${item.expectedRange.min} ~ ${item.expectedRange.max}\n`;
          report += `- 建议: ${item.suggestion}\n\n`;
        }
      }

      if (lowSeverity.length > 0) {
        report += `### 🟢 低优先级异常\n\n`;
        for (const item of lowSeverity) {
          report += `**${item.location}**\n`;
          report += `- 当前值: ${item.currentValue}\n`;
          report += `- 期望范围: ${item.expectedRange.min} ~ ${item.expectedRange.max}\n`;
          report += `- 建议: ${item.suggestion}\n\n`;
        }
      }
    }

    if (result.suggestions.length > 0) {
      report += `## 阀门调整建议\n\n`;

      const highPriority = result.suggestions.filter(s => s.priority === 'high');
      const mediumPriority = result.suggestions.filter(s => s.priority === 'medium');
      const lowPriority = result.suggestions.filter(s => s.priority === 'low');

      if (highPriority.length > 0) {
        report += `### 🔴 高优先级调整\n\n`;
        report += `| 阀门名称 | 当前开度 | 建议开度 | 调整量 |\n`;
        report += `|----------|----------|----------|--------|\n`;
        for (const item of highPriority) {
          const arrow = item.adjustmentAmount > 0 ? '↑' : '↓';
          report += `| ${item.valveName} | ${item.currentOpening}% | ${item.suggestedOpening}% | ${arrow}${Math.abs(item.adjustmentAmount)}% |\n`;
        }
        report += `\n`;

        for (const item of highPriority) {
          report += `**${item.valveName}**: ${item.reasoning}\n\n`;
        }
      }

      if (mediumPriority.length > 0) {
        report += `### 🟡 中优先级调整\n\n`;
        report += `| 阀门名称 | 当前开度 | 建议开度 | 调整量 |\n`;
        report += `|----------|----------|----------|--------|\n`;
        for (const item of mediumPriority) {
          const arrow = item.adjustmentAmount > 0 ? '↑' : '↓';
          report += `| ${item.valveName} | ${item.currentOpening}% | ${item.suggestedOpening}% | ${arrow}${Math.abs(item.adjustmentAmount)}% |\n`;
        }
        report += `\n`;

        for (const item of mediumPriority) {
          report += `**${item.valveName}**: ${item.reasoning}\n\n`;
        }
      }

      if (lowPriority.length > 0) {
        report += `### 🟢 低优先级调整\n\n`;
        report += `| 阀门名称 | 当前开度 | 建议开度 | 调整量 |\n`;
        report += `|----------|----------|----------|--------|\n`;
        for (const item of lowPriority) {
          const arrow = item.adjustmentAmount > 0 ? '↑' : '↓';
          report += `| ${item.valveName} | ${item.currentOpening}% | ${item.suggestedOpening}% | ${arrow}${Math.abs(item.adjustmentAmount)}% |\n`;
        }
        report += `\n`;

        for (const item of lowPriority) {
          report += `**${item.valveName}**: ${item.reasoning}\n\n`;
        }
      }
    }

    if (project.userNotes && project.userNotes.trim()) {
      report += `## 人工修正意见\n\n`;
      report += `${project.userNotes}\n\n`;
    }

    report += `## 计算过程明细\n\n`;
    report += `<details>\n`;
    report += `<summary>点击展开查看详细计算步骤</summary>\n\n`;

    for (const step of result.steps) {
      report += `### 步骤 ${step.step}: ${step.description}\n\n`;
      report += `**输入参数:**\n`;
      for (const [key, value] of Object.entries(step.inputs)) {
        report += `- ${key}: ${value}\n`;
      }
      report += `\n**计算公式:** ${step.formula}\n\n`;
      report += `**输出结果:**\n`;
      for (const [key, value] of Object.entries(step.outputs)) {
        report += `- ${key}: ${value}\n`;
      }
      report += `\n---\n\n`;
    }

    report += `</details>\n\n`;

    report += `---\n`;
    report += `*此报告由水力平衡试算工具自动生成*\n`;

    return report;
  }

  generateJSONExport(
    project: Project,
    result: CalculationResult
  ): string {
    return JSON.stringify(
      {
        exportDate: new Date().toISOString(),
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          userNotes: project.userNotes,
        },
        inputData: {
          nodes: project.nodes,
          pipes: project.pipes,
          valves: project.valves,
          pumpCurve: project.pumpCurve,
          temperatureData: project.temperatureData,
        },
        calculationResult: {
          id: result.id,
          timestamp: result.timestamp,
          summary: {
            totalFlowRate: result.totalFlowRate,
            systemPressureDrop: result.systemPressureDrop,
            operatingPoint: result.operatingPoint,
          },
          pipeResults: result.pipeResults,
          valveResults: result.valveResults,
          abnormalData: result.abnormalData,
          suggestions: result.suggestions,
          calculationSteps: result.steps,
        },
      },
      null,
      2
    );
  }

  generateExcelTemplate(): ArrayBuffer {
    const wb = XLSX.utils.book_new();

    const nodesData = [
      ['id', 'name', 'type', 'parentId', 'x', 'y'],
      ['n1', '供热站出口', 'branch', '', 100, 200],
      ['n2', '1号楼分支', 'branch', 'n1', 300, 100],
      ['n3', '2号楼分支', 'branch', 'n1', 300, 300],
      ['n4', '1号楼1单元', 'unit', 'n2', 500, 50],
      ['n5', '1号楼2单元', 'unit', 'n2', 500, 150],
    ];
    const nodesSheet = XLSX.utils.aoa_to_sheet(nodesData);
    XLSX.utils.book_append_sheet(wb, nodesSheet, '节点');

    const pipesData = [
      ['id', 'name', 'fromNodeId', 'toNodeId', 'diameter', 'length', 'roughness'],
      ['p1', '主管网-1号楼', 'n1', 'n2', 150, 80, 0.15],
      ['p2', '主管网-2号楼', 'n1', 'n3', 150, 80, 0.15],
      ['p3', '1号楼-1单元', 'n2', 'n4', 80, 30, 0.15],
      ['p4', '1号楼-2单元', 'n2', 'n5', 80, 30, 0.15],
    ];
    const pipesSheet = XLSX.utils.aoa_to_sheet(pipesData);
    XLSX.utils.book_append_sheet(wb, pipesSheet, '管道');

    const valvesData = [
      ['id', 'name', 'pipeId', 'opening', 'kvValue', 'notes'],
      ['v1', '1号楼总阀', 'p1', 60, 200, '检修后调整'],
      ['v2', '2号楼总阀', 'p2', 50, 200, ''],
      ['v3', '1号楼1单元阀', 'p3', 45, 80, ''],
      ['v4', '1号楼2单元阀', 'p4', 55, 80, ''],
    ];
    const valvesSheet = XLSX.utils.aoa_to_sheet(valvesData);
    XLSX.utils.book_append_sheet(wb, valvesSheet, '阀门');

    const pumpInfoData = [
      ['id', 'name', 'maxFlowRate', 'maxHead', 'efficiency'],
      ['pump-1', '循环水泵-型号ISG150-315', 200, 32, 82],
    ];
    const pumpInfoSheet = XLSX.utils.aoa_to_sheet(pumpInfoData);
    XLSX.utils.book_append_sheet(wb, pumpInfoSheet, '水泵信息');

    const pumpCurveData = [
      ['flowRate', 'head'],
      [0, 32],
      [50, 30],
      [100, 26],
      [150, 20],
      [200, 12],
    ];
    const pumpCurveSheet = XLSX.utils.aoa_to_sheet(pumpCurveData);
    XLSX.utils.book_append_sheet(wb, pumpCurveSheet, '水泵曲线');

    const tempData = [
      ['nodeId', 'supplyTemp', 'returnTemp', 'timestamp'],
      ['n4', 62, 48, new Date().toISOString()],
      ['n5', 61, 52, new Date().toISOString()],
    ];
    const tempSheet = XLSX.utils.aoa_to_sheet(tempData);
    XLSX.utils.book_append_sheet(wb, tempSheet, '温度数据');

    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  }
}
