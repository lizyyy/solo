export class IOManager {
  constructor(storageManager, riskAnalyzer) {
    this.storageManager = storageManager;
    this.riskAnalyzer = riskAnalyzer;
  }

  exportJSON(sceneRenderer) {
    return this.storageManager.exportJSON(sceneRenderer);
  }

  importJSON(sceneRenderer, jsonString) {
    return this.storageManager.importJSON(sceneRenderer, jsonString);
  }

  exportMarkdownReport(sceneRenderer, riskResults) {
    const { walls, pillars, cameras, parkings, passages } = sceneRenderer.objects;
    const { summary, blindSpots, overlaps, passageRisks, parkingRisks } = riskResults;

    const timestamp = new Date().toLocaleString('zh-CN');

    let report = `# 摄像头盲区巡检报告

**生成时间**: ${timestamp}

---

## 一、场景概览

| 类型 | 数量 |
|------|------|
| 墙体 | ${walls.length} |
| 立柱 | ${pillars.length} |
| 摄像头 | ${cameras.length} |
| 车位 | ${parkings.length} |
| 通道 | ${passages.length} |

---

## 二、风险概览

| 风险级别 | 数量 |
|----------|------|
| 🔴 严重 (Critical) | ${summary.criticalCount} |
| 🟡 警告 (Warning) | ${summary.warningCount} |
| 🔵 提示 (Info) | ${summary.infoCount} |

---

## 三、详细风险分析

`;

    if (blindSpots.length > 0) {
      report += `### 3.1 监控盲区风险 (共 ${blindSpots.length} 处)

`;
      blindSpots.forEach((spot, index) => {
        const level = spot.level === 'critical' ? '🔴' : '🟡';
        report += `${level} **盲区 ${index + 1}**
- 位置: (${spot.position.x.toFixed(1)}, ${spot.position.z.toFixed(1)})
- 面积: ~${spot.area?.toFixed(2) || '未知'} 平方米
- 描述: ${spot.description}

`;
      });
    } else {
      report += `### 3.1 监控盲区风险
✅ **无监控盲区** - 所有区域均被摄像头覆盖

`;
    }

    if (overlaps.length > 0) {
      report += `### 3.2 视锥体重叠风险 (共 ${overlaps.length} 处)

`;
      overlaps.forEach((overlap, index) => {
        const level = overlap.level === 'critical' ? '🔴' : '🟡';
        report += `${level} **重叠 ${index + 1}**
- 涉及摄像头: ${overlap.cameraIds.join(', ')}
- 重叠率: ${(overlap.overlapRatio * 100).toFixed(1)}%
- 描述: ${overlap.description}

`;
      });
    } else {
      report += `### 3.2 视锥体重叠风险
✅ **无显著重叠** - 摄像头布局合理

`;
    }

    if (passageRisks.length > 0) {
      report += `### 3.3 通道覆盖风险 (共 ${passageRisks.length} 处)

`;
      passageRisks.forEach((risk, index) => {
        const level = risk.level === 'critical' ? '🔴' : '🟡';
        report += `${level} **通道风险 ${index + 1}**
- 通道ID: ${risk.passageId}
- 覆盖率: ${(risk.coverage * 100).toFixed(1)}%
- 是否关键通道: ${risk.isCritical ? '是' : '否'}
- 描述: ${risk.description}

`;
      });
    } else {
      report += `### 3.3 通道覆盖风险
✅ **所有通道覆盖良好**

`;
    }

    if (parkingRisks.length > 0) {
      report += `### 3.4 车位覆盖风险 (共 ${parkingRisks.length} 处)

`;
      parkingRisks.forEach((risk, index) => {
        report += `🟡 **车位风险 ${index + 1}**
- 车位ID: ${risk.parkingId}
- 车位标签: ${risk.label || '未命名'}
- 覆盖率: ${(risk.coverage * 100).toFixed(1)}%
- 描述: ${risk.description}

`;
      });
    } else {
      report += `### 3.4 车位覆盖风险
✅ **所有车位覆盖良好**

`;
    }

    report += `---

## 四、摄像头配置详情

`;

    if (cameras.length > 0) {
      cameras.forEach((cam, index) => {
        const data = cam.data;
        report += `### 摄像头 ${index + 1}: ${data.name || '未命名'} (ID: ${cam.id})

| 属性 | 值 |
|------|-----|
| 位置 | (${data.position.x.toFixed(1)}, ${data.position.z.toFixed(1)}) |
| 高度 | ${data.height || 3} 米 |
| 视角 (FOV) | ${data.fov || 60}° |
| 朝向 | Y: ${((data.rotation?.y || 0) * 180 / Math.PI).toFixed(1)}° |
| 最远距离 | ${data.far || 50} 米 |

`;
      });
    } else {
      report += `⚠️ **未配置任何摄像头**

`;
    }

    report += `---

## 五、优化建议

`;

    const suggestions = [];

    if (summary.criticalCount > 0) {
      suggestions.push('1. **紧急处理**: 首先修复所有标注为"严重"的风险问题');
    }

    if (blindSpots.length > 0) {
      suggestions.push('2. **盲区处理**: 在盲区位置增加或调整摄像头角度');
    }

    if (overlaps.length > 0) {
      suggestions.push('3. **资源优化**: 调整有重叠的摄像头，减少资源浪费');
    }

    if (passageRisks.some(r => r.isCritical)) {
      suggestions.push('4. **关键通道**: 确保所有关键通道有至少2个摄像头覆盖');
    }

    if (suggestions.length === 0) {
      suggestions.push('✅ 当前布局良好，无显著优化建议');
    }

    suggestions.forEach(s => {
      report += s + '\n\n';
    });

    report += `---

*本报告由「摄像头盲区巡检沙盘」系统自动生成*
`;

    return report;
  }

  downloadJSON(sceneRenderer, filename = 'parking-layout.json') {
    const jsonContent = this.exportJSON(sceneRenderer);
    this.downloadFile(jsonContent, filename, 'application/json');
  }

  downloadMarkdownReport(sceneRenderer, riskResults, filename = 'inspection-report.md') {
    const mdContent = this.exportMarkdownReport(sceneRenderer, riskResults);
    this.downloadFile(mdContent, filename, 'text/markdown');
  }

  downloadFile(content, filename, mimeType) {
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

  importFromFile(sceneRenderer, file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const content = e.target.result;
        const success = this.importJSON(sceneRenderer, content);
        if (success) {
          resolve(true);
        } else {
          reject(new Error('导入失败，文件格式不正确'));
        }
      };
      
      reader.onerror = (e) => {
        reject(new Error('文件读取失败'));
      };
      
      reader.readAsText(file);
    });
  }
}

export default IOManager;
