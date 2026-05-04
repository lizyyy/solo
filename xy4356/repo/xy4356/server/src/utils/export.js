export function generateChecklistMarkdown(mission) {
  const now = new Date().toISOString().split('T')[0];
  
  let md = `# 无人机飞行前检查单

> 生成时间: ${new Date().toLocaleString('zh-CN')}
> 任务名称: ${mission.name}
> 任务状态: ${getStatusText(mission.status)}

---

## 一、任务基本信息

| 项目 | 内容 |
|------|------|
| 任务名称 | ${mission.name} |
| 任务描述 | ${mission.description || '无'} |
| 航点数量 | ${mission.flightPath?.length || 0} 个 |
| 限制区域 | ${mission.restrictedZones?.features?.length || 0} 个 |
| 使用电池 | ${mission.batteryData?.batteries?.length || 0} 块 |
| 创建时间 | ${new Date(mission.createdAt).toLocaleString('zh-CN')} |

---

## 二、检查结果概览

### 总体评估

**状态: ${getCheckStatusText(mission.summary?.status)}**

${mission.summary?.message || '无检查结果'}

| 检查项 | 数量 |
|--------|------|
| 严重问题 | ${mission.summary?.criticalCount || 0} 项 |
| 警告 | ${mission.summary?.warningCount || 0} 项 |
| 已改判 | ${mission.summary?.overriddenCount || 0} 项 |

---

## 三、详细风险清单

`;

  const criticalRisks = (mission.risks || []).filter(r => r.type === 'critical' && !r.isOverridden);
  const warningRisks = (mission.risks || []).filter(r => r.type === 'warning' && !r.isOverridden);
  const overriddenRisks = (mission.risks || []).filter(r => r.isOverridden);

  if (criticalRisks.length > 0) {
    md += `### 严重问题 (${criticalRisks.length} 项)

> ⚠️ **这些问题必须解决后才能飞行**

`;
    criticalRisks.forEach((risk, index) => {
      md += `#### ${index + 1}. ${risk.title}

**类别**: ${getCategoryText(risk.category)}  
**描述**: ${risk.description}

`;
    });
  }

  if (warningRisks.length > 0) {
    md += `### 警告 (${warningRisks.length} 项)

> ⚡ 这些问题建议关注，部分可改判

`;
    warningRisks.forEach((risk, index) => {
      md += `#### ${index + 1}. ${risk.title}

**类别**: ${getCategoryText(risk.category)}  
**描述**: ${risk.description}  
**可改判**: ${risk.canOverride ? '是' : '否'}

`;
    });
  }

  if (overriddenRisks.length > 0) {
    md += `### 已改判项 (${overriddenRisks.length} 项)

> ✅ 以下问题已由飞手改判放行

`;
    overriddenRisks.forEach((risk, index) => {
      md += `#### ${index + 1}. ${risk.title}

**原类型**: ${risk.type === 'critical' ? '严重' : '警告'}  
**原描述**: ${risk.description}  
**改判理由**: ${risk.overrideReason || '无'}  
**改判时间**: ${risk.overrideTime ? new Date(risk.overrideTime).toLocaleString('zh-CN') : '未知'}

`;
    });
  }

  if ((mission.risks || []).length === 0) {
    md += `### 无风险项

所有检查项均通过，无风险提示。

`;
  }

  md += `---

## 四、飞行参数详情

### 4.1 航线信息

`;

  if (mission.flightPath && mission.flightPath.length > 0) {
    md += `| 航点序号 | 纬度 | 经度 | 高度 (米) |
|----------|------|------|-----------|
`;
    mission.flightPath.forEach((point, index) => {
      md += `| ${index + 1} | ${point.latitude.toFixed(6)}° | ${point.longitude.toFixed(6)}° | ${point.altitude?.toFixed(1) || 0} |
`;
    });
  } else {
    md += `暂无航线数据

`;
  }

  md += `
### 4.2 电池信息

`;

  if (mission.batteryData?.batteries && mission.batteryData.batteries.length > 0) {
    md += `| 电池编号 | 循环次数 | 上次使用 |
|----------|----------|----------|
`;
    mission.batteryData.batteries.forEach(battery => {
      md += `| ${battery.batteryId} | ${battery.cycles} | ${battery.lastUsed || '未知'} |
`;
    });
  } else {
    md += `暂无电池数据

`;
  }

  md += `
### 4.3 天气窗口

`;

  if (mission.weatherWindow) {
    const w = mission.weatherWindow;
    md += `| 项目 | 值 |
|------|-----|
| 日期 | ${w.date || '未设置'} |
| 开始时间 | ${w.startTime || '未设置'} |
| 结束时间 | ${w.endTime || '未设置'} |
| 风速 | ${w.windSpeed !== null ? `${w.windSpeed} m/s` : '未设置'} |
| 能见度 | ${w.visibility !== null ? `${w.visibility} km` : '未设置'} |
| 气温 | ${w.temperature !== null ? `${w.temperature}°C` : '未设置'} |
| 备注 | ${w.notes || '无'} |
`;
  } else {
    md += `暂无天气数据

`;
  }

  md += `
---

## 五、飞手确认

### 5.1 飞手信息

| 项目 | 内容 |
|------|------|
| 飞手姓名 | ${mission.pilotInfo?.name || '未填写'} |
| 执照编号 | ${mission.pilotInfo?.licenseNumber || '未填写'} |
| 联系方式 | ${mission.pilotInfo?.contact || '未填写'} |

### 5.2 飞行器信息

| 项目 | 内容 |
|------|------|
| 型号 | ${mission.aircraftInfo?.model || '未填写'} |
| 序列号 | ${mission.aircraftInfo?.serialNumber || '未填写'} |
| 最大飞行时间 | ${mission.aircraftInfo?.maxFlightTime || 30} 分钟 |

### 5.3 确认签字

> 我已仔细阅读并理解上述检查结果，确认所有风险均已评估完毕。

- [ ] 我确认已完成所有飞行前检查
- [ ] 我确认已了解所有风险项
- [ ] 我确认天气条件适合飞行
- [ ] 我确认设备状态良好

**飞手签字**: _________________

**日期**: _________________

---

## 附录：分析配置参数

以下是本次检查使用的配置参数：

`;

  if (mission.analysisConfig) {
    const cfg = mission.analysisConfig;
    md += `| 参数 | 值 |
|------|-----|
| 最大电池循环次数 | ${cfg.maxBatteryCycles} 次 |
| 最小电池降温时间 | ${cfg.minBatteryCoolingHours} 小时 |
| 高度安全余量 | ${cfg.safetyAltitudeMargin} 米 |
| 返航电量预留 | ${cfg.returnBatteryReserve * 100}% |
| 悬停耗电率 | ${cfg.hoverBatteryPerMinute * 100}%/分钟 |
| 飞行耗电率 | ${cfg.flightBatteryPerKilometer * 100}%/公里 |
| 上升速率 | ${cfg.ascentRate} m/s |
| 下降速率 | ${cfg.descentRate} m/s |
| 风力补偿系数 | ${cfg.windCompensationFactor} |
`;
  } else {
    md += `使用默认配置

`;
  }

  md += `
---

*此检查单由无人机任务预检系统自动生成，仅供参考。飞手应根据实际情况进行最终判断。*
`;

  return md;
}

export function generateAuditPackage(mission) {
  const auditPackage = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    mission: {
      id: mission.id,
      name: mission.name,
      description: mission.description,
      createdAt: mission.createdAt,
      updatedAt: mission.updatedAt,
      status: mission.status
    },
    flightData: {
      flightPath: mission.flightPath || [],
      waypointCount: mission.flightPath?.length || 0,
      restrictedZones: mission.restrictedZones || { type: 'FeatureCollection', features: [] }
    },
    batteryData: mission.batteryData || { batteries: [], rawData: [] },
    weatherWindow: mission.weatherWindow || {},
    pilotInfo: mission.pilotInfo || {},
    aircraftInfo: mission.aircraftInfo || {},
    analysis: {
      summary: mission.summary,
      risks: mission.risks || [],
      config: mission.analysisConfig
    },
    auditTrail: {
      created: mission.createdAt,
      lastModified: mission.updatedAt,
      checkStatus: mission.summary?.status,
      canFly: mission.summary?.canFly
    }
  };

  return auditPackage;
}

function getStatusText(status) {
  const statusMap = {
    'draft': '草稿',
    'ready': '已就绪',
    'needs_attention': '需关注',
    'completed': '已完成',
    'cancelled': '已取消'
  };
  return statusMap[status] || status;
}

function getCheckStatusText(status) {
  const statusMap = {
    'ok': '✅ 通过',
    'warning': '⚠️ 有警告',
    'critical': '❌ 不通过'
  };
  return statusMap[status] || status;
}

function getCategoryText(category) {
  const categoryMap = {
    'boundary': '边界合规',
    'altitude': '高度限制',
    'battery': '电池状态',
    'battery_calc': '电量计算',
    'weather': '天气条件',
    'flight_path': '航线数据'
  };
  return categoryMap[category] || category;
}
