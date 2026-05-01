const fs = require('fs');
const readline = require('readline');
const path = require('path');

class TraceParser {
  constructor(options = {}) {
    this.options = {
      handleDuplicates: options.handleDuplicates || 'warn',
      strict: options.strict !== false,
      ...options
    };
  }

  async parse(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.jsonl') {
      return this.parseJSONL(filePath);
    } else if (ext === '.json') {
      return this.parseJSONArray(filePath);
    } else {
      return this.tryParseUnknownFormat(filePath);
    }
  }

  async parseJSONL(filePath) {
    const entries = [];
    const lineNumbers = [];
    const toolCallIds = new Map();
    let lineNumber = 0;

    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, 'utf-8'),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      lineNumber++;
      const trimmedLine = line.trim();
      
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      try {
        const entry = JSON.parse(trimmedLine);
        const normalizedEntry = this.normalizeEntry(entry, lineNumber);
        
        if (normalizedEntry.tool_call_id) {
          if (toolCallIds.has(normalizedEntry.tool_call_id)) {
            const result = this.handleDuplicateCall(
              normalizedEntry,
              toolCallIds.get(normalizedEntry.tool_call_id),
              lineNumber
            );
            if (result.keep) {
              entries.push(normalizedEntry);
              lineNumbers.push(lineNumber);
            }
            if (result.replace) {
              const existingIndex = entries.findIndex(e => 
                e.tool_call_id === normalizedEntry.tool_call_id
              );
              if (existingIndex !== -1) {
                entries[existingIndex] = normalizedEntry;
              }
            }
          } else {
            toolCallIds.set(normalizedEntry.tool_call_id, {
              entry: normalizedEntry,
              lineNumber
            });
            entries.push(normalizedEntry);
            lineNumbers.push(lineNumber);
          }
        } else {
          entries.push(normalizedEntry);
          lineNumbers.push(lineNumber);
        }
      } catch (error) {
        if (this.options.strict) {
          throw new Error(`JSONL 解析错误 (第 ${lineNumber} 行): ${error.message}`);
        }
        console.warn(`警告: 跳过无效的 JSON 行 (第 ${lineNumber} 行): ${error.message}`);
      }
    }

    return this.buildTraceResult(entries, lineNumbers, filePath);
  }

  async parseJSONArray(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    let data;
    
    try {
      data = JSON.parse(content);
    } catch (error) {
      throw new Error(`JSON 解析错误 (${filePath}): ${error.message}`);
    }

    if (!Array.isArray(data)) {
      throw new Error(`JSON 文件必须是数组格式 (${filePath})`);
    }

    const entries = [];
    const toolCallIds = new Map();
    const lineNumbers = [];

    for (let i = 0; i < data.length; i++) {
      try {
        const entry = data[i];
        const normalizedEntry = this.normalizeEntry(entry, i + 1);
        
        if (normalizedEntry.tool_call_id) {
          if (toolCallIds.has(normalizedEntry.tool_call_id)) {
            const result = this.handleDuplicateCall(
              normalizedEntry,
              toolCallIds.get(normalizedEntry.tool_call_id),
              i + 1
            );
            if (result.keep) {
              entries.push(normalizedEntry);
              lineNumbers.push(i + 1);
            }
            if (result.replace) {
              const existingIndex = entries.findIndex(e => 
                e.tool_call_id === normalizedEntry.tool_call_id
              );
              if (existingIndex !== -1) {
                entries[existingIndex] = normalizedEntry;
              }
            }
          } else {
            toolCallIds.set(normalizedEntry.tool_call_id, {
              entry: normalizedEntry,
              lineNumber: i + 1
            });
            entries.push(normalizedEntry);
            lineNumbers.push(i + 1);
          }
        } else {
          entries.push(normalizedEntry);
          lineNumbers.push(i + 1);
        }
      } catch (error) {
        if (this.options.strict) {
          throw new Error(`JSON 数组解析错误 (索引 ${i}): ${error.message}`);
        }
        console.warn(`警告: 跳过无效的 JSON 条目 (索引 ${i}): ${error.message}`);
      }
    }

    return this.buildTraceResult(entries, lineNumbers, filePath);
  }

  async tryParseUnknownFormat(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    try {
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        return this.parseJSONArray(filePath);
      }
      throw new Error('JSON 不是数组格式');
    } catch (jsonError) {
      try {
        return this.parseJSONL(filePath);
      } catch (jsonlError) {
        throw new Error(`无法解析轨迹文件格式 (${filePath})。尝试了 JSON 数组和 JSONL 都失败了。`);
      }
    }
  }

  normalizeEntry(entry, lineNumber) {
    const normalized = {
      id: entry.id || entry.tool_call_id || `entry-${lineNumber}`,
      tool_call_id: entry.tool_call_id || entry.id || null,
      type: this.determineEntryType(entry),
      timestamp: this.parseTimestamp(entry.timestamp || entry.time || entry.ts),
      tool_name: entry.tool_name || entry.name || entry.tool || null,
      parameters: entry.parameters || entry.params || entry.args || entry.input || {},
      result: entry.result || entry.output || entry.response || null,
      error: entry.error || entry.exception || null,
      success: this.determineSuccess(entry),
      duration_ms: entry.duration_ms || entry.duration || null,
      metadata: entry.metadata || {},
      raw: entry
    };

    if (normalized.type === 'tool_call' && !normalized.tool_name) {
      throw new Error(`工具调用条目缺少 tool_name 字段 (第 ${lineNumber} 行)`);
    }

    if (normalized.type === 'unknown' && this.options.strict) {
      throw new Error(`无法确定条目类型 (第 ${lineNumber} 行)`);
    }

    return normalized;
  }

  determineEntryType(entry) {
    if (entry.type) {
      return entry.type;
    }
    
    if (entry.tool_call_id || entry.tool_name || entry.name) {
      return 'tool_call';
    }
    
    if (entry.error || entry.exception) {
      return 'error';
    }
    
    if (entry.result || entry.output) {
      return 'result';
    }
    
    return 'unknown';
  }

  determineSuccess(entry) {
    if (entry.success !== undefined) {
      return entry.success === true;
    }
    
    if (entry.error || entry.exception) {
      return false;
    }
    
    return entry.result !== undefined || entry.output !== undefined;
  }

  parseTimestamp(timestamp) {
    if (!timestamp) {
      return null;
    }
    
    if (typeof timestamp === 'number') {
      if (timestamp > 1e12) {
        return new Date(timestamp);
      }
      return new Date(timestamp * 1000);
    }
    
    if (typeof timestamp === 'string') {
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    
    return null;
  }

  handleDuplicateCall(newEntry, existing, currentLine) {
    const existingEntry = existing.entry;
    const existingLine = existing.lineNumber;

    const result = {
      keep: false,
      replace: false,
      warning: null
    };

    if (newEntry.error && !existingEntry.error) {
      result.warning = `检测到重试: tool_call_id=${newEntry.tool_call_id}，第 ${existingLine} 行成功，第 ${currentLine} 行失败（可能是重试）`;
      result.keep = true;
    } else if (!newEntry.error && existingEntry.error) {
      result.warning = `检测到重试成功: tool_call_id=${newEntry.tool_call_id}，第 ${existingLine} 行失败，第 ${currentLine} 行成功`;
      result.replace = true;
    } else if (JSON.stringify(newEntry.parameters) !== JSON.stringify(existingEntry.parameters)) {
      result.warning = `检测到参数变化的重复调用: tool_call_id=${newEntry.tool_call_id}，第 ${existingLine} 行 vs 第 ${currentLine} 行`;
      result.keep = true;
    } else if (JSON.stringify(newEntry.result) !== JSON.stringify(existingEntry.result)) {
      result.warning = `检测到非幂等调用: tool_call_id=${newEntry.tool_call_id}，相同参数但不同结果，第 ${existingLine} 行 vs 第 ${currentLine} 行`;
      result.keep = true;
    } else {
      result.warning = `检测到完全重复的调用: tool_call_id=${newEntry.tool_call_id}，第 ${existingLine} 行 vs 第 ${currentLine} 行`;
      
      switch (this.options.handleDuplicates) {
        case 'keep_first':
          result.keep = false;
          break;
        case 'keep_last':
          result.replace = true;
          break;
        case 'keep_all':
          result.keep = true;
          break;
        case 'warn':
        default:
          result.keep = false;
          break;
      }
    }

    if (result.warning) {
      console.warn(result.warning);
    }

    return result;
  }

  buildTraceResult(entries, lineNumbers, filePath) {
    const sortedEntries = [...entries].sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return a.timestamp.getTime() - b.timestamp.getTime();
      }
      return 0;
    });

    const toolCalls = sortedEntries.filter(e => e.type === 'tool_call');
    const errors = sortedEntries.filter(e => e.type === 'error' || !e.success);
    const toolCallIds = new Set(sortedEntries.map(e => e.tool_call_id).filter(Boolean));

    const duplicates = this.findDuplicates(entries);

    return {
      filePath,
      totalEntries: sortedEntries.length,
      toolCalls: toolCalls.length,
      errors: errors.length,
      uniqueToolCallIds: toolCallIds.size,
      entries: sortedEntries,
      duplicates,
      metadata: {
        startTime: this.getEarliestTimestamp(sortedEntries),
        endTime: this.getLatestTimestamp(sortedEntries),
        duration_ms: this.calculateDuration(sortedEntries)
      }
    };
  }

  findDuplicates(entries) {
    const duplicates = [];
    const seen = new Map();

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      
      if (entry.tool_call_id) {
        if (seen.has(entry.tool_call_id)) {
          const firstIndex = seen.get(entry.tool_call_id);
          duplicates.push({
            tool_call_id: entry.tool_call_id,
            firstIndex,
            secondIndex: i,
            firstEntry: entries[firstIndex],
            secondEntry: entry
          });
        } else {
          seen.set(entry.tool_call_id, i);
        }
      }
    }

    return duplicates;
  }

  getEarliestTimestamp(entries) {
    const timestamps = entries
      .map(e => e.timestamp)
      .filter(Boolean);
    
    if (timestamps.length === 0) return null;
    
    return new Date(Math.min(...timestamps.map(t => t.getTime())));
  }

  getLatestTimestamp(entries) {
    const timestamps = entries
      .map(e => e.timestamp)
      .filter(Boolean);
    
    if (timestamps.length === 0) return null;
    
    return new Date(Math.max(...timestamps.map(t => t.getTime())));
  }

  calculateDuration(entries) {
    const start = this.getEarliestTimestamp(entries);
    const end = this.getLatestTimestamp(entries);
    
    if (!start || !end) return null;
    
    return end.getTime() - start.getTime();
  }

  groupByTool(entries) {
    const groups = {};
    
    for (const entry of entries) {
      if (entry.tool_name) {
        if (!groups[entry.tool_name]) {
          groups[entry.tool_name] = [];
        }
        groups[entry.tool_name].push(entry);
      }
    }
    
    return groups;
  }

  filterByResult(entries, success) {
    return entries.filter(e => e.success === success);
  }
}

module.exports = TraceParser;
