const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

const EXPORT_DIR = path.join(__dirname, '../../exports');

class Exporter {
  constructor() {
    this.ensureExportDir();
  }

  ensureExportDir() {
    if (!fs.existsSync(EXPORT_DIR)) {
      fs.mkdirSync(EXPORT_DIR, { recursive: true });
    }
  }

  generateMarkdownReport(analysisResults, options = {}) {
    const { 
      title = '潮汐车堆预警台 - 调度分析简报',
      generatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss'),
      operator = '系统自动生成'
    } = options;

    const { 
      stations = [], 
      riskStations = [], 
      suggestions = [],
      bikeClusters = [],
      anomalies = [],
      workOrders = []
    } = analysisResults;

    const criticalStations = riskStations.filter(s => s.risk_level === 'CRITICAL');
    const highRiskStations = riskStations.filter(s => s.risk_level === 'HIGH');
    const mediumRiskStations = riskStations.filter(s => s.risk_level === 'MEDIUM');

    const transferSuggestions = suggestions.filter(s => s.type === 'TRANSFER');
    const supplySuggestions = suggestions.filter(s => s.type === 'SUPPLY');
    const removeSuggestions = suggestions.filter(s => s.type === 'REMOVE');
    const abandonedSuggestions = suggestions.filter(s => s.type === 'ABANDONED');

    let markdown = `# ${title}\n\n`;
    markdown += `> 生成时间: ${generatedAt}\n`;
    markdown += `> 操作员: ${operator}\n\n`;
    markdown += `---\n\n`;

    markdown += `## 一、风险概览\n\n`;
    markdown += `| 指标 | 数值 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 总站点数 | ${stations.length} |\n`;
    markdown += `| 极高风险站点 | ${criticalStations.length} |\n`;
    markdown += `| 高风险站点 | ${highRiskStations.length} |\n`;
    markdown += `| 中风险站点 | ${mediumRiskStations.length} |\n`;
    markdown += `| 发现异常GPS点 | ${anomalies.length || 0} |\n`;
    markdown += `| 发现车辆堆积群 | ${bikeClusters.length || 0} |\n`;
    markdown += `| 待处理工单 | ${workOrders.length || 0} |\n\n`;

    if (criticalStations.length > 0) {
      markdown += `### 1.1 极高风险站点 (立即处理)\n\n`;
      markdown += `| 站点名称 | 现状 | 风险类型 | 风险分数 |\n`;
      markdown += `|----------|------|----------|----------|\n`;
      
      criticalStations.forEach(s => {
        const statusText = `${s.total_available}/${s.capacity} (${(s.utilization_rate * 100).toFixed(1)}%)`;
        const gapTypeText = this.getGapTypeText(s.gap_type);
        markdown += `| ${s.station_name} | ${statusText} | ${gapTypeText} | ${s.risk_score} |\n`;
      });
      markdown += `\n`;
    }

    if (highRiskStations.length > 0) {
      markdown += `### 1.2 高风险站点 (优先处理)\n\n`;
      markdown += `| 站点名称 | 现状 | 风险类型 | 风险分数 |\n`;
      markdown += `|----------|------|----------|----------|\n`;
      
      highRiskStations.slice(0, 10).forEach(s => {
        const statusText = `${s.total_available}/${s.capacity} (${(s.utilization_rate * 100).toFixed(1)}%)`;
        const gapTypeText = this.getGapTypeText(s.gap_type);
        markdown += `| ${s.station_name} | ${statusText} | ${gapTypeText} | ${s.risk_score} |\n`;
      });
      
      if (highRiskStations.length > 10) {
        markdown += `\n> 还有 ${highRiskStations.length - 10} 个高风险站点，请查看详细列表\n`;
      }
      markdown += `\n`;
    }

    markdown += `## 二、调度建议\n\n`;

    if (transferSuggestions.length > 0) {
      markdown += `### 2.1 站点间调运\n\n`;
      markdown += `| 优先级 | 从站点 | 到站点 | 调运数量 | 预计距离 | 原因 |\n`;
      markdown += `|--------|--------|--------|----------|----------|------|\n`;
      
      transferSuggestions.forEach(s => {
        markdown += `| ${s.priority} | ${s.from_station.name} | ${s.to_station.name} | ${s.bikes_to_transfer}辆 | ${s.estimated_distance}米 | ${s.reason} |\n`;
      });
      markdown += `\n`;
    }

    if (supplySuggestions.length > 0) {
      markdown += `### 2.2 车场补车\n\n`;
      markdown += `| 优先级 | 目标站点 | 需补车辆数 | 原因 |\n`;
      markdown += `|--------|----------|------------|------|\n`;
      
      supplySuggestions.forEach(s => {
        markdown += `| ${s.priority} | ${s.station.name} | ${s.bikes_needed}辆 | ${s.reason} |\n`;
      });
      markdown += `\n`;
    }

    if (removeSuggestions.length > 0) {
      markdown += `### 2.3 移车入场\n\n`;
      markdown += `| 优先级 | 站点 | 需移车辆数 | 原因 |\n`;
      markdown += `|--------|------|------------|------|\n`;
      
      removeSuggestions.forEach(s => {
        markdown += `| ${s.priority} | ${s.station.name} | ${s.bikes_to_remove}辆 | ${s.reason} |\n`;
      });
      markdown += `\n`;
    }

    if (abandonedSuggestions.length > 0) {
      markdown += `### 2.4 疑似遗弃车辆\n\n`;
      const totalAbandoned = abandonedSuggestions.reduce((sum, s) => sum + s.abandoned_bikes.length, 0);
      markdown += `共发现 ${totalAbandoned} 辆疑似遗弃车辆：\n\n`;
      
      abandonedSuggestions.forEach(s => {
        markdown += `**${s.station.name}** (${s.abandoned_bikes.length}辆):\n`;
        s.abandoned_bikes.slice(0, 5).forEach(bike => {
          markdown += `- ${bike.bike_id} (闲置 ${bike.idle_hours} 小时)\n`;
        });
        if (s.abandoned_bikes.length > 5) {
          markdown += `- ... 还有 ${s.abandoned_bikes.length - 5} 辆\n`;
        }
        markdown += `\n`;
      });
    }

    if (bikeClusters && bikeClusters.length > 0) {
      markdown += `## 三、车辆堆积群\n\n`;
      markdown += `| 堆积群ID | 车辆数 | 是否靠近站点 | 风险等级 | 中心坐标 |\n`;
      markdown += `|----------|--------|--------------|----------|----------|\n`;
      
      bikeClusters.forEach(c => {
        markdown += `| ${c.id} | ${c.size} | ${c.is_near_station ? '是' : '否'} | ${c.risk_level} | (${c.centroid.lat.toFixed(4)}, ${c.centroid.lon.toFixed(4)}) |\n`;
      });
      markdown += `\n`;
    }

    if (anomalies && anomalies.length > 0) {
      markdown += `## 四、异常数据清洗报告\n\n`;
      const anomalyTypes = {};
      anomalies.forEach(a => {
        a.anomaly_types.forEach(type => {
          anomalyTypes[type] = (anomalyTypes[type] || 0) + 1;
        });
      });
      
      markdown += `本次共清洗 ${anomalies.length} 条异常GPS数据：\n\n`;
      markdown += `| 异常类型 | 数量 |\n`;
      markdown += `|----------|------|\n`;
      Object.entries(anomalyTypes).forEach(([type, count]) => {
        markdown += `| ${this.getAnomalyTypeText(type)} | ${count} |\n`;
      });
      markdown += `\n`;
    }

    markdown += `---\n\n`;
    markdown += `## 五、操作建议\n\n`;
    markdown += `1. **立即处理**: 极高风险站点的爆仓/缺车问题\n`;
    markdown += `2. **优先处理**: 高风险站点的调度任务\n`;
    markdown += `3. **同步处理**: 疑似遗弃车辆的回收\n`;
    markdown += `4. **后续跟进**: 维修工单的处理进度\n\n`;

    markdown += `---\n\n`;
    markdown += `*此报告由潮汐车堆预警台自动生成，仅供内部调度使用*\n`;

    return markdown;
  }

  getGapTypeText(gapType) {
    const mapping = {
      'CRITICAL_OVERFLOW': '严重爆仓',
      'OVERFLOW': '爆仓',
      'NORMAL_HIGH': '偏高',
      'NORMAL': '正常',
      'LOW': '偏低',
      'CRITICAL_SHORTAGE': '严重缺车'
    };
    return mapping[gapType] || gapType;
  }

  getAnomalyTypeText(type) {
    const mapping = {
      'LOW_ACCURACY': 'GPS精度过低',
      'INVALID_COORDINATES': '坐标无效',
      'NULL_ISLAND': '坐标为(0,0)',
      'STATISTICAL_OUTLIER': '位置异常偏离'
    };
    return mapping[type] || type;
  }

  generateDispatchCSV(suggestions, options = {}) {
    const { generatedAt = dayjs().format('YYYY-MM-DD') } = options;
    
    const rows = [];
    
    rows.push([
      '任务类型',
      '优先级',
      '源站点ID',
      '源站点名称',
      '源站点纬度',
      '源站点经度',
      '目标站点ID',
      '目标站点名称',
      '目标站点纬度',
      '目标站点经度',
      '车辆数量',
      '预计距离(米)',
      '任务说明',
      '创建时间'
    ]);

    suggestions.forEach(s => {
      const row = [];
      
      switch (s.type) {
        case 'TRANSFER':
          row.push('站点间调运');
          row.push(s.priority);
          row.push(s.from_station.id);
          row.push(s.from_station.name);
          row.push(s.from_station.latitude);
          row.push(s.from_station.longitude);
          row.push(s.to_station.id);
          row.push(s.to_station.name);
          row.push(s.to_station.latitude);
          row.push(s.to_station.longitude);
          row.push(s.bikes_to_transfer);
          row.push(s.estimated_distance);
          row.push(s.reason);
          break;
        case 'SUPPLY':
          row.push('车场补车');
          row.push(s.priority);
          row.push('车场');
          row.push('车场');
          row.push('');
          row.push('');
          row.push(s.station.id);
          row.push(s.station.name);
          row.push(s.station.latitude);
          row.push(s.station.longitude);
          row.push(s.bikes_needed);
          row.push('');
          row.push(s.reason);
          break;
        case 'REMOVE':
          row.push('移车入场');
          row.push(s.priority);
          row.push(s.station.id);
          row.push(s.station.name);
          row.push(s.station.latitude);
          row.push(s.station.longitude);
          row.push('车场');
          row.push('车场');
          row.push('');
          row.push('');
          row.push(s.bikes_to_remove);
          row.push('');
          row.push(s.reason);
          break;
        case 'ABANDONED':
          row.push('遗弃车辆回收');
          row.push(s.priority);
          row.push(s.station.id);
          row.push(s.station.name);
          row.push(s.station.latitude);
          row.push(s.station.longitude);
          row.push('车场');
          row.push('车场');
          row.push('');
          row.push('');
          row.push(s.abandoned_bikes.length);
          row.push('');
          row.push(s.reason);
          break;
        default:
          return;
      }
      
      row.push(generatedAt);
      rows.push(row);
    });

    return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  async saveMarkdownReport(analysisResults, options = {}) {
    const { filename = null } = options;
    const actualFilename = filename || `report_${dayjs().format('YYYYMMDD_HHmmss')}.md`;
    const filepath = path.join(EXPORT_DIR, actualFilename);
    
    const markdown = this.generateMarkdownReport(analysisResults, options);
    
    await fs.promises.writeFile(filepath, markdown, 'utf-8');
    
    return {
      filename: actualFilename,
      filepath: filepath,
      size: markdown.length
    };
  }

  async saveDispatchCSV(suggestions, options = {}) {
    const { filename = null } = options;
    const actualFilename = filename || `dispatch_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    const filepath = path.join(EXPORT_DIR, actualFilename);
    
    const csvContent = this.generateDispatchCSV(suggestions, options);
    
    await fs.promises.writeFile(filepath, csvContent, 'utf-8');
    
    return {
      filename: actualFilename,
      filepath: filepath,
      size: csvContent.length
    };
  }

  async listExports() {
    if (!fs.existsSync(EXPORT_DIR)) {
      return [];
    }
    
    const files = fs.readdirSync(EXPORT_DIR);
    
    return files.map(f => {
      const stat = fs.statSync(path.join(EXPORT_DIR, f));
      return {
        filename: f,
        filepath: path.join(EXPORT_DIR, f),
        size: stat.size,
        created_at: stat.birthtimeMs,
        type: f.endsWith('.md') ? 'markdown' : (f.endsWith('.csv') ? 'csv' : 'unknown')
      };
    }).sort((a, b) => b.created_at - a.created_at);
  }
}

module.exports = new Exporter();
