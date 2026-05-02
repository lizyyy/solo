export class StorageExporter {
  constructor() {
    this.storageKey = 'snow_inspection_projects';
    this.currentProjectId = null;
  }

  saveProject(projectData) {
    const projects = this._getAllProjects();
    
    const project = {
      id: projectData.id || `project_${Date.now()}`,
      name: projectData.name || `巡检项目 ${new Date().toLocaleDateString()}`,
      description: projectData.description || '',
      createdAt: projectData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: {
        elevation: projectData.elevation || null,
        facilities: projectData.facilities || null,
        photos: projectData.photos || [],
        hazards: projectData.hazards || [],
        routeWaypoints: projectData.routeWaypoints || []
      },
      metadata: projectData.metadata || {}
    };

    const existingIndex = projects.findIndex(p => p.id === project.id);
    if (existingIndex >= 0) {
      projects[existingIndex] = project;
    } else {
      projects.push(project);
    }

    this._saveAllProjects(projects);
    this.currentProjectId = project.id;
    
    return project;
  }

  loadProject(projectId) {
    const projects = this._getAllProjects();
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
      throw new Error(`未找到项目: ${projectId}`);
    }

    this.currentProjectId = projectId;
    return project;
  }

  deleteProject(projectId) {
    const projects = this._getAllProjects();
    const filteredProjects = projects.filter(p => p.id !== projectId);
    
    if (filteredProjects.length === projects.length) {
      throw new Error(`未找到项目: ${projectId}`);
    }

    this._saveAllProjects(filteredProjects);
    
    if (this.currentProjectId === projectId) {
      this.currentProjectId = null;
    }

    return true;
  }

  listProjects() {
    const projects = this._getAllProjects();
    return projects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      hazardCount: p.data?.hazards?.length || 0,
      routeWaypointCount: p.data?.routeWaypoints?.length || 0
    })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  _getAllProjects() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('读取本地存储失败:', error);
      return [];
    }
  }

  _saveAllProjects(projects) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(projects));
    } catch (error) {
      console.error('保存到本地存储失败:', error);
      throw new Error('存储失败: ' + error.message);
    }
  }

  exportHazardsJSON(hazards, options = {}) {
    const exportData = {
      exportTime: new Date().toISOString(),
      version: '1.0',
      hazardTypes: ['ice', 'pit', 'rock', 'debris', 'other'],
      hazards: hazards.map(h => ({
        id: h.id,
        type: h.type,
        location: h.location,
        severity: h.severity,
        description: h.description,
        radius: h.radius,
        photos: h.photos,
        notes: h.notes,
        timestamp: h.timestamp,
        status: h.status
      }))
    };

    if (options.includeRoute) {
      exportData.routeWaypoints = options.routeWaypoints || [];
    }

    return JSON.stringify(exportData, null, 2);
  }

  exportMarkdownReport(exportData) {
    const { project, hazards, route, statistics, riskAreas } = exportData;
    
    const now = new Date();
    const reportDate = now.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const severityColors = {
      low: '🟢 低风险',
      medium: '🟡 中风险',
      high: '🟠 高风险',
      critical: '🔴 严重风险'
    };

    const typeNames = {
      ice: '结冰',
      pit: '坑洼',
      rock: '岩石',
      debris: '杂物',
      other: '其他'
    };

    let markdown = `# 雪道隐患巡检报告

**报告生成时间**: ${reportDate}
**巡检项目**: ${project?.name || '未命名项目'}

---

## 一、巡检统计概览

| 指标 | 数值 |
|------|------|
| 隐患总数 | ${statistics?.hazards?.total || 0} |
| 低风险 | ${statistics?.hazards?.bySeverity?.low || 0} |
| 中风险 | ${statistics?.hazards?.bySeverity?.medium || 0} |
| 高风险 | ${statistics?.hazards?.bySeverity?.high || 0} |
| 严重风险 | ${statistics?.hazards?.bySeverity?.critical || 0} |
| 规划巡检点 | ${statistics?.route?.waypointCount || 0} |
| 预估巡检距离 | ${(statistics?.route?.estimatedTime?.distance || 0).toFixed(2)} 公里 |
| 预估巡检时间 | ${statistics?.route?.estimatedTime?.totalMinutes || 0} 分钟 |

---

## 二、高风险区域分析
`;

    if (riskAreas && riskAreas.length > 0) {
      markdown += `
### 检测到的高风险区域

| 区域ID | 风险等级 | 风险分值 | 包含风险点 | 位置坐标 |
|--------|----------|----------|------------|----------|
`;
      riskAreas.forEach((area, index) => {
        markdown += `| ${area.id} | ${severityColors[area.riskLevel] || area.riskLevel} | ${(area.riskScore * 100).toFixed(1)}% | ${area.pointCount} | (${area.location.x.toFixed(1)}, ${area.location.y.toFixed(1)}) |
`;
      });
    } else {
      markdown += `
> 未检测到连续的高风险区域。
`;
    }

    markdown += `
---

## 三、隐患详细清单

`;

    if (hazards && hazards.length > 0) {
      const groupedBySeverity = {
        critical: hazards.filter(h => h.severity === 'critical'),
        high: hazards.filter(h => h.severity === 'high'),
        medium: hazards.filter(h => h.severity === 'medium'),
        low: hazards.filter(h => h.severity === 'low')
      };

      for (const severity of ['critical', 'high', 'medium', 'low']) {
        const group = groupedBySeverity[severity];
        if (group.length > 0) {
          markdown += `### ${severityColors[severity]} (${group.length}项)

`;
          group.forEach((hazard, index) => {
            markdown += `#### ${index + 1}. ${typeNames[hazard.type] || hazard.type}

- **位置**: 坐标 (${hazard.location.x.toFixed(2)}, ${hazard.location.y.toFixed(2)}, 海拔 ${hazard.location.z.toFixed(1)}m)
- **影响范围**: 半径 ${hazard.radius} 米
- **描述**: ${hazard.description || '无描述'}
- **状态**: ${hazard.status === 'pending' ? '待处理' : hazard.status === 'in_progress' ? '处理中' : '已解决'}
- **记录时间**: ${new Date(hazard.timestamp).toLocaleString('zh-CN')}
${hazard.notes ? `- **备注**: ${hazard.notes}\n` : ''}
${hazard.photos && hazard.photos.length > 0 ? `- **关联照片**: ${hazard.photos.join(', ')}\n` : ''}

`;
          });
        }
      }
    } else {
      markdown += `> 本次巡检未记录任何隐患。
`;
    }

    markdown += `
---

## 四、巡检路线规划

`;

    if (route && route.length > 1) {
      markdown += `### 路线概览

- **起始点**: ${route[0]?.name || '起点'}
- **途经点**: ${route.length - 2} 个
- **终点**: ${route[route.length - 1]?.name || '终点'}
- **总距离**: ${statistics?.route?.estimatedTime?.distance?.toFixed(2) || 0} 公里
- **预估时间**: ${statistics?.route?.estimatedTime?.totalMinutes || 0} 分钟

### 详细航点

| 序号 | 航点名称 | 坐标 | 备注 |
|------|----------|------|------|
`;
      route.forEach((waypoint, index) => {
        markdown += `| ${index + 1} | ${waypoint.name} | (${waypoint.location.x.toFixed(1)}, ${waypoint.location.y.toFixed(1)}) | ${waypoint.notes || '-'} |
`;
      });
    } else {
      markdown += `> 本次巡检未规划路线。
`;
    }

    markdown += `
---

## 五、风险着色图例说明

### 坡度风险着色
- 🟢 **绿色**: 0-15° 缓坡，安全
- 🟡 **黄色**: 15-25° 中等坡度，注意控制速度
- 🟠 **橙色**: 25-35° 陡坡，危险区域
- 🔴 **红色**: >35° 极陡坡，严重风险

### 结冰风险着色
- 🟦 **浅蓝**: 低结冰风险
- 🔵 **中蓝**: 中结冰风险
- 💙 **深蓝**: 高结冰风险（高流量区域+北向坡）

### 综合风险着色
- 🟢 绿色: 综合安全
- 🟡 黄色: 综合中风险
- 🔴 红色: 综合高风险

---

## 六、建议处理措施

根据本次巡检结果，提出以下建议：

1. **优先处理严重风险**: 建议优先处理 ${statistics?.hazards?.bySeverity?.critical || 0} 项严重风险隐患，防止事故发生。

2. **高风险区域巡查**: 对检测到的高风险区域增加巡查频次，特别是在降雪或融雪后。

3. **结冰区域处理**: 对高结冰风险区域（北向坡、汇水区域）进行重点防滑处理。

4. **客流疏导**: 在客流密度高的区域设置警示标识，必要时进行客流疏导。

---

**报告结束**

*本报告由雪道隐患巡检沙盘系统自动生成*
`;

    return markdown;
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

  exportAndDownloadReport(exportData) {
    const markdown = this.exportMarkdownReport(exportData);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `巡检报告_${timestamp}_${exportData.project?.name || '未命名'}.md`;
    
    this.downloadFile(markdown, filename, 'text/markdown');
    return markdown;
  }

  exportAndDownloadJSON(hazards, options = {}) {
    const json = this.exportHazardsJSON(hazards, options);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `隐患标注_${timestamp}.json`;
    
    this.downloadFile(json, filename, 'application/json');
    return json;
  }

  importJSON(jsonString) {
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      
      if (data.hazards && Array.isArray(data.hazards)) {
        return {
          hazards: data.hazards,
          routeWaypoints: data.routeWaypoints || [],
          metadata: {
            importTime: new Date().toISOString(),
            version: data.version
          }
        };
      } else {
        throw new Error('JSON格式不正确，缺少 hazards 数组');
      }
    } catch (error) {
      throw new Error('JSON解析失败: ' + error.message);
    }
  }

  clearAllData() {
    localStorage.removeItem(this.storageKey);
    this.currentProjectId = null;
  }
}
