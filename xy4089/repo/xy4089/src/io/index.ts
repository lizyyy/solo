import {
  Project,
  ValidationResult,
  HoistLoadResult,
  Truss,
  HoistPoint,
  Equipment,
  StageBoundary,
} from '../models';
import { createProject } from '../models';

export function exportProjectToJSON(project: Project): string {
  const projectCopy = JSON.parse(JSON.stringify(project));
  return JSON.stringify(projectCopy, null, 2);
}

export function importProjectFromJSON(jsonString: string): Project {
  const data = JSON.parse(jsonString);
  return createProject(data);
}

export function validateProjectJSON(jsonString: string): {
  valid: boolean;
  errors: string[];
  project?: Project;
} {
  const errors: string[] = [];
  
  try {
    const data = JSON.parse(jsonString);
    
    if (!data.trusses || !Array.isArray(data.trusses)) {
      errors.push('缺少或无效的 trusses 数组');
    }
    
    if (!data.hoistPoints || !Array.isArray(data.hoistPoints)) {
      errors.push('缺少或无效的 hoistPoints 数组');
    }
    
    if (!data.equipment || !Array.isArray(data.equipment)) {
      errors.push('缺少或无效的 equipment 数组');
    }
    
    if (errors.length > 0) {
      return { valid: false, errors };
    }
    
    const project = createProject(data);
    return { valid: true, errors: [], project };
  } catch (e) {
    errors.push(`JSON 解析错误: ${(e as Error).message}`);
    return { valid: false, errors };
  }
}

export function exportSafetyNoteToMarkdown(
  project: Project,
  validation: ValidationResult,
  options?: {
    includeHistory?: boolean;
    includeEquipmentDetails?: boolean;
  }
): string {
  const opts = {
    includeHistory: true,
    includeEquipmentDetails: true,
    ...options,
  };

  const totalWeight = calculateTotalWeight(project);
  const validationDate = new Date(validation.timestamp);
  const isSafe = validation.isSafe;

  let md = `# 吊点载荷安全预演报告\n\n`;

  md += `## 基本信息\n\n`;
  md += `- **项目名称**: ${project.name}\n`;
  md += `- **项目描述**: ${project.description || '无'}\n`;
  md += `- **报告生成时间**: ${validationDate.toLocaleString('zh-CN')}\n`;
  md += `- **总载荷**: ${totalWeight.toFixed(1)} kg\n\n`;

  md += `## 安全状态评估\n\n`;
  
  if (isSafe) {
    md += `✅ **当前状态: 安全**\n\n`;
  } else {
    md += `⚠️ **当前状态: 存在安全隐患**\n\n`;
    md += `### 错误项\n\n`;
    validation.hoistLoads.forEach(h => {
      if (h.isOverloaded) {
        const hp = project.hoistPoints.find(p => p.id === h.hoistPointId);
        const name = hp?.name || h.hoistPointId;
        md += `- **吊点超载**: ${name} - 负载 ${h.staticLoad.toFixed(1)}kg / 额定 ${h.maxRatedLoad}kg (${(h.loadRatio * 100).toFixed(0)}%)\n`;
      }
    });
    if (validation.unbalance.isUnbalanced) {
      md += `- **偏载超限**: 最大偏载比 ${(validation.unbalance.maxRatio * 100).toFixed(1)}% (阈值: ${(project.settings.maxUnbalanceRatio * 100).toFixed(0)}%)\n`;
    }
    validation.collisions.forEach(c => {
      if (c.isColliding) {
        md += `- **碰撞警告**: ${c.object1.name} 与 ${c.object2.name} 发生碰撞 (穿透深度: ${c.penetrationDepth.toFixed(2)}m)\n`;
      }
    });
    md += `\n`;
  }

  if (validation.hasWarnings) {
    md += `### 警告项\n\n`;
    validation.hoistLoads.forEach(h => {
      if (h.isWarning && !h.isOverloaded) {
        const hp = project.hoistPoints.find(p => p.id === h.hoistPointId);
        const name = hp?.name || h.hoistPointId;
        md += `- **吊点接近满载**: ${name} - 负载 ${h.staticLoad.toFixed(1)}kg / 额定 ${h.maxRatedLoad}kg (${(h.loadRatio * 100).toFixed(0)}%)\n`;
      }
    });
    validation.collisions.forEach(c => {
      if (c.isNear && !c.isColliding) {
        md += `- **接近警告**: ${c.object1.name} 与 ${c.object2.name} 距离过近 (距离: ${c.distance.toFixed(2)}m)\n`;
      }
    });
    md += `\n`;
  }

  md += `## 吊点载荷详情\n\n`;
  md += `| 吊点名称 | 额定载荷 (kg) | 静态负载 (kg) | 动态负载 (kg) | 负载率 | 状态 |\n`;
  md += `|---------|--------------|---------------|---------------|--------|------|\n`;
  
  validation.hoistLoads.forEach(h => {
    const hp = project.hoistPoints.find(p => p.id === h.hoistPointId);
    const name = hp?.name || h.hoistPointId;
    const loadPercent = (h.loadRatio * 100).toFixed(1);
    let status = '正常';
    if (h.isOverloaded) status = '⚠️ 超载';
    else if (h.isWarning) status = '⚠️ 警告';
    
    md += `| ${name} | ${h.maxRatedLoad} | ${h.staticLoad.toFixed(1)} | ${h.dynamicLoad.toFixed(1)} | ${loadPercent}% | ${status} |\n`;
  });
  md += `\n`;

  md += `## 重心与偏载分析\n\n`;
  md += `- **系统总质量**: ${validation.centerOfGravity.totalMass.toFixed(1)} kg\n`;
  md += `- **重心位置**: (${validation.centerOfGravity.position.x.toFixed(2)}, ${validation.centerOfGravity.position.y.toFixed(2)}, ${validation.centerOfGravity.position.z.toFixed(2)})\n`;
  md += `- **理想中心位置**: (${validation.unbalance.idealCenter.x.toFixed(2)}, ${validation.unbalance.idealCenter.y.toFixed(2)}, ${validation.unbalance.idealCenter.z.toFixed(2)})\n`;
  md += `- **X轴偏载比**: ${(validation.unbalance.xRatio * 100).toFixed(1)}%\n`;
  md += `- **Z轴偏载比**: ${(validation.unbalance.zRatio * 100).toFixed(1)}%\n`;
  md += `- **最大偏载比**: ${(validation.unbalance.maxRatio * 100).toFixed(1)}%\n`;
  md += `- **偏载阈值**: ${(project.settings.maxUnbalanceRatio * 100).toFixed(0)}%\n\n`;

  if (opts.includeEquipmentDetails && project.equipment.length > 0) {
    md += `## 设备清单\n\n`;
    md += `| 设备名称 | 类型 | 重量 (kg) | 位置 (x, y, z) |\n`;
    md += `|---------|------|-----------|----------------|\n`;
    
    const typeNames: Record<string, string> = {
      light: '灯具',
      speaker: '音箱',
      led: 'LED屏',
      generic: '通用设备',
    };
    
    project.equipment.forEach(eq => {
      const type = typeNames[eq.type] || eq.type;
      const pos = `(${eq.position.x.toFixed(2)}, ${eq.position.y.toFixed(2)}, ${eq.position.z.toFixed(2)})`;
      md += `| ${eq.name} | ${type} | ${eq.weight} | ${pos} |\n`;
    });
    md += `\n`;
  }

  md += `## 系统参数\n\n`;
  md += `- **重力加速度**: ${project.settings.gravity} m/s²\n`;
  md += `- **安全系数**: ${project.settings.safetyFactor}\n`;
  md += `- **动态冲击系数基准**: ${project.settings.dynamicImpactFactorBase}\n`;
  md += `- **最大偏载比阈值**: ${(project.settings.maxUnbalanceRatio * 100).toFixed(0)}%\n`;
  md += `- **坐标单位**: ${project.settings.coordinateSystem.unit === 'meters' ? '米' : '英尺'}\n\n`;

  md += `---\n\n`;
  md += `*此报告由「吊点载荷预演台」自动生成。仅供预演参考，实际作业请遵守相关安全规范。*\n`;

  return md;
}

function calculateTotalWeight(project: Project): number {
  let total = 0;
  
  project.trusses.forEach(t => {
    total += t.weightPerMeter * t.length;
  });
  
  project.equipment.forEach(eq => {
    total += eq.weight;
  });
  
  return total;
}

export function exportLoadTableToCSV(
  project: Project,
  validation: ValidationResult,
  options?: {
    includeDynamicLoads?: boolean;
    includePercentages?: boolean;
  }
): string {
  const opts = {
    includeDynamicLoads: true,
    includePercentages: true,
    ...options,
  };

  let headers = ['吊点名称', '额定载荷(kg)', '静态负载(kg)'];
  if (opts.includeDynamicLoads) {
    headers.push('动态负载(kg)');
  }
  if (opts.includePercentages) {
    headers.push('负载率(%)');
  }
  headers.push('状态');

  let csv = headers.join(',') + '\n';

  validation.hoistLoads.forEach(h => {
    const hp = project.hoistPoints.find(p => p.id === h.hoistPointId);
    const name = hp?.name || h.hoistPointId;
    const loadPercent = (h.loadRatio * 100).toFixed(1);
    
    let status = '正常';
    if (h.isOverloaded) status = '超载';
    else if (h.isWarning) status = '警告';

    let row = [
      `"${name}"`,
      h.maxRatedLoad.toString(),
      h.staticLoad.toFixed(1),
    ];
    if (opts.includeDynamicLoads) {
      row.push(h.dynamicLoad.toFixed(1));
    }
    if (opts.includePercentages) {
      row.push(loadPercent);
    }
    row.push(status);

    csv += row.join(',') + '\n';
  });

  csv += '\n';
  csv += '"汇总信息"\n';
  csv += `,"总静态载荷",${validation.hoistLoads.reduce((sum, h) => sum + h.staticLoad, 0).toFixed(1)}\n`;
  csv += `,"总动态载荷",${validation.hoistLoads.reduce((sum, h) => sum + h.dynamicLoad, 0).toFixed(1)}\n`;
  csv += `,"报告生成时间","${new Date(validation.timestamp).toLocaleString('zh-CN')}"\n`;

  return csv;
}

export function exportEquipmentListToCSV(
  equipment: Equipment[],
  trusses: Truss[],
  hoistPoints: HoistPoint[]
): string {
  const headers = ['设备名称', '类型', '重量(kg)', '位置X(m)', '位置Y(m)', '位置Z(m)', '挂载桁架', '挂载吊点'];
  let csv = headers.join(',') + '\n';

  const typeNames: Record<string, string> = {
    light: '灯具',
    speaker: '音箱',
    led: 'LED屏',
    generic: '通用设备',
  };

  equipment.forEach(eq => {
    const trussName = trusses.find(t => t.id === eq.trussId)?.name || '';
    const hoistName = '';
    
    let row = [
      `"${eq.name}"`,
      `"${typeNames[eq.type] || eq.type}"`,
      eq.weight.toString(),
      eq.position.x.toFixed(3),
      eq.position.y.toFixed(3),
      eq.position.z.toFixed(3),
      `"${trussName}"`,
      `"${hoistName}"`,
    ];
    csv += row.join(',') + '\n';
  });

  return csv;
}

export function exportTrussListToCSV(
  trusses: Truss[],
  hoistPoints: HoistPoint[]
): string {
  const headers = ['桁架名称', '类型', '长度(m)', '重量(kg/m)', '总重量(kg)', '吊点数量', '位置X(m)', '位置Y(m)', '位置Z(m)'];
  let csv = headers.join(',') + '\n';

  const typeNames: Record<string, string> = {
    box: '箱式桁架',
    triangular: '三角桁架',
    ladder: '梯式桁架',
  };

  trusses.forEach(truss => {
    const hpCount = hoistPoints.filter(hp => hp.trussId === truss.id).length;
    const totalWeight = truss.weightPerMeter * truss.length;
    
    let row = [
      `"${truss.name}"`,
      `"${typeNames[truss.type] || truss.type}"`,
      truss.length.toString(),
      truss.weightPerMeter.toString(),
      totalWeight.toFixed(1),
      hpCount.toString(),
      truss.position.x.toFixed(3),
      truss.position.y.toFixed(3),
      truss.position.z.toFixed(3),
    ];
    csv += row.join(',') + '\n';
  });

  return csv;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
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

export function downloadProjectJSON(project: Project): void {
  const json = exportProjectToJSON(project);
  const filename = `${project.name.replace(/\s+/g, '_')}_${Date.now()}.json`;
  downloadFile(json, filename, 'application/json');
}

export function downloadSafetyReport(
  project: Project,
  validation: ValidationResult
): void {
  const md = exportSafetyNoteToMarkdown(project, validation);
  const filename = `安全报告_${project.name.replace(/\s+/g, '_')}_${Date.now()}.md`;
  downloadFile(md, filename, 'text/markdown');
}

export function downloadLoadTableCSV(
  project: Project,
  validation: ValidationResult
): void {
  const csv = exportLoadTableToCSV(project, validation);
  const filename = `载荷表_${project.name.replace(/\s+/g, '_')}_${Date.now()}.csv`;
  downloadFile(csv, filename, 'text/csv');
}

export async function loadFileFromDisk(): Promise<{
  content: string;
  filename: string;
} | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv,.md';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        resolve({
          content,
          filename: file.name,
        });
      };
      reader.onerror = () => {
        resolve(null);
      };
      reader.readAsText(file);
    };

    input.click();
  });
}
