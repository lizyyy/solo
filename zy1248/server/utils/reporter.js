function generateMarkdownReport(historyEntry) {
  if (!historyEntry) {
    return '# Error\n\nNo history entry provided';
  }

  const { request, response, trace, cacheStatus, timestamp, duration, id } = historyEntry;

  let md = `# HTTP 请求演练复盘报告\n\n`;

  // 元信息
  md += `## 基本信息\n\n`;
  md += `- **报告 ID**: ${id}\n`;
  md += `- **执行时间**: ${timestamp}\n`;
  md += `- **耗时**: ${duration}ms\n`;
  md += `- **请求方法**: ${request.method}\n`;
  md += `- **请求 URL**: ${request.url}\n`;
  md += `- **最终状态码**: ${response.statusCode} ${response.statusText}\n\n`;

  // 请求摘要
  md += `## 请求摘要\n\n`;
  md += `### 请求\n\n`;
  md += `\`\`\`http\n${request.method} ${request.url}\n`;
  if (request.headers && Object.keys(request.headers).length > 0) {
    for (const [key, value] of Object.entries(request.headers)) {
      md += `${key}: ${value}\n`;
    }
  }
  if (request.body) {
    md += `\n${request.body}\n`;
  }
  md += `\`\`\`\n\n`;

  // 响应摘要
  md += `### 响应\n\n`;
  md += `\`\`\`http\nHTTP/1.1 ${response.statusCode} ${response.statusText}\n`;
  if (response.headers && Object.keys(response.headers).length > 0) {
    for (const [key, value] of Object.entries(response.headers)) {
      md += `${key}: ${value}\n`;
    }
  }
  if (response.body) {
    md += `\n${response.body}\n`;
  }
  md += `\`\`\`\n\n`;

  // 状态码分析
  md += `## 状态码分析\n\n`;
  md += getStatusCodeAnalysis(response.statusCode);
  md += `\n`;

  // 缓存分析
  if (cacheStatus && cacheStatus.length > 0) {
    md += `## 缓存状态分析\n\n`;
    for (const entry of cacheStatus) {
      md += `### 缓存项: ${entry.key}\n\n`;
      md += `- **状态**: ${entry.freshnessInfo.isFresh ? '新鲜' : '已过期'}\n`;
      md += `- **当前年龄**: ${entry.freshnessInfo.currentAge.toFixed(2)} 秒\n`;
      md += `- **新鲜期**: ${entry.freshnessInfo.freshLifetime.toFixed(2)} 秒\n`;
      if (!entry.freshnessInfo.isFresh) {
        md += `- **已过期**: ${entry.freshnessInfo.staleSeconds.toFixed(2)} 秒\n`;
      }
      if (entry.freshnessInfo.isHeuristic) {
        md += `- **警告**: 使用启发式过期计算\n`;
      }
      md += `\n`;
    }
  }

  // 请求追踪
  if (trace && trace.length > 0) {
    md += `## 请求追踪链路\n\n`;
    
    // 按组件分组
    const clientTrace = trace.filter(t => t.component === 'client');
    const cacheTrace = trace.filter(t => t.component === 'cache');
    const originTrace = trace.filter(t => t.component === 'origin');

    if (clientTrace.length > 0) {
      md += `### 客户端 (Client)\n\n`;
      for (const t of clientTrace) {
        md += `**[${t.timestamp}] ${t.action}**\n\n`;
        if (t.details) {
          if (t.details.request) {
            md += `请求: ${t.details.request.method} ${t.details.request.url || t.details.request.path}\n\n`;
          }
          if (t.details.response) {
            md += `响应: ${t.details.response.statusCode} ${t.details.response.statusText}\n\n`;
          }
          if (t.details.reason) {
            md += `原因: ${t.details.reason}\n\n`;
          }
        }
      }
    }

    if (cacheTrace.length > 0) {
      md += `### 缓存代理 (Cache Proxy)\n\n`;
      for (const t of cacheTrace) {
        md += `**[${t.timestamp}] ${t.action}**\n\n`;
        if (t.details) {
          if (t.details.reason) {
            md += `原因: ${t.details.reason}\n\n`;
          }
          if (t.details.freshnessInfo) {
            const fi = t.details.freshnessInfo;
            md += `新鲜度分析:\n`;
            md += `- 状态: ${fi.isFresh ? '新鲜' : '已过期'}\n`;
            md += `- 当前年龄: ${fi.currentAge.toFixed(2)} 秒\n`;
            md += `- 新鲜期: ${fi.freshLifetime.toFixed(2)} 秒\n\n`;
          }
        }
      }
    }

    if (originTrace.length > 0) {
      md += `### 源站 (Origin Server)\n\n`;
      for (const t of originTrace) {
        md += `**[${t.timestamp}] ${t.action}**\n\n`;
        if (t.details) {
          if (t.details.method) {
            md += `请求: ${t.details.method} ${t.details.path}\n\n`;
          }
          if (t.details.statusCode) {
            md += `响应: ${t.details.statusCode} ${t.details.statusText}\n\n`;
          }
        }
      }
    }
  }

  // 关键发现
  md += `## 关键发现与建议\n\n`;
  const findings = generateFindings(historyEntry);
  if (findings.length > 0) {
    for (const finding of findings) {
      md += `### ${finding.severity === 'error' ? '🔴' : finding.severity === 'warning' ? '🟡' : '🟢'} ${finding.title}\n\n`;
      md += `${finding.description}\n\n`;
      if (finding.suggestion) {
        md += `**建议**: ${finding.suggestion}\n\n`;
      }
    }
  } else {
    md += `未发现明显问题。\n\n`;
  }

  return md;
}

function generateJSONReport(historyEntry) {
  if (!historyEntry) {
    return { error: 'No history entry provided' };
  }

  const { request, response, trace, cacheStatus, timestamp, duration, id } = historyEntry;

  return {
    report: {
      id,
      generatedAt: new Date().toISOString(),
      version: '1.0'
    },
    execution: {
      timestamp,
      durationMs: duration,
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers || {},
        body: request.body
      },
      response: {
        statusCode: response.statusCode,
        statusText: response.statusText,
        headers: response.headers || {},
        body: response.body
      }
    },
    analysis: {
      statusCodeAnalysis: {
        code: response.statusCode,
        category: getStatusCodeCategory(response.statusCode),
        description: getStatusCodeDescription(response.statusCode)
      },
      cacheAnalysis: cacheStatus ? cacheStatus.map(entry => ({
        key: entry.key,
        freshness: {
          isFresh: entry.freshnessInfo.isFresh,
          currentAgeSeconds: entry.freshnessInfo.currentAge,
          freshLifetimeSeconds: entry.freshnessInfo.freshLifetime,
          staleSeconds: entry.freshnessInfo.staleSeconds,
          isHeuristic: entry.freshnessInfo.isHeuristic
        },
        request: entry.request,
        response: entry.response
      })) : [],
      trace: trace ? trace.map(t => ({
        timestamp: t.timestamp,
        component: t.component,
        action: t.action,
        details: t.details
      })) : []
    },
    findings: generateFindings(historyEntry),
    recommendations: generateRecommendations(historyEntry)
  };
}

function getStatusCodeAnalysis(statusCode) {
  const analyses = {
    200: `### 200 OK\n\n这是标准的成功响应。\n\n**含义**: 请求成功，服务器返回了请求的资源。\n\n**缓存行为**:\n- 如果响应包含缓存头（如 \`Cache-Control: max-age=3600\`），浏览器会缓存此响应。\n- 后续请求相同资源时，如果缓存未过期，浏览器可能直接使用缓存（显示 200 from disk cache/memory cache）。\n\n**常见场景**:\n- 首次请求资源\n- 缓存过期后重新验证成功\n- 强制刷新（Ctrl+F5）`,
    
    206: `### 206 Partial Content\n\n**含义**: 服务器成功处理了部分 GET 请求。\n\n**触发条件**:\n- 请求包含 \`Range\` 头，表示只请求资源的一部分\n- 服务器支持范围请求\n\n**缓存行为**:\n- 206 响应通常也可以被缓存\n- 后续范围请求可能触发 \`If-Range\` 头用于验证资源是否未修改\n\n**常见场景**:\n- 视频播放器分段加载视频\n- 下载工具断点续传\n- 大文件分块下载`,
    
    301: `### 301 Moved Permanently\n\n**含义**: 资源已永久移动到新位置。\n\n**关键特性**:\n- 这是永久重定向\n- 浏览器会缓存这个重定向\n- 搜索引擎会更新书签和索引\n\n**缓存行为**:\n- 301 响应默认会被浏览器缓存\n- 除非响应中有明确的缓存控制头禁止缓存\n- 后续请求会直接使用缓存的重定向，不访问原 URL\n\n**常见场景**:\n- 网站域名变更\n- URL 结构永久调整\n- 旧版页面合并`,
    
    302: `### 302 Found (临时重定向)\n\n**含义**: 资源临时移动到新位置。\n\n**与 301 的区别**:\n- 302 是临时的，浏览器不会缓存\n- 搜索引擎不会更新索引\n- 后续请求仍会访问原 URL\n\n**常见场景**:\n- 临时维护页面\n- A/B 测试\n- 基于地理位置重定向`,
    
    304: `### 304 Not Modified\n\n**含义**: 资源自上次请求后未修改。\n\n**触发条件**:\n- 请求包含条件头（\`If-None-Match\` 或 \`If-Modified-Since\`）\n- 服务器判断资源未修改\n\n**工作原理**:\n1. 浏览器发送带条件请求\n2. 服务器比较 ETag 或 Last-Modified\n3. 如未修改，返回 304（无响应体）\n4. 浏览器使用缓存的资源\n\n**缓存行为**:\n- 304 响应会更新缓存的新鲜期\n- 响应体不会改变\n- 缓存的响应头可能会更新\n\n**常见场景**:\n- 缓存过期后重新验证\n- 刷新页面（F5）\n- 带 \`Cache-Control: max-age=0\` 的请求`,
    
    412: `### 412 Precondition Failed\n\n**含义**: 服务器不满足请求中的条件头。\n\n**触发条件**:\n- 请求包含 \`If-Match\` 或 \`If-Unmodified-Since\` 头\n- 条件判断失败\n\n**常见原因**:\n1. **If-Match 失败**: 提供的 ETag 与服务器不匹配\n2. **If-Unmodified-Since 失败**: 资源在指定时间后已修改\n\n**使用场景**:\n- 乐观锁并发控制\n- 防止意外覆盖修改后的资源\n- 条件更新操作`,
    
    504: `### 504 Gateway Timeout\n\n**含义**: 网关或代理服务器超时。\n\n**在演练台中的含义**:\n- 当请求包含 \`Cache-Control: only-if-cached\` 且无缓存时返回\n- 表示必须使用缓存，但缓存不存在\n\n**常见场景**:\n- 强制使用缓存的请求\n- 离线模式下的请求`
  };

  return analyses[statusCode] || `### ${statusCode}\n\n未找到该状态码的详细分析。`;
}

function getStatusCodeCategory(statusCode) {
  if (statusCode >= 100 && statusCode < 200) return 'informational';
  if (statusCode >= 200 && statusCode < 300) return 'success';
  if (statusCode >= 300 && statusCode < 400) return 'redirection';
  if (statusCode >= 400 && statusCode < 500) return 'client_error';
  if (statusCode >= 500 && statusCode < 600) return 'server_error';
  return 'unknown';
}

function getStatusCodeDescription(statusCode) {
  const descriptions = {
    200: 'OK - 请求成功',
    206: 'Partial Content - 部分内容',
    301: 'Moved Permanently - 永久重定向',
    302: 'Found - 临时重定向',
    304: 'Not Modified - 未修改',
    412: 'Precondition Failed - 前提条件失败',
    504: 'Gateway Timeout - 网关超时'
  };
  return descriptions[statusCode] || 'Unknown status code';
}

function generateFindings(historyEntry) {
  const findings = [];
  const { request, response, trace, cacheStatus } = historyEntry;

  // 检查缓存相关的发现
  if (cacheStatus && cacheStatus.length > 0) {
    for (const entry of cacheStatus) {
      if (entry.freshnessInfo.isHeuristic) {
        findings.push({
          severity: 'warning',
          title: '使用启发式过期',
          description: `资源 "${entry.key}" 使用启发式方式计算过期时间。',
          suggestion: '建议显式设置 Cache-Control 或 Expires 头，避免不确定的缓存行为。'
        });
      }

      if (!entry.freshnessInfo.isFresh && entry.freshnessInfo.staleSeconds > 0) {
        findings.push({
          severity: 'info',
          title: '缓存已过期',
          description: `资源 "${entry.key}" 已过期 ${entry.freshnessInfo.staleSeconds.toFixed(2)} 秒。`,
          suggestion: '考虑调整 max-age 值或使用 must-revalidate 确保重新验证策略。'
        });
      }
    }
  }

  // 检查 304 响应
  if (response.statusCode === 304) {
    findings.push({
      severity: 'info',
      title: '条件请求成功',
      description: '服务器返回 304 Not Modified，表示资源自上次请求后未修改。浏览器将使用本地缓存的资源。',
      suggestion: '这是预期的缓存优化行为，无需更改。'
    });
  }

  // 检查 412 响应
  if (response.statusCode === 412) {
    findings.push({
      severity: 'error',
      title: '条件请求失败',
      description: '服务器返回 412 Precondition Failed。这通常是因为 If-Match 或 If-Unmodified-Since 条件不满足。',
      suggestion: '检查提供的 ETag 或日期是否与服务器上的资源匹配。'
    });
  }

  // 检查重定向
  if (response.statusCode >= 301 && response.statusCode <= 308) {
    if (response.statusCode === 301) {
      findings.push({
        severity: 'warning',
        title: '永久重定向',
        description: '服务器返回 301 Moved Permanently。浏览器会缓存这个重定向。',
        suggestion: '确保这是预期的永久变更。如果是临时的，应使用 302 或 307。'
      });
    }
  }

  // 检查 Vary 头
  if (response.headers && response.headers['Vary']) {
    const vary = response.headers['Vary'];
    if (vary === '*') {
      findings.push({
        severity: 'warning',
        title: 'Vary: * 影响缓存',
        description: '响应包含 Vary: * 头，这意味着响应会因所有请求头而变化，实际上使缓存失效。',
        suggestion: '考虑使用更具体的 Vary 头，如 Vary: Accept-Encoding。'
      });
    }
  }

  // 检查 Cache-Control 配置
  if (response.headers && response.headers['Cache-Control']) {
    const cc = response.headers['Cache-Control'];
    if (cc.includes('no-store')) {
      findings.push({
        severity: 'info',
        title: '禁止缓存',
        description: '响应包含 Cache-Control: no-store，此资源不会被缓存。',
        suggestion: '如果这是敏感数据，这是正确的配置。否则，考虑允许缓存可以提升性能。'
      });
    }
  }

  return findings;
}

function generateRecommendations(historyEntry) {
  const recommendations = [];
  const { request, response } = historyEntry;

  // 通用建议
  recommendations.push({
    area: '缓存策略',
    items: [
      '为静态资源设置合适的 max-age 值（如一年），并使用文件名指纹进行版本控制',
      '使用 must-revalidate 确保缓存过期后必须重新验证',
      '为不可缓存的内容使用 no-store',
      '为需要重新验证的内容使用 no-cache'
    ]
  });

  recommendations.push({
    area: 'ETag 配置',
    items: [
      '使用强 ETag 进行精确的资源验证',
      '避免在 ETag 中包含不必要的信息（如时间戳）',
      '确保 ETag 格式正确（用双引号包裹）'
    ]
  });

  recommendations.push({
    area: '重定向最佳实践',
    items: [
      '永久重定向使用 301',
      '临时重定向使用 302 或 307',
      'POST 重定向到 GET 使用 303',
      '避免重定向链，保持重定向次数最少'
    ]
  });

  recommendations.push({
    area: '条件请求',
    items: [
      '使用 If-None-Match + ETag 进行精确验证',
      '使用 If-Modified-Since 作为后备验证方式',
      'PUT/DELETE 操作使用 If-Match 进行乐观锁'
    ]
  });

  return recommendations;
}

module.exports = {
  generateMarkdownReport,
  generateJSONReport
};
