import { GeoCalculator } from './geo.js';
import { RiskTypeNames } from './riskEngine.js';

export class ImportExport {
  constructor() {
    this.geoCalculator = new GeoCalculator();
  }

  async readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  async readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(file);
    });
  }

  downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  downloadAsMarkdown(options) {
    const { sessionData, riskEvents, includeAnnotations = true } = options;
    
    if (!sessionData) {
      throw new Error('没有可导出的会话数据');
    }
    
    const markdown = this.generateMarkdownReport(sessionData, riskEvents, includeAnnotations);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `巡检复盘报告_${timestamp}.md`;
    
    this.downloadFile(markdown, filename, 'text/markdown');
    return markdown;
  }

  generateMarkdownReport(sessionData, riskEvents, includeAnnotations = true) {
    const { track, weather, noFlyZones, alerts } = sessionData;
    const events = riskEvents || [];
    
    const criticalEvents = events.filter(e => e.level === 'critical' && !e.isManual);
    const warningEvents = events.filter(e => e.level === 'warning' && !e.isManual);
    const infoEvents = events.filter(e => e.level === 'info' && !e.isManual);
    const manualEvents = events.filter(e => e.isManual);
    
    let md = `# 无人机巡检复盘报告\n\n`;
    
    md += `## 基本信息\n\n`;
    md += `- **报告生成时间**: ${new Date().toLocaleString('zh-CN')}\n`;
    
    if (track) {
      md += `- **飞行时间范围**: ${this.geoCalculator.formatDateTime(track.startTime)} - ${this.geoCalculator.formatDateTime(track.endTime)}\n`;
      md += `- **总飞行时长**: ${this.geoCalculator.formatDuration(track.duration)}\n`;
      md += `- **轨迹点数量**: ${track.pointCount}\n`;
    }
    
    if (weather) {
      md += `- **气象记录数**: ${weather.recordCount}\n`;
    }
    
    if (noFlyZones) {
      md += `- **禁飞区数量**: ${noFlyZones.featureCount}\n`;
    }
    
    if (alerts) {
      md += `- **告警点数量**: ${alerts.featureCount}\n`;
    }
    
    md += `\n---\n\n`;
    
    md += `## 风险事件统计\n\n`;
    md += `| 级别 | 数量 | 说明 |\n`;
    md += `|------|------|------|\n`;
    md += `| 🔴 严重 | ${criticalEvents.length} | 必须立即处理的严重问题 |\n`;
    md += `| 🟡 警告 | ${warningEvents.length} | 需要关注的潜在问题 |\n`;
    md += `| 🔵 信息 | ${infoEvents.length} | 一般性提示信息 |\n`;
    
    if (includeAnnotations && manualEvents.length > 0) {
      md += `| 🟣 人工标注 | ${manualEvents.length} | 巡检人员添加的标注 |\n`;
    }
    
    md += `\n---\n\n`;
    
    if (criticalEvents.length > 0) {
      md += `## 🔴 严重事件\n\n`;
      
      for (const event of criticalEvents) {
        md += `### ${RiskTypeNames[event.type] || '未知事件'}\n\n`;
        md += `- **时间**: ${this.geoCalculator.formatDateTime(event.timestamp)}\n`;
        md += `- **位置**: ${event.position?.latitude?.toFixed(6)}°N, ${event.position?.longitude?.toFixed(6)}°E\n`;
        md += `- **描述**: ${event.description}\n`;
        
        if (event.details) {
          md += `- **详细信息**:\n`;
          if (event.details.speed !== undefined) {
            md += `  - 速度: ${event.details.speed.toFixed(2)} m/s`;
            if (event.details.limit !== undefined) {
              md += ` (限制: ${event.details.limit} m/s)`;
            }
            md += `\n`;
          }
          if (event.details.windAngle !== undefined) {
            md += `  - 风航夹角: ${event.details.windAngle.toFixed(1)}°\n`;
            md += `  - 航向: ${event.details.heading?.toFixed(1)}°\n`;
            md += `  - 风向: ${event.details.windDirection?.toFixed(1)}°\n`;
            if (event.details.windSpeed !== undefined) {
              md += `  - 风速: ${event.details.windSpeed.toFixed(1)} m/s\n`;
            }
          }
          if (event.details.gimbalPitch !== undefined) {
            md += `  - 云台俯仰角: ${event.details.gimbalPitch.toFixed(1)}°\n`;
          }
          if (event.details.zoneName) {
            md += `  - 禁飞区: ${event.details.zoneName}\n`;
            if (event.details.distance !== undefined) {
              md += `  - 距离: ${this.geoCalculator.formatDistance(event.details.distance)}\n`;
            }
          }
          if (event.details.alertName) {
            md += `  - 告警点: ${event.details.alertName}\n`;
            if (event.details.distance !== undefined) {
              md += `  - 距离: ${this.geoCalculator.formatDistance(event.details.distance)}\n`;
            }
          }
        }
        md += `\n`;
      }
    }
    
    if (warningEvents.length > 0) {
      md += `## 🟡 警告事件\n\n`;
      
      for (const event of warningEvents) {
        md += `### ${RiskTypeNames[event.type] || '未知事件'}\n\n`;
        md += `- **时间**: ${this.geoCalculator.formatDateTime(event.timestamp)}\n`;
        md += `- **位置**: ${event.position?.latitude?.toFixed(6)}°N, ${event.position?.longitude?.toFixed(6)}°E\n`;
        md += `- **描述**: ${event.description}\n\n`;
      }
    }
    
    if (infoEvents.length > 0) {
      md += `## 🔵 信息事件\n\n`;
      
      for (const event of infoEvents) {
        md += `- **[${RiskTypeNames[event.type] || '未知'}]** ${this.geoCalculator.formatTime(event.timestamp)} - ${event.description}\n`;
      }
      md += `\n`;
    }
    
    if (includeAnnotations && manualEvents.length > 0) {
      md += `## 🟣 人工标注\n\n`;
      
      for (const event of manualEvents) {
        md += `### 标注 (${this.getLevelName(event.level)})\n\n`;
        md += `- **时间**: ${this.geoCalculator.formatDateTime(event.timestamp)}\n`;
        md += `- **位置**: ${event.position?.latitude?.toFixed(6)}°N, ${event.position?.longitude?.toFixed(6)}°E\n`;
        md += `- **描述**: ${event.description}\n\n`;
      }
    }
    
    md += `---\n\n`;
    md += `## 巡检结论\n\n`;
    
    if (criticalEvents.length > 0) {
      md += `⚠️ **本次巡检发现 ${criticalEvents.length} 个严重问题，需要立即处理。**\n\n`;
      md += `建议措施：\n`;
      md += `- 立即核实所有严重事件的真实性\n`;
      md += `- 检查是否存在设备故障或操作失误\n`;
      md += `- 评估是否需要重新巡检\n\n`;
    } else if (warningEvents.length > 0) {
      md += `⚠️ **本次巡检发现 ${warningEvents.length} 个警告，建议关注。**\n\n`;
      md += `建议措施：\n`;
      md += `- 记录警告事件，供后续分析\n`;
      md += `- 在下一次巡检中重点关注相关区域\n\n`;
    } else {
      md += `✅ **本次巡检未发现严重风险事件，整体情况良好。**\n\n`;
    }
    
    md += `---\n\n`;
    md += `*此报告由风场航迹黑匣子自动生成*\n`;
    
    return md;
  }

  downloadAsCSV(options) {
    const { riskEvents, includeAnnotations = true } = options;
    
    if (!riskEvents || riskEvents.length === 0) {
      throw new Error('没有可导出的风险事件');
    }
    
    const events = includeAnnotations ? riskEvents : riskEvents.filter(e => !e.isManual);
    
    if (events.length === 0) {
      throw new Error('没有符合条件的风险事件可导出');
    }
    
    const csv = this.generateCSV(events);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `风险事件清单_${timestamp}.csv`;
    
    this.downloadFile('\uFEFF' + csv, filename, 'text/csv;charset=utf-8');
    return csv;
  }

  generateCSV(events) {
    const headers = [
      '序号',
      '事件类型',
      '级别',
      '时间',
      '纬度',
      '经度',
      '高度(m)',
      '描述',
      '详细信息',
      '是否人工标注'
    ];
    
    const rows = [headers.join(',')];
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const row = [
        i + 1,
        this.escapeCSV(RiskTypeNames[event.type] || '未知'),
        this.escapeCSV(this.getLevelName(event.level)),
        this.escapeCSV(this.geoCalculator.formatDateTime(event.timestamp)),
        event.position?.latitude?.toFixed(6) || '',
        event.position?.longitude?.toFixed(6) || '',
        event.position?.altitude?.toFixed(1) || '',
        this.escapeCSV(event.description || ''),
        this.escapeCSV(this.formatDetails(event.details)),
        event.isManual ? '是' : '否'
      ];
      rows.push(row.join(','));
    }
    
    return rows.join('\n');
  }

  formatDetails(details) {
    if (!details) return '';
    
    const parts = [];
    
    if (details.speed !== undefined) {
      parts.push(`速度: ${details.speed.toFixed(2)}m/s`);
    }
    if (details.windAngle !== undefined) {
      parts.push(`风航夹角: ${details.windAngle.toFixed(1)}°`);
    }
    if (details.windSpeed !== undefined) {
      parts.push(`风速: ${details.windSpeed.toFixed(1)}m/s`);
    }
    if (details.gimbalPitch !== undefined) {
      parts.push(`云台俯仰: ${details.gimbalPitch.toFixed(1)}°`);
    }
    if (details.zoneName) {
      parts.push(`禁飞区: ${details.zoneName}`);
    }
    if (details.distance !== undefined) {
      parts.push(`距离: ${details.distance.toFixed(1)}m`);
    }
    if (details.alertName) {
      parts.push(`告警点: ${details.alertName}`);
    }
    
    return parts.join('; ');
  }

  escapeCSV(value) {
    if (value === null || value === undefined) return '';
    
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  getLevelName(level) {
    switch (level) {
      case 'critical': return '严重';
      case 'warning': return '警告';
      case 'info': return '信息';
      default: return level;
    }
  }

  exportSession(sessionData) {
    const exportData = {
      version: '1.0',
      exportedAt: Date.now(),
      data: {
        track: sessionData.track ? {
          points: sessionData.track.points,
          startTime: sessionData.track.startTime,
          endTime: sessionData.track.endTime,
          duration: sessionData.track.duration,
          pointCount: sessionData.track.pointCount
        } : null,
        weather: sessionData.weather,
        noFlyZones: sessionData.noFlyZones,
        alerts: sessionData.alerts
      },
      riskEngine: sessionData.riskEngine ? sessionData.riskEngine.export() : null
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  importSession(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      
      if (data.version !== '1.0') {
        console.warn(`Unknown session version: ${data.version}`);
      }
      
      return {
        track: data.data?.track,
        weather: data.data?.weather,
        noFlyZones: data.data?.noFlyZones,
        alerts: data.data?.alerts,
        riskEngineData: data.riskEngine
      };
    } catch (error) {
      console.error('Failed to import session:', error);
      throw new Error(`会话导入失败: ${error.message}`);
    }
  }

  downloadSession(sessionData) {
    const json = this.exportSession(sessionData);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `会话数据_${timestamp}.json`;
    
    this.downloadFile(json, filename, 'application/json');
  }

  async importFromFiles(files) {
    const result = {
      track: null,
      weather: null,
      noFlyZones: null,
      alerts: null,
      errors: []
    };
    
    for (const file of files) {
      const fileName = file.name.toLowerCase();
      
      try {
        const content = await this.readFileAsText(file);
        
        if (fileName.endsWith('.json')) {
          try {
            const jsonData = JSON.parse(content);
            
            if (jsonData.version && jsonData.data) {
              const sessionData = this.importSession(content);
              result.track = sessionData.track;
              result.weather = sessionData.weather;
              result.noFlyZones = sessionData.noFlyZones;
              result.alerts = sessionData.alerts;
              result.sessionData = sessionData;
            } else if (jsonData.points || Array.isArray(jsonData)) {
              result.track = { raw: jsonData, fileName: file.name };
            } else if (jsonData.type === 'FeatureCollection') {
              if (this.isLikelyNoFlyZone(jsonData)) {
                result.noFlyZones = { raw: jsonData, fileName: file.name };
              } else {
                result.alerts = { raw: jsonData, fileName: file.name };
              }
            } else {
              result.track = { raw: jsonData, fileName: file.name };
            }
          } catch (e) {
            result.errors.push(`文件 ${file.name} 解析失败: ${e.message}`);
          }
        } else if (fileName.endsWith('.csv')) {
          result.weather = { raw: content, fileName: file.name };
        } else if (fileName.endsWith('.geojson')) {
          try {
            const jsonData = JSON.parse(content);
            if (this.isLikelyNoFlyZone(jsonData)) {
              result.noFlyZones = { raw: jsonData, fileName: file.name };
            } else {
              result.alerts = { raw: jsonData, fileName: file.name };
            }
          } catch (e) {
            result.errors.push(`GeoJSON文件 ${file.name} 解析失败: ${e.message}`);
          }
        }
      } catch (error) {
        result.errors.push(`读取文件 ${file.name} 失败: ${error.message}`);
      }
    }
    
    return result;
  }

  isLikelyNoFlyZone(featureCollection) {
    if (!featureCollection || !featureCollection.features) return false;
    
    for (const feature of featureCollection.features) {
      const geometry = feature.geometry;
      if (geometry && (
        geometry.type === 'Polygon' ||
        geometry.type === 'MultiPolygon' ||
        geometry.type === 'Circle'
      )) {
        return true;
      }
    }
    
    return false;
  }
}

export default ImportExport;
