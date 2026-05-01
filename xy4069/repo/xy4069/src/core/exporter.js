export class Exporter {
  static exportMarkdown(state, parserResult, options = {}) {
    const {
      title = '协作冲突复盘报告',
      includeOperations = true,
      includeConflicts = true,
      includeIsolationList = true
    } = options;

    const lines = [];
    
    lines.push(`# ${title}`);
    lines.push('');
    lines.push(`> 生成时间: ${new Date().toISOString()}`);
    lines.push('');

    lines.push('## 一、统计概览');
    lines.push('');
    lines.push('| 指标 | 值 |');
    lines.push('|------|-----|');
    if (parserResult && parserResult.stats) {
      lines.push(`| 总操作数 | ${parserResult.stats.total} |`);
      lines.push(`| 有效操作数 | ${parserResult.stats.valid} |`);
      lines.push(`| 无效操作数 | ${parserResult.stats.invalid} |`);
      lines.push(`| 唯一用户数 | ${parserResult.stats.uniqueUsers} |`);
    }
    if (state.conflicts) {
      lines.push(`| 冲突数 | ${state.conflicts.length} |`);
    }
    if (state.conflictMarkers) {
      lines.push(`| 冲突标记数 | ${state.conflictMarkers.length} |`);
    }
    lines.push(`| 最终文档长度 | ${(state.document || '').length} |`);
    lines.push('');

    lines.push('## 二、最终文档内容');
    lines.push('');
    lines.push('```');
    lines.push(state.document || '(空文档)');
    lines.push('```');
    lines.push('');

    if (includeConflicts && (state.conflicts?.length > 0 || state.conflictMarkers?.length > 0)) {
      lines.push('## 三、冲突详情');
      lines.push('');
      
      const allConflicts = [...(state.conflicts || []), ...(state.conflictMarkers || [])];
      
      if (allConflicts.length === 0) {
        lines.push('无冲突。');
      } else {
        for (let i = 0; i < allConflicts.length; i++) {
          const conflict = allConflicts[i];
          lines.push(`### 冲突 ${i + 1}`);
          lines.push('');
          lines.push(`- **类型**: ${conflict.type || '未知'}`);
          lines.push(`- **消息**: ${conflict.message || '无详细信息'}`);
          if (conflict.operationId) {
            lines.push(`- **操作ID**: ${conflict.operationId}`);
          }
          if (conflict.index !== undefined) {
            lines.push(`- **时间轴位置**: 第 ${conflict.index} 步`);
          }
          if (conflict.timestamp) {
            lines.push(`- **检测时间**: ${conflict.timestamp}`);
          }
          if (conflict.operation) {
            lines.push('');
            lines.push('**相关操作:**');
            lines.push('');
            lines.push('```json');
            lines.push(JSON.stringify(conflict.operation, null, 2));
            lines.push('```');
          }
          lines.push('');
        }
      }
      lines.push('');
    }

    if (includeIsolationList && parserResult?.isolationList?.length > 0) {
      lines.push('## 四、隔离清单（无效操作）');
      lines.push('');
      
      for (let i = 0; i < parserResult.isolationList.length; i++) {
        const item = parserResult.isolationList[i];
        lines.push(`### 隔离项 ${i + 1}`);
        lines.push('');
        lines.push(`- **原索引位置**: 第 ${item.index} 条`);
        lines.push(`- **隔离时间**: ${item.isolatedAt}`);
        lines.push('');
        lines.push('**错误原因:**');
        for (const error of item.errors) {
          lines.push(`- ${error.type}: ${error.message}`);
        }
        lines.push('');
        lines.push('**原始操作数据:**');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(item.rawOperation, null, 2));
        lines.push('```');
        lines.push('');
      }
      lines.push('');
    }

    if (includeOperations && state.operations?.length > 0) {
      lines.push('## 五、操作时序');
      lines.push('');
      
      const uniqueUsers = [...new Set(state.operations.map(op => op.userId))];
      const userColors = {};
      uniqueUsers.forEach((userId, index) => {
        userColors[userId] = `用户 ${index + 1} (${userId})`;
      });

      lines.push('| 步骤 | 用户 | 操作类型 | 版本 | 时间戳 | 结果 |');
      lines.push('|------|------|----------|------|--------|------|');
      
      for (let i = 0; i < state.operations.length; i++) {
        const op = state.operations[i];
        const hasConflict = state.conflictMarkers?.some(m => m.operationId === op.operationId);
        const conflictMarker = hasConflict ? '⚠️ 冲突' : '✓ 成功';
        const userLabel = userColors[op.userId] || op.userId;
        
        lines.push(`| ${i + 1} | ${userLabel} | ${op.type} | v${op.version} | ${op.timestamp} | ${conflictMarker} |`);
      }
      lines.push('');
    }

    if (parserResult?.validationErrors?.length > 0) {
      lines.push('## 六、校验错误');
      lines.push('');
      
      for (const error of parserResult.validationErrors) {
        lines.push(`- **${error.type}**: ${error.message}`);
        if (error.details && Object.keys(error.details).length > 0) {
          lines.push('  - 详情: ' + JSON.stringify(error.details));
        }
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('> 此报告由离线协作冲突回放器生成');

    return lines.join('\n');
  }

  static exportJSON(state, parserResult) {
    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      },
      finalState: {
        document: state.document,
        cursors: state.cursors,
        versionVector: state.versionVector,
        userStates: state.userStates
      },
      statistics: parserResult?.stats || {},
      conflicts: {
        modelConflicts: state.conflicts || [],
        playbackConflicts: state.conflictMarkers || []
      },
      operations: state.operations || [],
      isolationList: parserResult?.isolationList || [],
      validationErrors: parserResult?.validationErrors || []
    };
  }

  static download(data, filename, mimeType = 'text/plain') {
    if (typeof window === 'undefined') {
      return { data, filename, mimeType };
    }
    
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static downloadMarkdown(state, parserResult, filename = 'collab-review.md') {
    const content = this.exportMarkdown(state, parserResult);
    return this.download(content, filename, 'text/markdown');
  }

  static downloadJSON(state, parserResult, filename = 'collab-result.json') {
    const content = JSON.stringify(this.exportJSON(state, parserResult), null, 2);
    return this.download(content, filename, 'application/json');
  }
}
