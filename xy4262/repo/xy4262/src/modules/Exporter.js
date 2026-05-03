export class Exporter {
  constructor(app) {
    this.app = app;
  }

  exportMarkdown() {
    const markers = this.app.getMarkers();
    const dronesData = this.app.getDronesData();
    const noFlyZones = this.app.getNoFlyZones();
    const simulation = this.app.getSimulation();

    const now = new Date().toISOString().slice(0, 10);
    
    let md = `# 无人机灯光秀航线排练报告\n\n`;
    md += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
    md += `---\n\n`;

    md += `## 一、基本信息\n\n`;
    md += `- **无人机数量**: ${dronesData ? dronesData.length : 0}\n`;
    md += `- **禁飞区数量**: ${noFlyZones ? noFlyZones.length : 0}\n`;
    if (simulation) {
      md += `- **演出总时长**: ${this.formatTime(simulation.totalTime)}\n`;
    }
    md += `\n`;

    const collisionMarkers = markers.filter(m => m.type === 'collision');
    const noFlyMarkers = markers.filter(m => m.type === 'no-fly');
    const batteryMarkers = markers.filter(m => m.type === 'battery');
    const manualMarkers = markers.filter(m => m.type === 'manual');

    md += `## 二、风险统计\n\n`;
    md += `| 风险类型 | 数量 |\n`;
    md += `|----------|------|\n`;
    md += `| 碰撞风险 | ${collisionMarkers.length} |\n`;
    md += `| 禁飞区穿越 | ${noFlyMarkers.length} |\n`;
    md += `| 低电量警告 | ${batteryMarkers.length} |\n`;
    md += `| 人工标记 | ${manualMarkers.length} |\n`;
    md += `\n`;

    if (collisionMarkers.length > 0) {
      md += `## 三、碰撞风险详情\n\n`;
      md += `### 严重程度: ${collisionMarkers.length > 0 ? '🔴 高' : '✅ 无'}\n\n`;
      
      collisionMarkers.forEach((marker, index) => {
        md += `#### 事件 ${index + 1}\n`;
        md += `- **时间**: ${this.formatTime(marker.time)}\n`;
        md += `- **描述**: ${marker.description}\n`;
        if (marker.details && marker.details.length > 0) {
          md += `- **涉及无人机**:\n`;
          marker.details.forEach(detail => {
            md += `  - ${detail.drone1} 和 ${detail.drone2}，距离: ${detail.distance.toFixed(2)}m\n`;
          });
        }
        md += `\n`;
      });
    }

    if (noFlyMarkers.length > 0) {
      md += `## 四、禁飞区穿越详情\n\n`;
      md += `### 严重程度: ${noFlyMarkers.length > 0 ? '🔴 高' : '✅ 无'}\n\n`;
      
      noFlyMarkers.forEach((marker, index) => {
        md += `#### 事件 ${index + 1}\n`;
        md += `- **时间**: ${this.formatTime(marker.time)}\n`;
        md += `- **描述**: ${marker.description}\n`;
        if (marker.details && marker.details.length > 0) {
          md += `- **涉及无人机**:\n`;
          marker.details.forEach(detail => {
            md += `  - 无人机 ${detail.droneId} 进入禁飞区: ${detail.zoneName}\n`;
          });
        }
        md += `\n`;
      });
    }

    if (batteryMarkers.length > 0) {
      md += `## 五、低电量警告详情\n\n`;
      md += `### 严重程度: ${batteryMarkers.length > 0 ? '🟡 中' : '✅ 无'}\n\n`;
      
      batteryMarkers.forEach((marker, index) => {
        md += `#### 事件 ${index + 1}\n`;
        md += `- **时间**: ${this.formatTime(marker.time)}\n`;
        md += `- **描述**: ${marker.description}\n`;
        if (marker.details && marker.details.length > 0) {
          md += `- **涉及无人机**:\n`;
          marker.details.forEach(detail => {
            const severity = detail.isCritical ? '🔴 严重' : '🟡 警告';
            md += `  - ${detail.droneId}: ${detail.batteryLevel.toFixed(1)}% ${severity}\n`;
          });
        }
        md += `\n`;
      });
    }

    if (manualMarkers.length > 0) {
      md += `## 六、人工标记\n\n`;
      
      manualMarkers.forEach((marker, index) => {
        md += `#### 标记 ${index + 1}\n`;
        md += `- **时间**: ${this.formatTime(marker.time)}\n`;
        md += `- **描述**: ${marker.description}\n`;
        md += `\n`;
      });
    }

    md += `## 七、建议\n\n`;
    
    const suggestions = [];
    
    if (collisionMarkers.length > 0) {
      suggestions.push(`- **碰撞风险**: 建议调整无人机间距，确保安全距离。检查转场路径，避免交叉飞行。`);
    }
    
    if (noFlyMarkers.length > 0) {
      suggestions.push(`- **禁飞区穿越**: 重新规划航线，避开禁飞区域。或与相关部门协调飞行许可。`);
    }
    
    if (batteryMarkers.length > 0) {
      suggestions.push(`- **低电量风险**: 建议更换高容量电池，或缩短飞行时长。检查电池老化状态。`);
    }
    
    if (suggestions.length === 0) {
      suggestions.push(`- ✅ 航线规划良好，未检测到重大风险。`);
      suggestions.push(`- 建议在实际飞行前进行小规模测试验证。`);
    }
    
    md += suggestions.join('\n\n') + '\n\n';

    md += `---\n\n`;
    md += `*此报告由无人机灯光秀航线排练台自动生成*\n`;

    return md;
  }

  exportCSV() {
    const markers = this.app.getMarkers();

    let csv = '\ufeff';
    csv += '时间,类型,描述,详情\n';

    const sortedMarkers = [...markers].sort((a, b) => a.time - b.time);

    sortedMarkers.forEach(marker => {
      const time = this.formatTime(marker.time);
      const type = this.getMarkerTypeName(marker.type);
      const description = marker.description.replace(/,/g, '，');
      
      let details = '';
      if (marker.details) {
        details = JSON.stringify(marker.details).replace(/,/g, '，');
      }

      csv += `${time},"${type}","${description}","${details}"\n`;
    });

    return csv;
  }

  exportJSON() {
    const markers = this.app.getMarkers();
    const dronesData = this.app.getDronesData();
    const noFlyZones = this.app.getNoFlyZones();
    const simulation = this.app.getSimulation();

    const collisionMarkers = markers.filter(m => m.type === 'collision');
    const noFlyMarkers = markers.filter(m => m.type === 'no-fly');
    const batteryMarkers = markers.filter(m => m.type === 'battery');
    const manualMarkers = markers.filter(m => m.type === 'manual');

    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0'
      },
      summary: {
        droneCount: dronesData ? dronesData.length : 0,
        noFlyZoneCount: noFlyZones ? noFlyZones.length : 0,
        totalDuration: simulation ? simulation.totalTime : 0,
        riskCounts: {
          collision: collisionMarkers.length,
          noFlyViolation: noFlyMarkers.length,
          lowBattery: batteryMarkers.length,
          manual: manualMarkers.length
        }
      },
      events: {
        collisions: collisionMarkers.map(m => ({
          time: m.time,
          description: m.description,
          details: m.details
        })),
        noFlyViolations: noFlyMarkers.map(m => ({
          time: m.time,
          description: m.description,
          details: m.details
        })),
        lowBatteryWarnings: batteryMarkers.map(m => ({
          time: m.time,
          description: m.description,
          details: m.details
        })),
        manualMarkers: manualMarkers.map(m => ({
          time: m.time,
          description: m.description,
          droneStates: m.droneStates
        }))
      },
      allMarkers: markers
    };

    return JSON.stringify(report, null, 2);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  getMarkerTypeName(type) {
    const names = {
      'collision': '碰撞风险',
      'no-fly': '禁飞区穿越',
      'battery': '低电量警告',
      'manual': '人工标记'
    };
    return names[type] || type;
  }
}
