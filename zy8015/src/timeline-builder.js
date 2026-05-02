class TimelineBuilder {
  constructor(options = {}) {
    this.options = {
      retryWindowMs: options.retryWindowMs || 30000,
      ...options
    };
  }

  build(traceData) {
    const entries = traceData.entries || [];
    
    const timeline = {
      events: [],
      calls: [],
      errors: [],
      retries: [],
      nonIdempotentRisks: [],
      timeline: []
    };

    for (const entry of entries) {
      const event = this.createEvent(entry);
      timeline.events.push(event);
      
      if (entry.type === 'tool_call') {
        timeline.calls.push(event);
      }
      
      if (!entry.success || entry.error) {
        timeline.errors.push(event);
      }
    }

    timeline.timeline = [...timeline.events].sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return 0;
    });

    timeline.retries = this.detectRetries(timeline.calls);
    timeline.nonIdempotentRisks = this.detectNonIdempotentRisks(timeline.calls);
    timeline.callGroups = this.groupCalls(timeline.calls);
    timeline.statistics = this.calculateStatistics(timeline);

    return timeline;
  }

  createEvent(entry) {
    return {
      id: entry.id,
      tool_call_id: entry.tool_call_id,
      type: entry.type,
      timestamp: entry.timestamp ? entry.timestamp.getTime() : null,
      timestampISO: entry.timestamp ? entry.timestamp.toISOString() : null,
      tool_name: entry.tool_name,
      parameters: entry.parameters,
      result: entry.result,
      error: entry.error,
      success: entry.success,
      duration_ms: entry.duration_ms,
      metadata: entry.metadata,
      raw: entry
    };
  }

  detectRetries(calls) {
    const retries = [];
    const groupedByToolCallId = this.groupByToolCallId(calls);

    for (const [toolCallId, callGroup] of groupedByToolCallId) {
      if (callGroup.length > 1) {
        const sorted = [...callGroup].sort((a, b) => {
          if (a.timestamp && b.timestamp) {
            return a.timestamp - b.timestamp;
          }
          return 0;
        });

        for (let i = 1; i < sorted.length; i++) {
          const previous = sorted[i - 1];
          const current = sorted[i];
          
          const retryInfo = this.analyzeRetry(previous, current, i);
          
          if (retryInfo) {
            retries.push({
              tool_call_id: toolCallId,
              retryNumber: i,
              previous,
              current,
              ...retryInfo
            });
          }
        }
      }
    }

    const groupedByToolAndParams = this.groupByToolAndParams(calls);
    for (const [key, group] of groupedByToolAndParams) {
      if (group.length > 1) {
        const sorted = [...group].sort((a, b) => {
          if (a.timestamp && b.timestamp) {
            return a.timestamp - b.timestamp;
          }
          return 0;
        });

        for (let i = 1; i < sorted.length; i++) {
          const previous = sorted[i - 1];
          const current = sorted[i];
          
          const timeDiff = current.timestamp && previous.timestamp 
            ? current.timestamp - previous.timestamp 
            : Infinity;
          
          if (timeDiff <= this.options.retryWindowMs && 
              !previous.success && 
              current.tool_call_id !== previous.tool_call_id) {
            const existingRetry = retries.find(r => 
              r.current.tool_call_id === current.tool_call_id
            );
            
            if (!existingRetry) {
              retries.push({
                tool_call_id: current.tool_call_id,
                retryNumber: i,
                previous,
                current,
                type: 'implicit_retry',
                reason: '同一工具相同参数在重试窗口内的后续调用，前一次失败',
                timeDiffMs: timeDiff,
                sameParameters: true,
                parametersMatch: true,
                successTransition: current.success
              });
            }
          }
        }
      }
    }

    return retries;
  }

  analyzeRetry(previous, current, retryIndex) {
    const timeDiff = current.timestamp && previous.timestamp 
      ? current.timestamp - previous.timestamp 
      : null;
    
    const parametersMatch = this.compareParameters(
      previous.parameters,
      current.parameters
    );

    const resultMatch = this.compareResults(
      previous.result,
      current.result
    );

    const successTransition = {
      from: previous.success,
      to: current.success
    };

    let type = 'retry';
    let reason = '';

    if (!previous.success && current.success) {
      type = 'successful_retry';
      reason = '重试后成功';
    } else if (!previous.success && !current.success) {
      type = 'failed_retry';
      reason = '重试仍然失败';
    } else if (previous.success && !current.success) {
      type = 'subsequent_failure';
      reason = '首次成功后后续失败';
    } else if (previous.success && current.success) {
      if (!resultMatch) {
        type = 'non_idempotent_retry';
        reason = '相同参数不同结果，可能是非幂等操作';
      } else {
        type = 'duplicate_success';
        reason = '完全重复的成功调用';
      }
    }

    return {
      type,
      reason,
      timeDiffMs: timeDiff,
      parametersMatch,
      resultMatch,
      successTransition,
      previousError: previous.error,
      currentError: current.error
    };
  }

  detectNonIdempotentRisks(calls) {
    const risks = [];
    const groupedByToolAndParams = this.groupByToolAndParams(calls);

    for (const [key, group] of groupedByToolAndParams) {
      if (group.length > 1) {
        const sorted = [...group].sort((a, b) => {
          if (a.timestamp && b.timestamp) {
            return a.timestamp - b.timestamp;
          }
          return 0;
        });

        const successfulCalls = sorted.filter(c => c.success);
        
        if (successfulCalls.length > 1) {
          const results = successfulCalls.map(c => JSON.stringify(c.result));
          const uniqueResults = new Set(results);

          if (uniqueResults.size > 1) {
            risks.push({
              type: 'non_idempotent_result',
              tool_name: successfulCalls[0].tool_name,
              parameters: successfulCalls[0].parameters,
              calls: successfulCalls,
              resultCount: uniqueResults.size,
              examples: this.getResultExamples(successfulCalls),
              risk: '高',
              description: `工具 "${successfulCalls[0].tool_name}" 相同参数返回不同结果，表明非幂等操作`
            });
          }
        }

        const successfulAfterFailed = this.findSuccessfulAfterFailed(sorted);
        if (successfulAfterFailed.length > 0) {
          for (const pair of successfulAfterFailed) {
            risks.push({
              type: 'retry_success_risk',
              tool_name: pair.successful.tool_name,
              parameters: pair.successful.parameters,
              failedCall: pair.failed,
              successfulCall: pair.successful,
              risk: '中',
              description: `工具 "${pair.successful.tool_name}" 失败后重试成功，可能存在竞态条件或暂时性错误`
            });
          }
        }
      }
    }

    const writeOperations = calls.filter(call => this.isLikelyWriteOperation(call));
    const writeGroups = this.groupByToolAndParams(writeOperations);
    
    for (const [key, group] of writeGroups) {
      if (group.length > 1) {
        risks.push({
          type: 'multiple_write_risk',
          tool_name: group[0].tool_name,
          parameters: group[0].parameters,
          calls: group,
          callCount: group.length,
          risk: '高',
          description: `疑似写入操作 "${group[0].tool_name}" 被多次调用，可能导致数据不一致`
        });
      }
    }

    return risks;
  }

  isLikelyWriteOperation(call) {
    const writeKeywords = [
      'create', 'update', 'delete', 'insert', 'remove', 'set',
      'write', 'save', 'store', 'upload', 'send', 'post',
      '创建', '更新', '删除', '修改', '写入', '保存', '发送'
    ];

    const toolName = (call.tool_name || '').toLowerCase();
    
    return writeKeywords.some(keyword => toolName.includes(keyword));
  }

  findSuccessfulAfterFailed(calls) {
    const pairs = [];
    const sorted = [...calls].sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return 0;
    });

    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (!sorted[i].success && sorted[j].success) {
          if (this.compareParameters(sorted[i].parameters, sorted[j].parameters)) {
            pairs.push({
              failed: sorted[i],
              successful: sorted[j]
            });
          }
        }
      }
    }

    return pairs;
  }

  getResultExamples(calls) {
    const examples = [];
    const seen = new Set();

    for (const call of calls) {
      const resultStr = JSON.stringify(call.result);
      if (!seen.has(resultStr)) {
        seen.add(resultStr);
        examples.push({
          timestamp: call.timestampISO,
          result: call.result
        });
      }
    }

    return examples.slice(0, 5);
  }

  groupByToolCallId(calls) {
    const groups = new Map();
    
    for (const call of calls) {
      if (call.tool_call_id) {
        if (!groups.has(call.tool_call_id)) {
          groups.set(call.tool_call_id, []);
        }
        groups.get(call.tool_call_id).push(call);
      }
    }

    return groups;
  }

  groupByToolAndParams(calls) {
    const groups = new Map();
    
    for (const call of calls) {
      const key = `${call.tool_name}:${JSON.stringify(call.parameters)}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(call);
    }

    return groups;
  }

  groupCalls(calls) {
    const byTool = {};
    const byStatus = {
      successful: [],
      failed: [],
      unknown: []
    };

    for (const call of calls) {
      if (!byTool[call.tool_name]) {
        byTool[call.tool_name] = [];
      }
      byTool[call.tool_name].push(call);

      if (call.success === true) {
        byStatus.successful.push(call);
      } else if (call.success === false) {
        byStatus.failed.push(call);
      } else {
        byStatus.unknown.push(call);
      }
    }

    return { byTool, byStatus };
  }

  compareParameters(params1, params2) {
    return JSON.stringify(params1) === JSON.stringify(params2);
  }

  compareResults(result1, result2) {
    return JSON.stringify(result1) === JSON.stringify(result2);
  }

  calculateStatistics(timeline) {
    const { calls, errors, retries, nonIdempotentRisks, callGroups } = timeline;
    
    const successfulCalls = calls.filter(c => c.success);
    const failedCalls = calls.filter(c => !c.success);

    const toolStats = {};
    for (const [toolName, toolCalls] of Object.entries(callGroups.byTool)) {
      const successful = toolCalls.filter(c => c.success);
      const failed = toolCalls.filter(c => !c.success);
      
      const durations = toolCalls
        .map(c => c.duration_ms)
        .filter(Boolean);
      
      toolStats[toolName] = {
        total: toolCalls.length,
        successful: successful.length,
        failed: failed.length,
        successRate: toolCalls.length > 0 
          ? (successful.length / toolCalls.length * 100).toFixed(2) + '%' 
          : '0%',
        avgDurationMs: durations.length > 0 
          ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)
          : null,
        minDurationMs: durations.length > 0 
          ? Math.min(...durations)
          : null,
        maxDurationMs: durations.length > 0 
          ? Math.max(...durations)
          : null
      };
    }

    return {
      totalCalls: calls.length,
      successful: successfulCalls.length,
      failed: failedCalls.length,
      errors: errors.length,
      retries: retries.length,
      nonIdempotentRisks: nonIdempotentRisks.length,
      uniqueTools: Object.keys(callGroups.byTool).length,
      successRate: calls.length > 0 
        ? (successfulCalls.length / calls.length * 100).toFixed(2) + '%' 
        : '0%',
      toolStats
    };
  }

  getTimeSeries(calls, intervalMs = 1000) {
    if (calls.length === 0) return [];

    const sorted = [...calls].sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return 0;
    });

    const minTime = sorted[0].timestamp;
    const maxTime = sorted[sorted.length - 1].timestamp;

    if (!minTime || !maxTime) return [];

    const intervals = [];
    let currentTime = Math.floor(minTime / intervalMs) * intervalMs;

    while (currentTime <= maxTime) {
      const intervalEnd = currentTime + intervalMs;
      const callsInInterval = sorted.filter(c => 
        c.timestamp >= currentTime && c.timestamp < intervalEnd
      );

      intervals.push({
        startTime: currentTime,
        endTime: intervalEnd,
        startTimeISO: new Date(currentTime).toISOString(),
        callCount: callsInInterval.length,
        successful: callsInInterval.filter(c => c.success).length,
        failed: callsInInterval.filter(c => !c.success).length
      });

      currentTime = intervalEnd;
    }

    return intervals;
  }
}

module.exports = TimelineBuilder;
