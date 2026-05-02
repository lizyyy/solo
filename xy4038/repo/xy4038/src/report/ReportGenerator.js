import { ProblemTypes } from '../logic/CollisionDetector.js';

export class ReportGenerator {
  constructor(stage, loadData, problems) {
    this.stage = stage;
    this.loadData = loadData;
    this.problems = problems;
  }
  
  generateMarkdownReport(options = {}) {
    const title = options.title || '舞台吊点载荷安全复核报告';
    const date = new Date().toLocaleString('zh-CN');
    
    let md = `# ${title}\n\n`;
    md += `**生成时间**: ${date}\n\n`;
    md += `---\n\n`;
    
    md += this.generateSummarySection();
    md += `\n`;
    
    md += this.generateProblemsSection();
    md += `\n`;
    
    md += this.generateLoadAnalysisSection();
    md += `\n`;
    
    md += this.generateDeviceListSection();
    md += `\n`;
    
    md += this.generateRecommendationsSection();
    md += `\n`;
    
    md += `---\n\n`;
    md += `*本报告由"吊点载荷排练台"自动生成，仅供参考。实际吊装前请由专业人员现场复核。*\n`;
    
    return md;
  }
  
  generateSummarySection() {
    let md = `## 概览\n\n`;
    
    const totalDevices = this.stage.devices.length;
    const totalLoad = this.loadData.totalLoad || 0;
    const dangerProblems = this.problems.filter(p => p.severity === 'danger').length;
    const warningProblems = this.problems.filter(p => p.severity === 'warning').length;
    
    md += `| 项目 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 设备总数 | ${totalDevices} 台 |\n`;
    md += `| 总载荷 | ${totalLoad.toFixed(1)} kg |\n`;
    md += `| 严重问题 | ${dangerProblems} 项 |\n`;
    md += `| 警告问题 | ${warningProblems} 项 |\n`;
    md += `\n`;
    
    if (dangerProblems > 0) {
      md += `⚠️ **存在严重问题，需要立即处理**\n\n`;
    } else if (warningProblems > 0) {
      md += `⚠️ **存在警告问题，建议检查**\n\n`;
    } else {
      md += `✅ **未检测到安全问题**\n\n`;
    }
    
    return md;
  }
  
  generateProblemsSection() {
    let md = `## 问题清单\n\n`;
    
    if (this.problems.length === 0) {
      md += `未检测到任何问题。\n\n`;
      return md;
    }
    
    const dangerProblems = this.problems.filter(p => p.severity === 'danger');
    const warningProblems = this.problems.filter(p => p.severity === 'warning');
    
    if (dangerProblems.length > 0) {
      md += `### 🔴 严重问题 (${dangerProblems.length}项)\n\n`;
      
      for (const problem of dangerProblems) {
        md += this.formatProblem(problem);
      }
    }
    
    if (warningProblems.length > 0) {
      md += `### 🟡 警告问题 (${warningProblems.length}项)\n\n`;
      
      for (const problem of warningProblems) {
        md += this.formatProblem(problem);
      }
    }
    
    return md;
  }
  
  formatProblem(problem) {
    let md = `#### ${this.getProblemTypeName(problem.type)}\n\n`;
    
    md += `- **对象**: ${this.getObjectName(problem)}\n`;
    md += `- **坐标**: (${problem.position.x.toFixed(2)}, ${problem.position.y.toFixed(2)}, ${problem.position.z.toFixed(2)})\n`;
    md += `- **描述**: ${problem.message}\n`;
    md += `- **建议**: ${problem.recommendation}\n`;
    md += `\n`;
    
    return md;
  }
  
  getProblemTypeName(type) {
    const names = {
      [ProblemTypes.OVERLOAD]: '吊点超载',
      [ProblemTypes.LOAD_IMBALANCE]: '载荷分布不均',
      [ProblemTypes.COLLISION]: '设备碰撞',
      [ProblemTypes.LIGHT_OCCLUSION]: '灯光遮挡',
      [ProblemTypes.CLEARANCE_VIOLATION]: '边界违规',
      [ProblemTypes.WALKING_HEIGHT]: '通道净高不足',
      [ProblemTypes.UNSUPPORTED_DEVICE]: '未挂载设备'
    };
    return names[type] || type;
  }
  
  getObjectName(problem) {
    if (problem.objectType === 'hoistPoint') {
      return `吊点 ${problem.objectId}`;
    } else if (problem.objectType === 'device') {
      if (problem.device1 && problem.device2) {
        return `${problem.device1.name} 与 ${problem.device2.name}`;
      }
      return problem.device?.name || problem.objectId;
    }
    return problem.objectId;
  }
  
  generateLoadAnalysisSection() {
    let md = `## 载荷分析\n\n`;
    
    const loadedHoists = Object.entries(this.loadData.hoistPoints || {})
      .filter(([_, data]) => data.load > 0);
    
    if (loadedHoists.length === 0) {
      md += `当前无加载吊点。\n\n`;
      return md;
    }
    
    md += `### 吊点载荷明细\n\n`;
    md += `| 吊点ID | 载荷 (kg) | 上限 (kg) | 使用率 | 状态 |\n`;
    md += `|--------|-----------|-----------|--------|------|\n`;
    
    for (const [hoistId, data] of loadedHoists) {
      const ratio = data.load / data.maxLoad;
      const percentage = (ratio * 100).toFixed(1);
      const status = ratio > 1 ? '🔴 超载' : ratio > 0.85 ? '🟡 警告' : '✅ 正常';
      
      md += `| ${hoistId} | ${data.load.toFixed(1)} | ${data.maxLoad} | ${percentage}% | ${status} |\n`;
    }
    
    md += `\n`;
    
    if (this.loadData.bars && Object.keys(this.loadData.bars).length > 0) {
      md += `### 横杆载荷明细\n\n`;
      
      for (const [barId, barData] of Object.entries(this.loadData.bars)) {
        const bar = this.stage.getBarById(barId);
        if (!bar) continue;
        
        md += `#### ${bar.userData.name || barId}\n\n`;
        md += `- 总重量: ${barData.totalWeight.toFixed(1)} kg\n`;
        md += `- 挂载设备数: ${barData.attachedDevices?.length || 0}\n`;
        
        if (barData.segmentLoads && barData.segmentLoads.length > 0) {
          md += `- 分段载荷:\n`;
          for (const segment of barData.segmentLoads) {
            md += `  - ${segment.startHoistId} - ${segment.endHoistId}: ${segment.load.toFixed(1)} kg\n`;
          }
        }
        md += `\n`;
      }
    }
    
    return md;
  }
  
  generateDeviceListSection() {
    let md = `## 设备清单\n\n`;
    
    if (this.stage.devices.length === 0) {
      md += `当前无挂载设备。\n\n`;
      return md;
    }
    
    const deviceTypes = this.groupDevicesByType();
    
    for (const [type, devices] of Object.entries(deviceTypes)) {
      md += `### ${this.getDeviceTypeName(type)} (${devices.length}台)\n\n`;
      md += `| 名称 | 型号 | 重量 (kg) | 位置 |\n`;
      md += `|------|------|-----------|------|\n`;
      
      for (const device of devices) {
        const pos = device.userData.position;
        const model = device.userData.model || '-';
        md += `| ${device.userData.name} | ${model} | ${device.userData.weight} | (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}) |\n`;
      }
      md += `\n`;
    }
    
    return md;
  }
  
  groupDevicesByType() {
    const groups = {};
    for (const device of this.stage.devices) {
      const type = device.userData.deviceType;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(device);
    }
    return groups;
  }
  
  getDeviceTypeName(type) {
    const names = {
      light: '灯光设备',
      speaker: '音响设备',
      screen: '幕布/屏幕',
      prop: '道具/桁架',
      custom: '自定义设备'
    };
    return names[type] || type;
  }
  
  generateRecommendationsSection() {
    let md = `## 处理建议\n\n`;
    
    if (this.problems.length === 0) {
      md += `当前方案未检测到安全问题。建议：\n\n`;
      md += `1. 定期检查所有吊点和挂载点的机械状态\n`;
      md += `2. 实际吊装前进行载荷测试\n`;
      md += `3. 确保所有设备固定牢固\n`;
      md += `4. 保持人员通道畅通\n`;
      md += `\n`;
      return md;
    }
    
    const recommendations = [];
    
    const overloads = this.problems.filter(p => p.type === ProblemTypes.OVERLOAD);
    if (overloads.length > 0) {
      recommendations.push({
        priority: 1,
        text: `处理 ${overloads.length} 个超载吊点：减轻载荷或增加支撑点`
      });
    }
    
    const collisions = this.problems.filter(p => p.type === ProblemTypes.COLLISION);
    if (collisions.length > 0) {
      recommendations.push({
        priority: 2,
        text: `调整 ${collisions.length} 组碰撞设备的位置，确保安全间距`
      });
    }
    
    const imbalances = this.problems.filter(p => p.type === ProblemTypes.LOAD_IMBALANCE);
    if (imbalances.length > 0) {
      recommendations.push({
        priority: 3,
        text: `重新分配载荷，使 ${imbalances.length} 个吊点受力更均匀`
      });
    }
    
    const occlusions = this.problems.filter(p => p.type === ProblemTypes.LIGHT_OCCLUSION);
    if (occlusions.length > 0) {
      recommendations.push({
        priority: 4,
        text: `调整 ${occlusions.length} 组被遮挡灯光的角度或位置`
      });
    }
    
    const unsupported = this.problems.filter(p => p.type === ProblemTypes.UNSUPPORTED_DEVICE);
    if (unsupported.length > 0) {
      recommendations.push({
        priority: 5,
        text: `为 ${unsupported.length} 个未挂载设备找到合适的挂载点`
      });
    }
    
    recommendations.sort((a, b) => a.priority - b.priority);
    
    md += `### 按优先级排序的处理建议\n\n`;
    for (let i = 0; i < recommendations.length; i++) {
      md += `${i + 1}. ${recommendations[i].text}\n`;
    }
    
    md += `\n`;
    md += `### 一般安全建议\n\n`;
    md += `1. 所有吊装作业必须由持证专业人员操作\n`;
    md += `2. 实际载荷不应超过吊点额定载荷的80%\n`;
    md += `3. 定期检查所有吊装设备的磨损情况\n`;
    md += `4. 确保有足够的应急通道和安全出口\n`;
    md += `5. 演出前进行全面的安全检查\n`;
    md += `\n`;
    
    return md;
  }
  
  generateCSV() {
    let csv = `名称,型号,类型,重量(kg),位置X,位置Y,位置Z,挂载方式,备注\n`;
    
    for (const device of this.stage.devices) {
      const pos = device.userData.position;
      const type = this.getDeviceTypeName(device.userData.deviceType);
      const mountMode = this.getMountModeName(device.userData.mountingMode);
      const model = device.userData.model || '';
      const notes = device.userData.notes || '';
      
      csv += `"${device.userData.name}","${model}","${type}",${device.userData.weight},${pos.x.toFixed(2)},${pos.y.toFixed(2)},${pos.z.toFixed(2)},"${mountMode}","${notes}"\n`;
    }
    
    return csv;
  }
  
  getMountModeName(mode) {
    const names = {
      hoist_direct: '直接挂吊点',
      bar_attached: '挂横杆',
      floor_standing: '地面放置'
    };
    return names[mode] || mode;
  }
  
  downloadMarkdown(filename = 'safety-report.md') {
    const content = this.generateMarkdownReport();
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }
  
  downloadCSV(filename = 'equipment-list.csv') {
    const content = this.generateCSV();
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
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
