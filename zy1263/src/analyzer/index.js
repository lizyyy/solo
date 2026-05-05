const { getDb } = require('../database');

const ISSUE_TYPES = {
  CROSS_SERVICE_TABLE_ACCESS: 'CROSS_SERVICE_TABLE_ACCESS',
  UNCLEAR_TABLE_OWNER: 'UNCLEAR_TABLE_OWNER',
  CIRCULAR_CALL: 'CIRCULAR_CALL',
  LONG_SYNC_CHAIN: 'LONG_SYNC_CHAIN',
  MISSING_DOMAIN_EVENT: 'MISSING_DOMAIN_EVENT',
  OVERLAPPING_RESPONSIBILITY: 'OVERLAPPING_RESPONSIBILITY'
};

const SEVERITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
};

function detectCrossServiceTableAccess() {
  const db = getDb();
  const issues = [];
  
  const rows = db.prepare(`
    SELECT 
      sta.service_name as accessing_service,
      sta.table_name,
      sta.access_type,
      dt.owner_service as owner_service
    FROM service_table_access sta
    JOIN database_tables dt ON sta.table_name = dt.name
    WHERE sta.service_name != dt.owner_service
      AND sta.access_type != 'OWNER'
    ORDER BY sta.access_count DESC
  `).all();
  
  const groupedByTable = {};
  for (const row of rows) {
    if (!groupedByTable[row.table_name]) {
      groupedByTable[row.table_name] = {
        table_name: row.table_name,
        owner_service: row.owner_service,
        accessing_services: []
      };
    }
    groupedByTable[row.table_name].accessing_services.push({
      service: row.accessing_service,
      access_type: row.access_type
    });
  }
  
  for (const [tableName, info] of Object.entries(groupedByTable)) {
    const severity = info.accessing_services.length >= 3 ? SEVERITY.CRITICAL : 
                     info.accessing_services.length >= 2 ? SEVERITY.HIGH : SEVERITY.MEDIUM;
    
    issues.push({
      issue_type: ISSUE_TYPES.CROSS_SERVICE_TABLE_ACCESS,
      severity,
      title: `表 ${tableName} 被跨服务直接访问`,
      description: `表 ${tableName} 的归属服务是 ${info.owner_service}，但被 ${info.accessing_services.length} 个其他服务直接访问。这违反了微服务数据边界原则。`,
      affected_entities: JSON.stringify({
        table: tableName,
        owner_service: info.owner_service,
        accessing_services: info.accessing_services
      }),
      recommendation: `建议：1) 为 ${info.owner_service} 提供 API 接口替代直接查表；2) 考虑使用领域事件进行数据同步；3) 评估是否需要调整服务边界。`
    });
  }
  
  return issues;
}

function detectUnclearTableOwner() {
  const db = getDb();
  const issues = [];
  
  const tablesWithMultipleOwners = db.prepare(`
    SELECT 
      dt.name as table_name,
      GROUP_CONCAT(DISTINCT tor.service_name) as claimed_owners,
      COUNT(DISTINCT tor.service_name) as owner_count
    FROM database_tables dt
    LEFT JOIN table_owners tor ON dt.name = tor.table_name
    WHERE dt.owner_service IS NULL OR dt.owner_service = ''
    GROUP BY dt.name
    HAVING owner_count > 1 OR (owner_count = 0 AND dt.name IS NOT NULL)
  `).all();
  
  for (const row of tablesWithMultipleOwners) {
    if (row.owner_count > 1) {
      issues.push({
        issue_type: ISSUE_TYPES.UNCLEAR_TABLE_OWNER,
        severity: SEVERITY.CRITICAL,
        title: `表 ${row.table_name} 的归属存在争议`,
        description: `表 ${row.table_name} 有 ${row.owner_count} 个服务声称是其所有者：${row.claimed_owners}。这会导致数据一致性问题。`,
        affected_entities: JSON.stringify({
          table: row.table_name,
          claimed_owners: row.claimed_owners.split(',')
        }),
        recommendation: `建议：1) 召开架构评审会议，明确表的唯一归属服务；2) 考虑将表拆分为多个服务的私有表；3) 引入 Saga 模式处理跨服务数据一致性。`
      });
    } else {
      issues.push({
        issue_type: ISSUE_TYPES.UNCLEAR_TABLE_OWNER,
        severity: SEVERITY.HIGH,
        title: `表 ${row.table_name} 没有明确的所有者`,
        description: `表 ${row.table_name} 没有指定归属服务，这会导致谁负责维护该表的数据不明确。`,
        affected_entities: JSON.stringify({
          table: row.table_name
        }),
        recommendation: `建议：1) 根据表的业务含义分配给最相关的服务；2) 检查服务边界划分是否合理；3) 在 tables.csv 中补充 owner_service 字段。`
      });
    }
  }
  
  return issues;
}

function detectCircularCalls() {
  const db = getDb();
  const issues = [];
  
  const services = db.prepare('SELECT name FROM services').pluck().all();
  
  const callGraph = {};
  for (const service of services) {
    callGraph[service] = [];
  }
  
  const edges = db.prepare(`
    SELECT source_service, target_service, call_type
    FROM call_edges
    WHERE call_type = 'SYNC'
  `).all();
  
  for (const edge of edges) {
    if (callGraph[edge.source_service]) {
      callGraph[edge.source_service].push({
        target: edge.target_service,
        type: edge.call_type
      });
    }
  }
  
  function findCycles(graph, start, current, path, visited, cycles) {
    const newPath = [...path, current];
    
    if (current === start && path.length > 0) {
      cycles.push(newPath);
      return;
    }
    
    if (visited.has(current)) {
      return;
    }
    
    const newVisited = new Set(visited);
    newVisited.add(current);
    
    const neighbors = graph[current] || [];
    for (const neighbor of neighbors) {
      findCycles(graph, start, neighbor.target, newPath, newVisited, cycles);
    }
  }
  
  const allCycles = [];
  for (const service of services) {
    const cycles = [];
    findCycles(callGraph, service, service, [], new Set(), cycles);
    for (const cycle of cycles) {
      const cycleStr = cycle.join(' → ');
      if (!allCycles.some(c => c.pathStr === cycleStr)) {
        allCycles.push({
          path: cycle,
          pathStr: cycleStr,
          length: cycle.length
        });
      }
    }
  }
  
  for (const cycle of allCycles) {
    const severity = cycle.length <= 3 ? SEVERITY.CRITICAL : 
                     cycle.length <= 5 ? SEVERITY.HIGH : SEVERITY.MEDIUM;
    
    issues.push({
      issue_type: ISSUE_TYPES.CIRCULAR_CALL,
      severity,
      title: `检测到循环调用: ${cycle.pathStr}`,
      description: `服务之间存在长度为 ${cycle.length} 的同步调用循环。循环调用会导致系统可用性降低，且难以进行分布式追踪。`,
      affected_entities: JSON.stringify({
        cycle_path: cycle.path,
        length: cycle.length
      }),
      recommendation: `建议：1) 引入消息队列解耦循环中的至少一个调用；2) 重构服务边界，将循环内的服务合并或重新划分；3) 使用 Saga 模式替代同步调用链。`
    });
  }
  
  return issues;
}

function detectLongSyncChains(maxAllowedLength = 3) {
  const db = getDb();
  const issues = [];
  
  const services = db.prepare('SELECT name FROM services').pluck().all();
  
  const callGraph = {};
  const edges = db.prepare(`
    SELECT source_service, target_service, call_type, call_count, avg_latency_ms
    FROM call_edges
    WHERE call_type = 'SYNC'
  `).all();
  
  for (const service of services) {
    callGraph[service] = [];
  }
  
  for (const edge of edges) {
    if (callGraph[edge.source_service]) {
      callGraph[edge.source_service].push({
        target: edge.target_service,
        call_count: edge.call_count,
        avg_latency_ms: edge.avg_latency_ms
      });
    }
  }
  
  function findLongChains(graph, start, maxLength) {
    const chains = [];
    const queue = [{ service: start, path: [start], totalLatency: 0 }];
    
    while (queue.length > 0) {
      const { service, path, totalLatency } = queue.shift();
      
      if (path.length > maxLength) {
        chains.push({
          path: [...path],
          length: path.length,
          totalLatency
        });
        continue;
      }
      
      const neighbors = graph[service] || [];
      for (const neighbor of neighbors) {
        if (!path.includes(neighbor.target)) {
          queue.push({
            service: neighbor.target,
            path: [...path, neighbor.target],
            totalLatency: totalLatency + (neighbor.avg_latency_ms || 0)
          });
        }
      }
    }
    
    return chains;
  }
  
  const allLongChains = [];
  const seenChains = new Set();
  
  for (const service of services) {
    const longChains = findLongChains(callGraph, service, maxAllowedLength);
    for (const chain of longChains) {
      const chainKey = chain.path.join('→');
      if (!seenChains.has(chainKey)) {
        seenChains.add(chainKey);
        allLongChains.push(chain);
      }
    }
  }
  
  for (const chain of allLongChains) {
    const excessLength = chain.length - maxAllowedLength;
    const severity = excessLength >= 3 ? SEVERITY.CRITICAL :
                     excessLength >= 2 ? SEVERITY.HIGH : SEVERITY.MEDIUM;
    
    issues.push({
      issue_type: ISSUE_TYPES.LONG_SYNC_CHAIN,
      severity,
      title: `同步调用链过长: ${chain.path.join(' → ')}`,
      description: `调用链长度为 ${chain.length}，超过阈值 ${maxAllowedLength}。长同步链会导致：1) 单个服务故障影响整条链；2) 累积延迟过高；3) 用户体验差。预估总延迟: ${chain.totalLatency || '未知'} ms`,
      affected_entities: JSON.stringify({
        chain_path: chain.path,
        length: chain.length,
        max_allowed: maxAllowedLength,
        total_latency_ms: chain.totalLatency
      }),
      recommendation: `建议：1) 识别调用链的关键路径，考虑将非关键路径异步化；2) 评估是否需要引入聚合服务（API Gateway/BFF）；3) 检查服务职责划分是否过于细粒度，考虑合并相关服务。`
    });
  }
  
  return issues;
}

function detectMissingDomainEvents() {
  const db = getDb();
  const issues = [];
  
  const servicesWithCrossServiceCalls = db.prepare(`
    SELECT DISTINCT ce.source_service, ce.target_service, ce.call_type
    FROM call_edges ce
    WHERE ce.call_type = 'SYNC'
    ORDER BY ce.source_service
  `).all();
  
  const eventPublishers = db.prepare(`
    SELECT service_name, event_name
    FROM service_event_publish
  `).all();
  
  const eventSubscribers = db.prepare(`
    SELECT service_name, event_name
    FROM service_event_subscribe
  `).all();
  
  const publisherMap = {};
  const subscriberMap = {};
  
  for (const pub of eventPublishers) {
    if (!publisherMap[pub.service_name]) {
      publisherMap[pub.service_name] = new Set();
    }
    publisherMap[pub.service_name].add(pub.event_name);
  }
  
  for (const sub of eventSubscribers) {
    if (!subscriberMap[sub.service_name]) {
      subscriberMap[sub.service_name] = new Set();
    }
    subscriberMap[sub.service_name].add(sub.event_name);
  }
  
  const syncCallPairs = new Set();
  for (const call of servicesWithCrossServiceCalls) {
    if (call.source_service !== call.target_service) {
      syncCallPairs.add(`${call.source_service}→${call.target_service}`);
    }
  }
  
  const servicesWithoutEvents = db.prepare(`
    SELECT DISTINCT s.name
    FROM services s
    WHERE s.name NOT IN (
      SELECT service_name FROM service_event_publish
      UNION
      SELECT service_name FROM service_event_subscribe
    )
  `).pluck().all();
  
  if (servicesWithoutEvents.length > 0) {
    issues.push({
      issue_type: ISSUE_TYPES.MISSING_DOMAIN_EVENT,
      severity: SEVERITY.MEDIUM,
      title: `${servicesWithoutEvents.length} 个服务未参与任何领域事件`,
      description: `以下服务既不发布也不订阅领域事件：${servicesWithoutEvents.join(', ')}。这可能表示服务边界划分有问题，或者缺少异步通信机制。`,
      affected_entities: JSON.stringify({
        services: servicesWithoutEvents
      }),
      recommendation: `建议：1) 检查这些服务是否是纯数据服务（如果是，考虑迁移数据到其他服务）；2) 识别服务之间的业务交互，考虑用事件驱动替代同步调用；3) 确保领域事件覆盖关键业务状态变化。`
    });
  }
  
  const servicesWithOnlySyncCalls = db.prepare(`
    SELECT DISTINCT s.name
    FROM services s
    WHERE s.name IN (
      SELECT source_service FROM call_edges WHERE call_type = 'SYNC'
      UNION
      SELECT target_service FROM call_edges WHERE call_type = 'SYNC'
    )
    AND s.name NOT IN (
      SELECT service_name FROM service_event_publish
    )
  `).pluck().all();
  
  if (servicesWithOnlySyncCalls.length > 0) {
    issues.push({
      issue_type: ISSUE_TYPES.MISSING_DOMAIN_EVENT,
      severity: SEVERITY.HIGH,
      title: `${servicesWithOnlySyncCalls.length} 个服务只用同步调用，从不发布事件`,
      description: `以下服务参与同步调用但从不发布领域事件：${servicesWithOnlySyncCalls.join(', ')}。在微服务架构中，状态变更应该通过事件广播，而不是仅通过同步 API 访问。`,
      affected_entities: JSON.stringify({
        services: servicesWithOnlySyncCalls
      }),
      recommendation: `建议：1) 识别这些服务中的关键业务状态变更点；2) 设计对应的领域事件（如 OrderCreated, UserUpdated）；3) 逐步将同步拉取模式改为事件推送模式。`
    });
  }
  
  return issues;
}

function detectOverlappingResponsibilities() {
  const db = getDb();
  const issues = [];
  
  const servicesByDomain = db.prepare(`
    SELECT domain, GROUP_CONCAT(name) as services, COUNT(*) as service_count
    FROM services
    WHERE domain IS NOT NULL AND domain != ''
    GROUP BY domain
    ORDER BY service_count DESC
  `).all();
  
  for (const row of servicesByDomain) {
    if (row.service_count >= 3) {
      const serviceList = row.services.split(',');
      issues.push({
        issue_type: ISSUE_TYPES.OVERLAPPING_RESPONSIBILITY,
        severity: SEVERITY.MEDIUM,
        title: `领域 "${row.domain}" 有 ${row.service_count} 个服务，需检查职责划分`,
        description: `领域 "${row.domain}" 包含 ${row.service_count} 个服务：${row.services}。多服务共享同一领域是正常的，但需要确保它们的职责不重叠。`,
        affected_entities: JSON.stringify({
          domain: row.domain,
          services: serviceList,
          count: row.service_count
        }),
        recommendation: `建议：1) 检查这些服务的数据库表是否有重叠；2) 确认每个服务的职责边界是否清晰；3) 考虑是否有服务可以合并（如果职责过于细粒度）或进一步拆分（如果职责过于宽泛）。`
      });
    }
  }
  
  const servicesWithSameTablePrefix = db.prepare(`
    SELECT 
      SUBSTR(dt.name, 1, INSTR(dt.name, '_') - 1) as table_prefix,
      GROUP_CONCAT(DISTINCT dt.owner_service) as using_services,
      COUNT(DISTINCT dt.name) as table_count,
      COUNT(DISTINCT dt.owner_service) as service_count
    FROM database_tables dt
    WHERE INSTR(dt.name, '_') > 0
      AND dt.owner_service IS NOT NULL
    GROUP BY table_prefix
    HAVING service_count > 1
    ORDER BY service_count DESC, table_count DESC
  `).all();
  
  for (const row of servicesWithSameTablePrefix) {
    issues.push({
      issue_type: ISSUE_TYPES.OVERLAPPING_RESPONSIBILITY,
      severity: SEVERITY.HIGH,
      title: `表前缀 "${row.table_prefix}_*" 被 ${row.service_count} 个服务共享`,
      description: `以 "${row.table_prefix}_" 开头的表共 ${row.table_count} 个，被以下服务使用：${row.using_services}。相同的表前缀通常表示相同的业务领域，跨服务共享可能意味着职责重叠。`,
      affected_entities: JSON.stringify({
        table_prefix: row.table_prefix,
        table_count: row.table_count,
        services: row.using_services.split(','),
        service_count: row.service_count
      }),
      recommendation: `建议：1) 确认这些表是否真的属于不同服务；2) 考虑将相关表迁移到同一个服务；3) 如果需要共享数据，使用领域事件而非直接共享表。`
    });
  }
  
  const ownerlessTables = db.prepare(`
    SELECT name, description
    FROM database_tables
    WHERE owner_service IS NULL OR owner_service = ''
  `).all();
  
  if (ownerlessTables.length > 0) {
    const tableNames = ownerlessTables.map(t => t.name);
    issues.push({
      issue_type: ISSUE_TYPES.OVERLAPPING_RESPONSIBILITY,
      severity: SEVERITY.MEDIUM,
      title: `${ownerlessTables.length} 个表没有明确所有者`,
      description: `以下表没有指定归属服务：${tableNames.join(', ')}。这可能意味着这些表的职责没有被任何服务明确承担，或者服务边界划分有遗漏。`,
      affected_entities: JSON.stringify({
        tables: tableNames
      }),
      recommendation: `建议：1) 为每个表指定归属服务；2) 检查是否有遗漏的服务；3) 考虑这些表是否是遗留系统的一部分需要迁移。`
    });
  }
  
  return issues;
}

function runAllAnalyses(options = {}) {
  const issues = [];
  
  console.log('🔍 开始分析...');
  
  console.log('  - 检查跨服务直接查表...');
  issues.push(...detectCrossServiceTableAccess());
  
  console.log('  - 检查表归属不清...');
  issues.push(...detectUnclearTableOwner());
  
  console.log('  - 检查循环调用...');
  issues.push(...detectCircularCalls());
  
  console.log('  - 检查同步链过长...');
  issues.push(...detectLongSyncChains(options.maxSyncChainLength || 3));
  
  console.log('  - 检查领域事件缺失...');
  issues.push(...detectMissingDomainEvents());
  
  console.log('  - 检查职责重叠...');
  issues.push(...detectOverlappingResponsibilities());
  
  const db = getDb();
  const reportName = `分析报告_${new Date().toISOString().slice(0, 10)}`;
  
  const stats = {
    total: issues.length,
    bySeverity: {
      CRITICAL: issues.filter(i => i.severity === SEVERITY.CRITICAL).length,
      HIGH: issues.filter(i => i.severity === SEVERITY.HIGH).length,
      MEDIUM: issues.filter(i => i.severity === SEVERITY.MEDIUM).length,
      LOW: issues.filter(i => i.severity === SEVERITY.LOW).length
    },
    byType: {}
  };
  
  for (const issue of issues) {
    if (!stats.byType[issue.issue_type]) {
      stats.byType[issue.issue_type] = 0;
    }
    stats.byType[issue.issue_type]++;
  }
  
  const reportId = db.prepare(`
    INSERT INTO analysis_reports (report_name, summary)
    VALUES (?, ?)
  `).run([reportName, JSON.stringify(stats)]).lastInsertRowid;
  
  const transaction = db.transaction((iss) => {
    for (const issue of iss) {
      db.prepare(`
        INSERT INTO issues (report_id, issue_type, severity, title, description, affected_entities, recommendation)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run([
        reportId,
        issue.issue_type,
        issue.severity,
        issue.title,
        issue.description,
        issue.affected_entities,
        issue.recommendation
      ]);
    }
  });
  
  transaction(issues);
  
  console.log(`✓ 分析完成，共发现 ${issues.length} 个问题`);
  console.log(`  - 严重: ${stats.bySeverity.CRITICAL}`);
  console.log(`  - 高危: ${stats.bySeverity.HIGH}`);
  console.log(`  - 中等: ${stats.bySeverity.MEDIUM}`);
  console.log(`  - 低危: ${stats.bySeverity.LOW}`);
  
  return {
    reportId,
    reportName,
    stats,
    issues
  };
}

function getReport(reportId) {
  const db = getDb();
  
  const report = db.prepare(`
    SELECT * FROM analysis_reports WHERE id = ?
  `).get(reportId);
  
  if (!report) {
    return null;
  }
  
  const issues = db.prepare(`
    SELECT * FROM issues WHERE report_id = ? ORDER BY 
      CASE severity 
        WHEN 'CRITICAL' THEN 1 
        WHEN 'HIGH' THEN 2 
        WHEN 'MEDIUM' THEN 3 
        WHEN 'LOW' THEN 4 
      END ASC
  `).all(reportId);
  
  return {
    ...report,
    summary: JSON.parse(report.summary),
    issues
  };
}

module.exports = {
  ISSUE_TYPES,
  SEVERITY,
  detectCrossServiceTableAccess,
  detectUnclearTableOwner,
  detectCircularCalls,
  detectLongSyncChains,
  detectMissingDomainEvents,
  detectOverlappingResponsibilities,
  runAllAnalyses,
  getReport
};
