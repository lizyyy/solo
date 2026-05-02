const fs = require('fs');
const path = require('path');

class ReportExporter {
  constructor(options = {}) {
    this.exportDir = options.exportDir || path.join(process.cwd(), 'exports');
    this.ensureExportDir();
  }

  ensureExportDir() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async exportMarkdown(data, options = {}) {
    const {
      session = null,
      telemetryData = [],
      commandData = [],
      trackData = null,
      tags = [],
      events = [],
      latencyStats = null,
      stateChanges = [],
      emergencyStops = []
    } = data;

    const filename = options.filename || `report_${Date.now()}.md`;
    const filePath = path.join(this.exportDir, filename);

    const markdown = this._generateMarkdown({
      session,
      telemetryData,
      commandData,
      trackData,
      tags,
      events,
      latencyStats,
      stateChanges,
      emergencyStops
    });

    await fs.promises.writeFile(filePath, markdown, 'utf-8');
    
    return {
      filename,
      path: filePath,
      format: 'markdown',
      size: Buffer.from(markdown).length
    };
  }

  async exportCSV(data, options = {}) {
    const {
      telemetryData = [],
      commandData = [],
      tags = []
    } = data;

    const results = {};
    
    if (telemetryData.length > 0) {
      const csv = this._generateTelemetryCSV(telemetryData);
      const filename = options.telemetryFilename || `telemetry_${Date.now()}.csv`;
      const filePath = path.join(this.exportDir, filename);
      await fs.promises.writeFile(filePath, csv, 'utf-8');
      results.telemetry = { filename, path: filePath, format: 'csv' };
    }

    if (commandData.length > 0) {
      const csv = this._generateCommandsCSV(commandData);
      const filename = options.commandsFilename || `commands_${Date.now()}.csv`;
      const filePath = path.join(this.exportDir, filename);
      await fs.promises.writeFile(filePath, csv, 'utf-8');
      results.commands = { filename, path: filePath, format: 'csv' };
    }

    if (tags.length > 0) {
      const csv = this._generateTagsCSV(tags);
      const filename = options.tagsFilename || `tags_${Date.now()}.csv`;
      const filePath = path.join(this.exportDir, filename);
      await fs.promises.writeFile(filePath, csv, 'utf-8');
      results.tags = { filename, path: filePath, format: 'csv' };
    }

    return results;
  }

  async exportJSON(data, options = {}) {
    const filename = options.filename || `report_${Date.now()}.json`;
    const filePath = path.join(this.exportDir, filename);

    const jsonData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      ...data
    };

    const jsonString = JSON.stringify(jsonData, null, 2);
    await fs.promises.writeFile(filePath, jsonString, 'utf-8');

    return {
      filename,
      path: filePath,
      format: 'json',
      size: Buffer.from(jsonString).length
    };
  }

  _generateMarkdown(data) {
    const {
      session,
      telemetryData,
      commandData,
      trackData,
      tags,
      events,
      latencyStats,
      stateChanges,
      emergencyStops
    } = data;

    const lines = [];
    const now = new Date();

    lines.push('# 赛道遥测复盘报告');
    lines.push('');
    lines.push(`**生成时间**: ${now.toISOString()}`);
    lines.push('');

    if (session) {
      lines.push('## 会话信息');
      lines.push('');
      lines.push(`- **会话名称**: ${session.name || '未命名会话'}`);
      lines.push(`- **会话ID**: ${session.id}`);
      lines.push(`- **创建时间**: ${new Date(session.createdAt).toISOString()}`);
      lines.push(`- **运行模式**: ${session.mode === 'replay' ? '历史回放' : '实时接收'}`);
      lines.push(`- **标签数量**: ${tags.length}`);
      lines.push('');
    }

    lines.push('## 概览统计');
    lines.push('');
    lines.push(`- **遥测帧数**: ${telemetryData.length}`);
    lines.push(`- **控制指令数**: ${commandData.length}`);
    lines.push(`- **状态变化次数**: ${stateChanges.length}`);
    lines.push(`- **急停事件数**: ${emergencyStops.length}`);
    lines.push('');

    if (latencyStats && latencyStats.summary) {
      lines.push('## 延迟统计');
      lines.push('');
      lines.push('### 指令确认延迟');
      lines.push(`- **平均延迟**: ${latencyStats.summary.avg_command_ack?.toFixed(2) || '-'} ms`);
      lines.push(`- **最大延迟**: ${latencyStats.summary.max_command_ack || '-'} ms`);
      lines.push(`- **最小延迟**: ${latencyStats.summary.min_command_ack === Infinity ? '-' : latencyStats.summary.min_command_ack} ms`);
      lines.push('');
      lines.push('### 传感器更新间隔');
      lines.push(`- **平均间隔**: ${latencyStats.summary.avg_sensor_update?.toFixed(2) || '-'} ms`);
      lines.push(`- **最大间隔**: ${latencyStats.summary.max_sensor_update || '-'} ms`);
      lines.push(`- **最小间隔**: ${latencyStats.summary.min_sensor_update === Infinity ? '-' : latencyStats.summary.min_sensor_update} ms`);
      lines.push('');

      if (latencyStats.summary.warnings && latencyStats.summary.warnings.length > 0) {
        lines.push('### ⚠️ 延迟警告');
        lines.push('');
        latencyStats.summary.warnings.forEach((warning, idx) => {
          lines.push(`${idx + 1}. **${warning.type}** - ${warning.message}`);
          lines.push(`   - 时间戳: ${new Date(warning.timestamp).toISOString()}`);
          lines.push(`   - 延迟: ${warning.latency} ms`);
          lines.push('');
        });
      }
    }

    if (stateChanges.length > 0) {
      lines.push('## 状态机变化');
      lines.push('');
      lines.push('| 序号 | 时间戳 | 从状态 | 到状态 | 持续时间 |');
      lines.push('|------|--------|--------|--------|----------|');
      
      stateChanges.forEach((change, idx) => {
        const duration = change.duration ? `${change.duration} ms` : '-';
        lines.push(`| ${idx + 1} | ${new Date(change.timestamp).toISOString()} | ${change.from_state} | ${change.to_state} | ${duration} |`);
      });
      lines.push('');
    }

    if (emergencyStops.length > 0) {
      lines.push('## ⚠️ 急停事件');
      lines.push('');
      lines.push('| 序号 | 时间戳 | 序列 | 当前状态 | 位置 |');
      lines.push('|------|--------|------|----------|------|');
      
      emergencyStops.forEach((stop, idx) => {
        const pos = stop.position ? `(${stop.position.x}, ${stop.position.y})` : '-';
        lines.push(`| ${idx + 1} | ${new Date(stop.timestamp).toISOString()} | ${stop.sequence || '-'} | ${stop.state || '-'} | ${pos} |`);
      });
      lines.push('');
    }

    if (tags.length > 0) {
      lines.push('## 复盘标签');
      lines.push('');
      lines.push('| 序号 | 时间戳 | 名称 | 描述 |');
      lines.push('|------|--------|------|------|');
      
      tags.forEach((tag, idx) => {
        lines.push(`| ${idx + 1} | ${new Date(tag.timestamp).toISOString()} | ${tag.name} | ${tag.description || '-'} |`);
      });
      lines.push('');
    }

    if (trackData) {
      lines.push('## 赛道信息');
      lines.push('');
      lines.push(`- **赛道名称**: ${trackData.track_name || '未知'}`);
      lines.push(`- **赛道长度**: ${trackData.track_length || '-'} m`);
      
      if (trackData.checkpoints && trackData.checkpoints.length > 0) {
        lines.push('');
        lines.push('### 检查点');
        lines.push('');
        lines.push('| ID | 类型 | 位置 (x, y) | 描述 |');
        lines.push('|----|------|-------------|------|');
        
        trackData.checkpoints.forEach((cp) => {
          lines.push(`| ${cp.id} | ${cp.type} | (${cp.position.x}, ${cp.position.y}) | ${cp.description || '-'} |`);
        });
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('*此报告由赛道遥测黑匣子系统自动生成*');

    return lines.join('\n');
  }

  _generateTelemetryCSV(telemetryData) {
    const headers = [
      'timestamp',
      'sequence',
      'state',
      'position_x',
      'position_y',
      'position_theta',
      'velocity_linear',
      'velocity_angular',
      'battery',
      'emergency_stop'
    ];

    const lines = [headers.join(',')];

    telemetryData.forEach((frame) => {
      const data = frame.data || frame;
      const row = [
        data.timestamp || frame.timestamp,
        data.sequence || frame.sequence || '',
        data.state || '',
        data.position?.x ?? '',
        data.position?.y ?? '',
        data.position?.theta ?? '',
        data.velocity?.linear ?? '',
        data.velocity?.angular ?? '',
        data.battery ?? '',
        data.emergency_stop ? 'true' : 'false'
      ];
      lines.push(row.map(v => this._escapeCSV(v)).join(','));
    });

    return lines.join('\n');
  }

  _generateCommandsCSV(commandData) {
    const headers = [
      'timestamp',
      'sequence',
      'command_type',
      'linear_vel',
      'angular_vel',
      'status',
      'target_x',
      'target_y',
      'target_theta'
    ];

    const lines = [headers.join(',')];

    commandData.forEach((cmd) => {
      const row = [
        cmd.timestamp,
        cmd.sequence || '',
        cmd.command_type || '',
        cmd.linear_vel ?? '',
        cmd.angular_vel ?? '',
        cmd.status || '',
        cmd.target_x ?? '',
        cmd.target_y ?? '',
        cmd.target_theta ?? ''
      ];
      lines.push(row.map(v => this._escapeCSV(v)).join(','));
    });

    return lines.join('\n');
  }

  _generateTagsCSV(tags) {
    const headers = [
      'id',
      'timestamp',
      'name',
      'description',
      'color',
      'created_at'
    ];

    const lines = [headers.join(',')];

    tags.forEach((tag) => {
      const row = [
        tag.id,
        tag.timestamp,
        tag.name,
        tag.description || '',
        tag.color || '',
        tag.createdAt
      ];
      lines.push(row.map(v => this._escapeCSV(v)).join(','));
    });

    return lines.join('\n');
  }

  _escapeCSV(value) {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  getExportPath() {
    return this.exportDir;
  }
}

module.exports = { ReportExporter };
