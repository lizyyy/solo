const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { EVENT_TYPES } = require('./stateMachine');
const { VALIDATION_SEVERITY } = require('./rulesEngine');

class ImportExportService {
  constructor(storageService, rulesEngine) {
    this.storageService = storageService;
    this.rulesEngine = rulesEngine;
  }
  
  importData(stateMachine, data, type) {
    const result = {
      imported: 0,
      errors: [],
      warnings: [],
    };
    
    switch (type) {
      case 'jsonl':
        return this.importJSONL(stateMachine, data, result);
      case 'events':
        return this.importEvents(stateMachine, data, result);
      case 'offer':
        return this.importOffer(stateMachine, data, result);
      case 'answer':
        return this.importAnswer(stateMachine, data, result);
      case 'ice_candidate':
        return this.importIceCandidate(stateMachine, data, result);
      default:
        throw new Error(`Unknown import type: ${type}`);
    }
  }
  
  importJSONL(stateMachine, data, result) {
    const lines = data.split('\n').filter(line => line.trim());
    
    for (let i = 0; i < lines.length; i++) {
      try {
        const jsonLine = lines[i].trim();
        if (!jsonLine) continue;
        
        const event = JSON.parse(jsonLine);
        const processed = this.processImportedEvent(stateMachine, event);
        
        if (processed.error) {
          result.errors.push({ line: i + 1, error: processed.error });
        } else {
          result.imported++;
        }
      } catch (error) {
        result.errors.push({ 
          line: i + 1, 
          error: `JSON parse error: ${error.message}`,
          content: lines[i].substring(0, 100)
        });
      }
    }
    
    return result;
  }
  
  importEvents(stateMachine, events, result) {
    if (!Array.isArray(events)) {
      events = [events];
    }
    
    for (let i = 0; i < events.length; i++) {
      try {
        const processed = this.processImportedEvent(stateMachine, events[i]);
        
        if (processed.error) {
          result.errors.push({ index: i, error: processed.error });
        } else {
          result.imported++;
        }
      } catch (error) {
        result.errors.push({ index: i, error: error.message });
      }
    }
    
    return result;
  }
  
  importOffer(stateMachine, data, result) {
    const event = {
      type: EVENT_TYPES.OFFER,
      sdp: typeof data === 'string' ? data : data.sdp,
      timestamp: data.timestamp || Date.now(),
    };
    
    const processed = this.processImportedEvent(stateMachine, event);
    
    if (processed.error) {
      result.errors.push({ error: processed.error });
    } else {
      result.imported = 1;
    }
    
    return result;
  }
  
  importAnswer(stateMachine, data, result) {
    const event = {
      type: EVENT_TYPES.ANSWER,
      sdp: typeof data === 'string' ? data : data.sdp,
      timestamp: data.timestamp || Date.now(),
    };
    
    const processed = this.processImportedEvent(stateMachine, event);
    
    if (processed.error) {
      result.errors.push({ error: processed.error });
    } else {
      result.imported = 1;
    }
    
    return result;
  }
  
  importIceCandidate(stateMachine, data, result) {
    const event = {
      type: EVENT_TYPES.ICE_CANDIDATE,
      candidate: typeof data === 'string' ? data : data.candidate,
      sdpMid: data.sdpMid,
      sdpMLineIndex: data.sdpMLineIndex,
      timestamp: data.timestamp || Date.now(),
    };
    
    const processed = this.processImportedEvent(stateMachine, event);
    
    if (processed.error) {
      result.errors.push({ error: processed.error });
    } else {
      result.imported = 1;
    }
    
    return result;
  }
  
  processImportedEvent(stateMachine, event) {
    if (!event.type) {
      return { error: 'Event type is required' };
    }
    
    const validTypes = Object.values(EVENT_TYPES);
    if (!validTypes.includes(event.type)) {
      return { error: `Invalid event type: ${event.type}` };
    }
    
    stateMachine.addEvent(event);
    return { success: true };
  }
  
  exportData(stateMachine, format) {
    switch (format) {
      case 'json':
        return this.exportJSON(stateMachine);
      case 'jsonl':
        return this.exportJSONL(stateMachine);
      case 'markdown':
        return this.exportMarkdown(stateMachine);
      case 'audit':
        return this.exportAudit(stateMachine);
      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }
  
  exportJSON(stateMachine) {
    const data = stateMachine.toJSON();
    const validation = this.rulesEngine.validateAll(stateMachine);
    
    return {
      format: 'json',
      data: {
        ...data,
        validation,
        exportedAt: new Date().toISOString(),
      },
    };
  }
  
  exportJSONL(stateMachine) {
    const events = stateMachine.getEvents();
    const jsonlContent = events.map(event => JSON.stringify(event)).join('\n');
    
    return {
      format: 'jsonl',
      data: jsonlContent,
      eventCount: events.length,
    };
  }
  
  exportMarkdown(stateMachine) {
    const sessionInfo = stateMachine.getSessionInfo();
    const stats = stateMachine.getStats();
    const validation = this.rulesEngine.validateAll(stateMachine);
    const events = stateMachine.getEvents();
    const negotiationSequence = stateMachine.getNegotiationSequence();
    const recordingTimeline = stateMachine.getRecordingTimeline();
    const networkInjections = stateMachine.getNetworkInjections();
    const tracks = stateMachine.getTracks();
    
    let markdown = `# WebRTC 故障复盘报告\n\n`;
    
    markdown += `## 基本信息\n\n`;
    markdown += `| 项目 | 值 |\n`;
    markdown += `|------|----|\n`;
    markdown += `| **会话名称** | ${sessionInfo.name} |\n`;
    markdown += `| **会话 ID** | ${sessionInfo.sessionId} |\n`;
    markdown += `| **创建时间** | ${sessionInfo.createdAt} |\n`;
    markdown += `| **最后更新** | ${sessionInfo.updatedAt} |\n`;
    markdown += `| **当前状态** | ${stats.currentState} |\n`;
    markdown += `| **总事件数** | ${stats.totalEvents} |\n`;
    markdown += `| **连接时长** | ${this.formatDuration(stats.connectionDurationMs)} |\n\n`;
    
    markdown += `## 校验结果摘要\n\n`;
    markdown += `| 类型 | 数量 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| **错误** | ${validation.summary.errors} |\n`;
    markdown += `| **警告** | ${validation.summary.warnings} |\n`;
    markdown += `| **信息** | ${validation.summary.infos} |\n\n`;
    
    if (validation.summary.errors > 0 || validation.summary.warnings > 0) {
      markdown += `### 问题详情\n\n`;
      
      for (const rule of validation.rules) {
        if (rule.severity !== VALIDATION_SEVERITY.INFO || !rule.passed) {
          const severityEmoji = {
            [VALIDATION_SEVERITY.ERROR]: '🔴',
            [VALIDATION_SEVERITY.WARNING]: '🟡',
            [VALIDATION_SEVERITY.INFO]: '🟢',
          }[rule.severity];
          
          markdown += `#### ${severityEmoji} ${rule.rule}\n\n`;
          markdown += `- **结果**: ${rule.passed ? '通过' : '失败'}\n`;
          markdown += `- **消息**: ${rule.message}\n`;
          
          if (rule.details && Object.keys(rule.details).length > 0) {
            markdown += `- **详情**: \n\`\`\`json\n${JSON.stringify(rule.details, null, 2)}\n\`\`\`\n`;
          }
          markdown += `\n`;
        }
      }
    }
    
    markdown += `## 连接统计\n\n`;
    markdown += `| 指标 | 值 |\n`;
    markdown += `|------|----|\n`;
    markdown += `| **Offer 数量** | ${stats.offers} |\n`;
    markdown += `| **Answer 数量** | ${stats.answers} |\n`;
    markdown += `| **ICE Candidate 数量** | ${stats.iceCandidates} |\n`;
    markdown += `| **连接成功次数** | ${stats.connectedCount} |\n`;
    markdown += `| **断开连接次数** | ${stats.disconnectedCount} |\n`;
    markdown += `| **连接失败次数** | ${stats.failedCount} |\n`;
    markdown += `| **重连尝试次数** | ${stats.reconnectAttempts} |\n`;
    markdown += `| **音频轨道数** | ${stats.audioTracks} |\n`;
    markdown += `| **视频轨道数** | ${stats.videoTracks} |\n`;
    markdown += `| **录制缺口数** | ${stats.recordingGaps} |\n`;
    markdown += `| **网络注入事件** | ${stats.networkInjections} |\n\n`;
    
    if (negotiationSequence.length > 0) {
      markdown += `## 协商顺序\n\n`;
      markdown += `\`\`\`\n`;
      markdown += negotiationSequence.map((s, i) => 
        `${i + 1}. ${s.type.toUpperCase()} @ ${new Date(s.timestamp).toISOString()}`
      ).join('\n');
      markdown += `\n\`\`\`\n\n`;
    }
    
    if (tracks.length > 0) {
      markdown += `## 媒体轨道\n\n`;
      for (const track of tracks) {
        markdown += `### ${track.kind === 'audio' ? '🔊 音频' : '🎥 视频'} 轨道\n\n`;
        markdown += `- **ID**: ${track.id || 'N/A'}\n`;
        markdown += `- **标签**: ${track.label || 'N/A'}\n`;
        markdown += `- **开始时间**: ${new Date(track.timestamp).toISOString()}\n`;
        
        if (track.audioLevels && track.audioLevels.length > 0) {
          const levels = track.audioLevels.map(l => l.level);
          const avgLevel = levels.reduce((a, b) => a + b, 0) / levels.length;
          const maxLevel = Math.max(...levels);
          const minLevel = Math.min(...levels);
          
          markdown += `- **音量统计**: 平均=${avgLevel.toFixed(3)}, 最大=${maxLevel.toFixed(3)}, 最小=${minLevel.toFixed(3)}\n`;
          markdown += `- **样本数**: ${track.audioLevels.length}\n`;
        }
        markdown += `\n`;
      }
    }
    
    if (recordingTimeline.length > 0) {
      markdown += `## 录制时间线\n\n`;
      for (const item of recordingTimeline) {
        const typeEmoji = {
          'start': '▶️',
          'stop': '⏹️',
          'gap': '⏸️',
        }[item.type];
        
        markdown += `- ${typeEmoji} **${item.type}** @ ${new Date(item.timestamp).toISOString()}`;
        if (item.type === 'gap') {
          markdown += ` (缺口: ${this.formatDuration(item.gapDuration)})`;
        }
        if (item.recordingId) {
          markdown += ` [录制ID: ${item.recordingId}]`;
        }
        markdown += `\n`;
      }
      markdown += `\n`;
    }
    
    if (networkInjections.length > 0) {
      markdown += `## 网络注入事件\n\n`;
      for (const injection of networkInjections) {
        const typeLabel = {
          'latency': '延迟注入',
          'packet_loss': '丢包注入',
          'disconnect': '断网注入',
        }[injection.type] || injection.type;
        
        markdown += `- **${typeLabel}** @ ${new Date(injection.timestamp).toISOString()}\n`;
        if (injection.latency !== undefined) {
          markdown += `  - 延迟: ${injection.latency}ms\n`;
        }
        if (injection.packetLoss !== undefined) {
          markdown += `  - 丢包率: ${(injection.packetLoss * 100).toFixed(1)}%\n`;
        }
        if (injection.duration !== undefined) {
          markdown += `  - 持续时间: ${this.formatDuration(injection.duration)}\n`;
        }
        markdown += `\n`;
      }
    }
    
    markdown += `## 事件时间线\n\n`;
    markdown += `### 最近 20 个事件\n\n`;
    const recentEvents = events.slice(-20);
    
    for (const event of recentEvents) {
      const relativeTime = this.formatDuration(event.relativeTimestamp || 0);
      markdown += `- [+${relativeTime}] **${event.type}**`;
      
      if (event.state) {
        markdown += ` → ${event.state}`;
      }
      if (event.kind) {
        markdown += ` (${event.kind})`;
      }
      markdown += `\n`;
    }
    markdown += `\n`;
    
    markdown += `---\n\n`;
    markdown += `*报告生成时间: ${new Date().toISOString()}*\n`;
    markdown += `*WebRTC Replay Station v1.0*\n`;
    
    return {
      format: 'markdown',
      data: markdown,
      sessionName: sessionInfo.name,
    };
  }
  
  exportAudit(stateMachine) {
    const validation = this.rulesEngine.validateAll(stateMachine);
    const data = stateMachine.toJSON();
    
    return {
      format: 'audit',
      data: {
        id: uuidv4(),
        type: 'audit_package',
        version: '1.0',
        createdAt: new Date().toISOString(),
        
        summary: {
          sessionName: data.sessionInfo?.name,
          sessionId: data.sessionId,
          totalEvents: data.events?.length || 0,
          validationErrors: validation.summary.errors,
          validationWarnings: validation.summary.warnings,
          currentState: data.currentState,
          connectionDurationMs: data.stats?.connectionDurationMs,
        },
        
        sessionData: data,
        validation: validation,
        
        export: {
          markdown: this.exportMarkdown(stateMachine).data,
          jsonl: this.exportJSONL(stateMachine).data,
        },
      },
    };
  }
  
  formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
}

module.exports = {
  ImportExportService,
};
