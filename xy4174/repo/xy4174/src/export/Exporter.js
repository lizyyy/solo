import { sceneManager } from '../models/SceneModel.js';
import { loadCalculator } from '../engine/LoadCalculator.js';
import { collisionDetector } from '../engine/CollisionDetector.js';

class Exporter {
  constructor() {
    this.templateVersion = '1.0';
  }

  exportMarkdownSafetyBriefing(scene = null) {
    const targetScene = scene || sceneManager.currentScene;
    const loadSummary = loadCalculator.getLoadDistributionSummary(targetScene);
    const collisionSummary = collisionDetector.getCollisionSummary(targetScene);

    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-CN');
    const timeStr = now.toLocaleTimeString('zh-CN');

    let md = `# 舞台吊装安全交底报告

---

## 基本信息

| 项目 | 内容 |
|------|------|
| 场景名称 | ${targetScene.name} |
| 生成时间 | ${dateStr} ${timeStr} |
| 报告版本 | v${this.templateVersion} |

---

## 载荷分布汇总

### 总载荷统计

| 参数 | 数值 |
|------|------|
| 总悬挂重量 | **${loadSummary.totalWeight.toFixed(1)} kg** |
| 重心位置 | X: ${loadSummary.centerOfGravity.x.toFixed(2)}m, Y: ${loadSummary.centerOfGravity.y.toFixed(2)}m, Z: ${loadSummary.centerOfGravity.z.toFixed(2)}m |
| 平衡状态 | ${loadSummary.isBalanced ? '✅ 平衡' : '⚠️ 不平衡'} |

### 吊点详细载荷

`;

    md += `| 吊点名称 | 电机类型 | 当前载荷 | 安全工作载荷 | 载荷比例 | 状态 |
|----------|----------|----------|--------------|----------|------|
`;

    for (const point of loadSummary.hangingPoints) {
      const statusIcon = point.isOverloaded ? '❌ 超载' : 
                         point.percentage > 80 ? '⚠️ 高载' : '✅ 正常';
      md += `| ${point.name} | ${point.motorType} | ${point.currentLoad.toFixed(1)}kg | ${point.maxSafeLoad.toFixed(1)}kg | ${point.percentage.toFixed(1)}% | ${statusIcon} |
`;
    }

    md += `
---

## 碰撞与净空检测

### 检测结果汇总

| 检测项 | 数量 |
|--------|------|
| 碰撞冲突 | ${collisionSummary.totalCollisions} |
| 净空警告 | ${collisionSummary.totalClearanceWarnings} |
| 总体状态 | ${collisionSummary.hasCollisions() ? '❌ 有冲突' : collisionSummary.hasWarnings() ? '⚠️ 有警告' : '✅ 正常'} |

`;

    if (collisionSummary.totalCollisions > 0) {
      md += `### ⚠️ 碰撞冲突详情

`;
      for (const collision of collisionSummary.collisions) {
        md += `- **${collision.object1}** 与 **${collision.object2}**\n  - ${collision.details}\n\n`;
      }
    }

    if (collisionSummary.totalClearanceWarnings > 0) {
      md += `### ⚠️ 净空警告详情

`;
      for (const warning of collisionSummary.clearanceWarnings) {
        md += `- **${warning.object1}** 与 **${warning.object2}**\n  - 距离: ${warning.distance.toFixed(3)}m\n  - ${warning.details}\n\n`;
      }
    }

    md += `
---

## 配重建议

`;

    if (loadSummary.suggestions && loadSummary.suggestions.length > 0) {
      for (const suggestion of loadSummary.suggestions) {
        if (suggestion.type === 'counterweight') {
          md += `### 配重添加建议

| 参数 | 数值 |
|------|------|
| 建议重量 | ${suggestion.weight} kg |
| 建议位置 | X: ${suggestion.position.x.toFixed(2)}m, Z: ${suggestion.position.z.toFixed(2)}m |

**原因**: ${suggestion.reason}

**预期效果**: ${suggestion.estimatedEffect}

`;
        } else if (suggestion.type === 'redistribute') {
          md += `### 载荷重新分配建议

**涉及吊点**: ${suggestion.targetPointName}

- 当前载荷: ${suggestion.currentLoad.toFixed(1)}kg
- 安全工作载荷: ${suggestion.maxSafeLoad.toFixed(1)}kg
- 超载量: ${suggestion.excessLoad.toFixed(1)}kg

**原因**: ${suggestion.reason}

**建议行动**: ${suggestion.action}

`;
        } else if (suggestion.type === 'additional_hanging_point') {
          md += `### 增加吊点建议

**涉及桁架**: ${suggestion.targetTrussName}

- 当前吊点数量: ${suggestion.currentPoints}
- 建议吊点数量: ${suggestion.suggestedPoints}

**原因**: ${suggestion.reason}

**建议行动**: ${suggestion.action}

`;
        }
      }
    } else {
      md += `✅ 系统检查通过，无需额外配重或调整。

`;
    }

    md += `
---

## 场景配置详情

### 舞台信息

| 参数 | 数值 |
|------|------|
| 宽度 | ${targetScene.stage.width} m |
| 深度 | ${targetScene.stage.depth} m |
| 位置 | X: ${targetScene.stage.position.x}m, Z: ${targetScene.stage.position.z}m |

### 统计信息

| 类别 | 数量 |
|------|------|
| 吊点数量 | ${targetScene.hangingPoints.length} |
| 桁架数量 | ${targetScene.trusses.length} |
| 设备数量 | ${targetScene.devices.length} |
| 障碍物数量 | ${targetScene.obstacles.length} |
| 配重数量 | ${targetScene.counterweights.length} |

`;

    if (targetScene.trusses.length > 0) {
      md += `### 桁架详情

| 桁架名称 | 长度 | 自重 | 挂接设备数 | 连接吊点数 |
|----------|------|------|------------|------------|
`;

      for (const truss of targetScene.trusses) {
        const trussWeight = truss.weightPerMeter * truss.length;
        md += `| ${truss.name} | ${truss.length}m | ${trussWeight.toFixed(1)}kg | ${truss.devices.length} | ${truss.hangingPoints.length} |
`;
      }
    }

    if (targetScene.devices.length > 0) {
      md += `
### 设备详情

| 设备名称 | 类型 | 重量 | 功率 | 挂接桁架 |
|----------|------|------|------|----------|
`;

      for (const device of targetScene.devices) {
        const attachedTruss = device.attachedTrussId 
          ? (targetScene.getTrussById(device.attachedTrussId)?.name || '-')
          : '无';
        md += `| ${device.name} | ${device.type} | ${device.weight}kg | ${device.power}W | ${attachedTruss} |
`;
      }
    }

    md += `
---

## 安全检查清单

### 吊装前检查

- [ ] 所有吊点载荷在安全工作载荷范围内
- [ ] 重心位置合理，系统处于平衡状态
- [ ] 桁架采用多点吊装（建议至少2点）
- [ ] 设备与障碍物无碰撞
- [ ] 设备与幕布/喷淋保持足够净空
- [ ] 所有设备高度在限高范围内
- [ ] 设备之间间距合理，便于安装调试

### 人员安全

- [ ] 吊装区域已设置警示标识
- [ ] 操作人员已接受安全培训
- [ ] 应急方案已制定并传达
- [ ] 通讯设备已确认可用

---

## 备注

${targetScene.description || '无额外备注'}

---

*此报告由吊点荷载沙盘系统自动生成，仅供参考。实际吊装请遵循现场安全规范和专业工程师指导。*

*生成时间: ${dateStr} ${timeStr}*
`;

    return md;
  }

  exportJSONScheme(scene = null) {
    const targetScene = scene || sceneManager.currentScene;
    const loadSummary = loadCalculator.getLoadDistributionSummary(targetScene);
    const collisionSummary = collisionDetector.getCollisionSummary(targetScene);

    const scheme = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      scene: {
        id: targetScene.id,
        name: targetScene.name,
        description: targetScene.description,
        createdAt: targetScene.createdAt,
        modifiedAt: targetScene.modifiedAt
      },
      stage: {
        width: targetScene.stage.width,
        depth: targetScene.stage.depth,
        position: targetScene.stage.position.toJSON()
      },
      loadAnalysis: {
        totalWeight: loadSummary.totalWeight,
        centerOfGravity: loadSummary.centerOfGravity,
        isBalanced: loadSummary.isBalanced,
        hangingPoints: loadSummary.hangingPoints.map(p => ({
          id: p.id,
          name: p.name,
          currentLoad: p.currentLoad,
          maxSafeLoad: p.maxSafeLoad,
          maxLoad: p.maxLoad,
          percentage: p.percentage,
          isOverloaded: p.isOverloaded,
          motorType: p.motorType,
          position: p.position
        }))
      },
      collisionAnalysis: {
        hasCollisions: collisionSummary.hasCollisions(),
        hasWarnings: collisionSummary.hasWarnings(),
        totalCollisions: collisionSummary.totalCollisions,
        totalClearanceWarnings: collisionSummary.totalClearanceWarnings,
        collisions: collisionSummary.collisions,
        clearanceWarnings: collisionSummary.clearanceWarnings
      },
      suggestions: loadSummary.suggestions,
      objects: {
        hangingPoints: targetScene.hangingPoints.map(p => p.toJSON()),
        trusses: targetScene.trusses.map(t => t.toJSON()),
        devices: targetScene.devices.map(d => d.toJSON()),
        obstacles: targetScene.obstacles.map(o => o.toJSON()),
        counterweights: targetScene.counterweights.map(c => c.toJSON())
      },
      validation: {
        overallStatus: this.getOverallStatus(loadSummary, collisionSummary),
        criticalIssues: this.getCriticalIssues(loadSummary, collisionSummary),
        warnings: this.getWarnings(loadSummary, collisionSummary)
      }
    };

    return JSON.stringify(scheme, null, 2);
  }

  getOverallStatus(loadSummary, collisionSummary) {
    if (loadSummary.errors.length > 0 || collisionSummary.hasCollisions()) {
      return 'critical';
    }
    if (loadSummary.warnings.length > 0 || collisionSummary.hasWarnings()) {
      return 'warning';
    }
    return 'ok';
  }

  getCriticalIssues(loadSummary, collisionSummary) {
    const issues = [];
    
    for (const error of loadSummary.errors) {
      issues.push({
        type: 'load',
        severity: 'critical',
        message: error.message,
        objectId: error.objectId
      });
    }
    
    for (const collision of collisionSummary.collisions) {
      issues.push({
        type: 'collision',
        severity: 'critical',
        message: collision.details,
        objectIds: [collision.obj1Id, collision.obj2Id]
      });
    }
    
    return issues;
  }

  getWarnings(loadSummary, collisionSummary) {
    const warnings = [];
    
    for (const warning of loadSummary.warnings) {
      warnings.push({
        type: 'load',
        message: warning.message,
        objectId: warning.objectId
      });
    }
    
    for (const warning of collisionSummary.clearanceWarnings) {
      warnings.push({
        type: 'clearance',
        message: warning.details,
        objectIds: [warning.obj1Id, warning.obj2Id],
        distance: warning.distance
      });
    }
    
    return warnings;
  }

  downloadMarkdown(scene = null) {
    const mdContent = this.exportMarkdownSafetyBriefing(scene);
    const targetScene = scene || sceneManager.currentScene;
    
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${targetScene.name.replace(/\s+/g, '_')}_安全交底_${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    return true;
  }

  downloadJSONScheme(scene = null) {
    const jsonContent = this.exportJSONScheme(scene);
    const targetScene = scene || sceneManager.currentScene;
    
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${targetScene.name.replace(/\s+/g, '_')}_方案_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    return true;
  }

  copyMarkdownToClipboard(scene = null) {
    const mdContent = this.exportMarkdownSafetyBriefing(scene);
    
    return navigator.clipboard.writeText(mdContent)
      .then(() => true)
      .catch((error) => {
        console.error('Failed to copy to clipboard:', error);
        return false;
      });
  }

  copyJSONToClipboard(scene = null) {
    const jsonContent = this.exportJSONScheme(scene);
    
    return navigator.clipboard.writeText(jsonContent)
      .then(() => true)
      .catch((error) => {
        console.error('Failed to copy to clipboard:', error);
        return false;
      });
  }
}

const exporter = new Exporter();

export {
  Exporter,
  exporter
};
