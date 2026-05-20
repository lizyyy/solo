const store = require('./store');
const { SERVICE_STATUS, DEPENDENCY_STATUS, CHECK_RESULT } = require('./models');

class HealthCheckEngine {
  constructor() {
    this.DEGRADED_THRESHOLD = 0.5;
    this.UNHEALTHY_THRESHOLD = 0.75;
    this.RECOVERY_SUCCESS_THRESHOLD = 3;
  }

  async runServiceCheck(serviceId) {
    const service = store.getService(serviceId);
    if (!service) {
      throw new Error('Service not found');
    }

    const dependencies = store.getDependenciesByService(serviceId);
    const checkItems = store.getCheckItemsByService(serviceId);
    const depResults = [];
    const checkItemResults = [];
    let failedCount = 0;
    let checkItemFailedCount = 0;

    for (const dep of dependencies) {
      const result = await this.checkDependency(dep);
      depResults.push(result);
      if (!result.success) {
        failedCount++;
      }
    }

    for (const item of checkItems) {
      if (!item.enabled) continue;
      const result = await this.executeCheckItem(item);
      checkItemResults.push(result);
      if (!result.pass) {
        checkItemFailedCount++;
      }
    }

    service.lastCheckAt = new Date();
    service.updatedAt = new Date();

    const healthScore = this.calculateHealthScore(dependencies, checkItems, failedCount, checkItemFailedCount);
    service.healthScore = healthScore;

    const { newStatus, reason } = this.determineServiceStatus(service, dependencies, checkItems, failedCount, checkItemFailedCount);
    
    if (newStatus !== service.status) {
      const statusChange = service.updateStatus(newStatus, reason);
      store.addStatusTimeline({
        serviceId,
        oldStatus: statusChange.oldStatus,
        newStatus: statusChange.newStatus,
        reason: statusChange.reason,
        metadata: {
          failedCount,
          checkItemFailedCount,
          totalDependencies: dependencies.length,
          totalCheckItems: checkItems.filter(c => c.enabled).length,
          healthScore
        }
      });
    }

    return {
      service: { ...service },
      dependencies: depResults,
      checkItems: checkItemResults,
      healthScore,
      statusReason: reason
    };
  }

  async executeCheckItem(checkItem) {
    const startTime = Date.now();
    let pass = true;
    let resultMessage = '';
    let actualValue = null;

    const checkTypes = {
      connectivity: () => {
        actualValue = Math.random() > 0.1 ? 'connected' : 'disconnected';
        pass = actualValue === 'connected';
        resultMessage = pass ? '连接正常' : '连接失败';
      },
      latency: () => {
        const threshold = checkItem.config.thresholdMs || 100;
        actualValue = Math.floor(Math.random() * 200);
        pass = actualValue <= threshold;
        resultMessage = pass ? `延迟 ${actualValue}ms 在阈值内 (<= ${threshold}ms)` : `延迟 ${actualValue}ms 超过阈值 (> ${threshold}ms)`;
      },
      response_schema: () => {
        const expectedFields = checkItem.config.expectedFields || ['status'];
        actualValue = ['status', 'timestamp', 'data'];
        const missing = expectedFields.filter(f => !actualValue.includes(f));
        pass = missing.length === 0;
        resultMessage = pass ? '响应字段完整' : `缺少字段: ${missing.join(', ')}`;
      },
      connection_pool: () => {
        const minConn = checkItem.config.minConnections || 5;
        actualValue = Math.floor(Math.random() * 20);
        pass = actualValue >= minConn;
        resultMessage = pass ? `连接池可用: ${actualValue} 个` : `连接池不足: ${actualValue} 个 (需要 >= ${minConn})`;
      },
      memory_usage: () => {
        const maxPercent = checkItem.config.maxMemoryPercent || 80;
        actualValue = Math.floor(Math.random() * 100);
        pass = actualValue <= maxPercent;
        resultMessage = pass ? `内存使用: ${actualValue}%` : `内存过高: ${actualValue}% (> ${maxPercent}%)`;
      },
      replication_lag: () => {
        const maxLag = checkItem.config.maxLagSeconds || 10;
        actualValue = Math.floor(Math.random() * 30);
        pass = actualValue <= maxLag;
        resultMessage = pass ? `复制延迟: ${actualValue}s` : `复制延迟过高: ${actualValue}s (> ${maxLag}s)`;
      },
      cluster_health: () => {
        const minGreen = checkItem.config.minGreenNodes || 3;
        actualValue = Math.floor(Math.random() * 5);
        pass = actualValue >= minGreen;
        resultMessage = pass ? `集群健康节点: ${actualValue} 个` : `集群节点不足: ${actualValue} 个 (需要 >= ${minGreen})`;
      },
      error_rate: () => {
        const maxRate = checkItem.config.maxErrorRate || 0.05;
        actualValue = (Math.random() * 0.1).toFixed(3);
        pass = parseFloat(actualValue) <= maxRate;
        resultMessage = pass ? `错误率: ${actualValue}` : `错误率过高: ${actualValue} (> ${maxRate})`;
      },
      throughput: () => {
        const minTps = checkItem.config.minTps || 100;
        actualValue = Math.floor(Math.random() * 200);
        pass = actualValue >= minTps;
        resultMessage = pass ? `吞吐量: ${actualValue} TPS` : `吞吐量不足: ${actualValue} TPS (< ${minTps})`;
      },
      table_lock: () => {
        const maxWait = checkItem.config.maxLockWaitMs || 1000;
        actualValue = Math.floor(Math.random() * 2000);
        pass = actualValue <= maxWait;
        resultMessage = pass ? `表锁等待: ${actualValue}ms` : `表锁等待过长: ${actualValue}ms (> ${maxWait}ms)`;
      },
      indexing_latency: () => {
        const maxLatency = checkItem.config.maxLatencyMs || 5000;
        actualValue = Math.floor(Math.random() * 10000);
        pass = actualValue <= maxLatency;
        resultMessage = pass ? `索引延迟: ${actualValue}ms` : `索引延迟过高: ${actualValue}ms (> ${maxLatency}ms)`;
      }
    };

    const checkFn = checkTypes[checkItem.type];
    if (checkFn) {
      checkFn();
    } else {
      pass = true;
      resultMessage = `未知检查类型: ${checkItem.type}, 跳过`;
    }

    checkItem.lastResult = pass ? CHECK_RESULT.PASS : CHECK_RESULT.FAIL;
    checkItem.lastCheckAt = new Date();
    checkItem.updatedAt = new Date();

    return {
      checkItemId: checkItem.id,
      type: checkItem.type,
      pass,
      message: resultMessage,
      actualValue,
      config: checkItem.config,
      responseTime: Date.now() - startTime
    };
  }

  async checkDependency(dependency) {
    const startTime = Date.now();
    let success = false;
    let errorMessage = '';
    let statusCode = null;

    try {
      const mockResult = this.mockDependencyCheck(dependency);
      success = mockResult.success;
      statusCode = mockResult.statusCode;
      errorMessage = mockResult.error;
    } catch (error) {
      success = false;
      errorMessage = error.message;
    }

    const responseTime = Date.now() - startTime;

    dependency.recordResult(success);

    if (!success) {
      store.addFailureSample({
        serviceId: dependency.serviceId,
        dependencyId: dependency.id,
        errorMessage,
        statusCode,
        responseTime,
        requestDetails: {
          url: dependency.url,
          method: dependency.method
        }
      });
    }

    return {
      dependencyId: dependency.id,
      name: dependency.name,
      success,
      statusCode,
      errorMessage,
      responseTime,
      status: dependency.status,
      consecutiveFailures: dependency.consecutiveFailures
    };
  }

  mockDependencyCheck(dependency) {
    const rand = Math.random();
    
    if (dependency._forceFail) {
      return {
        success: false,
        statusCode: 500,
        error: 'Internal Server Error - Simulated Failure'
      };
    }
    
    if (rand < 0.85) {
      return {
        success: true,
        statusCode: 200,
        error: null
      };
    } else if (rand < 0.95) {
      return {
        success: false,
        statusCode: 503,
        error: 'Service Unavailable - Connection Timeout'
      };
    } else {
      return {
        success: false,
        statusCode: 429,
        error: 'Rate Limit Exceeded'
      };
    }
  }

  calculateHealthScore(dependencies, checkItems, depFailedCount, checkFailedCount) {
    const totalWeight = dependencies.length + checkItems.filter(c => c.enabled).length;
    if (totalWeight === 0) return 100;
    
    const passedWeight = (dependencies.length - depFailedCount) + (checkItems.filter(c => c.enabled).length - checkFailedCount);
    return Math.round((passedWeight / totalWeight) * 100);
  }

  determineServiceStatus(service, dependencies, checkItems, depFailedCount, checkFailedCount) {
    const totalDeps = dependencies.length;
    const enabledCheckItems = checkItems.filter(c => c.enabled);
    const totalChecks = enabledCheckItems.length;
    const totalWeight = totalDeps + totalChecks;
    const totalFailed = depFailedCount + checkFailedCount;
    const failureRate = totalWeight > 0 ? totalFailed / totalWeight : 0;
    const criticalDown = dependencies.filter(d => d.status === DEPENDENCY_STATUS.DOWN).length;

    if (criticalDown > 0) {
      return {
        newStatus: SERVICE_STATUS.UNHEALTHY,
        reason: `${criticalDown} 个关键依赖处于 DOWN 状态，影响服务正常运行`
      };
    }

    if (failureRate >= this.UNHEALTHY_THRESHOLD) {
      return {
        newStatus: SERVICE_STATUS.UNHEALTHY,
        reason: `超过 ${this.UNHEALTHY_THRESHOLD * 100}% 的检查项失败 (依赖: ${depFailedCount}/${totalDeps}, 检查项: ${checkFailedCount}/${totalChecks})`
      };
    }

    if (failureRate >= this.DEGRADED_THRESHOLD) {
      return {
        newStatus: SERVICE_STATUS.DEGRADED,
        reason: `超过 ${this.DEGRADED_THRESHOLD * 100}% 的检查项失败，服务降级运行 (依赖: ${depFailedCount}/${totalDeps}, 检查项: ${checkFailedCount}/${totalChecks})`
      };
    }

    if (totalFailed > 0) {
      return {
        newStatus: SERVICE_STATUS.DEGRADED,
        reason: `部分检查项失败 (依赖: ${depFailedCount}/${totalDeps}, 检查项: ${checkFailedCount}/${totalChecks})，请关注`
      };
    }

    if (service.status === SERVICE_STATUS.UNHEALTHY || service.status === SERVICE_STATUS.DEGRADED) {
      const recoveringDeps = dependencies.filter(d => 
        d.consecutiveSuccesses >= this.RECOVERY_SUCCESS_THRESHOLD
      );
      
      if (recoveringDeps.length === totalDeps) {
        return {
          newStatus: SERVICE_STATUS.HEALTHY,
          reason: `所有依赖已连续 ${this.RECOVERY_SUCCESS_THRESHOLD} 次检查成功，服务已恢复健康`
        };
      } else {
        return {
          newStatus: SERVICE_STATUS.RECOVERING,
          reason: `${recoveringDeps.length}/${totalDeps} 个依赖已恢复正常，服务恢复中`
        };
      }
    }

    return {
      newStatus: SERVICE_STATUS.HEALTHY,
      reason: '所有依赖和检查项均通过，服务运行正常'
    };
  }

  triggerDependencyFailure(dependencyId, shouldFail = true) {
    const dependency = store.getDependency(dependencyId);
    if (!dependency) {
      throw new Error('Dependency not found');
    }
    dependency._forceFail = shouldFail;
    return dependency;
  }

  generateHealthReport(serviceId) {
    const service = store.getService(serviceId);
    if (!service) {
      throw new Error('Service not found');
    }

    const dependencies = store.getDependenciesByService(serviceId);
    const checkItems = store.getCheckItemsByService(serviceId);
    const failureSamples = store.getFailureSamplesByService(serviceId, 20);
    const timeline = store.getStatusTimelineByService(serviceId, 50);

    const stats = {
      totalDependencies: dependencies.length,
      healthyDeps: dependencies.filter(d => d.status === DEPENDENCY_STATUS.UP).length,
      degradedDeps: dependencies.filter(d => d.status === DEPENDENCY_STATUS.DEGRADED).length,
      downDeps: dependencies.filter(d => d.status === DEPENDENCY_STATUS.DOWN).length,
      unknownDeps: dependencies.filter(d => d.status === DEPENDENCY_STATUS.UNKNOWN).length,
      totalCheckItems: checkItems.length,
      enabledCheckItems: checkItems.filter(c => c.enabled).length,
      passedCheckItems: checkItems.filter(c => c.enabled && c.lastResult === CHECK_RESULT.PASS).length,
      failedCheckItems: checkItems.filter(c => c.enabled && c.lastResult === CHECK_RESULT.FAIL).length,
      totalFailures: failureSamples.length,
      currentStatus: service.status,
      healthScore: service.healthScore
    };

    const dependencyDetails = dependencies.map(dep => ({
      id: dep.id,
      name: dep.name,
      url: dep.url,
      status: dep.status,
      consecutiveFailures: dep.consecutiveFailures,
      consecutiveSuccesses: dep.consecutiveSuccesses,
      lastCheckAt: dep.lastCheckAt,
      lastSuccessAt: dep.lastSuccessAt,
      lastFailureAt: dep.lastFailureAt,
      statusExplanation: this.getDependencyStatusExplanation(dep)
    }));

    const checkItemDetails = checkItems.map(item => ({
      id: item.id,
      type: item.type,
      enabled: item.enabled,
      config: item.config,
      lastResult: item.lastResult,
      lastCheckAt: item.lastCheckAt,
      statusExplanation: this.getCheckItemStatusExplanation(item)
    }));

    return {
      service: {
        id: service.id,
        name: service.name,
        description: service.description,
        owner: service.owner,
        status: service.status,
        healthScore: service.healthScore,
        statusExplanation: this.getServiceStatusExplanation(service, stats),
        degradedSince: service.degradedSince,
        recoveredAt: service.recoveredAt,
        lastCheckAt: service.lastCheckAt
      },
      stats,
      dependencies: dependencyDetails,
      checkItems: checkItemDetails,
      recentFailures: failureSamples,
      timeline,
      generatedAt: new Date()
    };
  }

  getCheckItemStatusExplanation(item) {
    if (!item.enabled) {
      return '检查项已禁用';
    }
    if (!item.lastResult) {
      return '尚未执行检查';
    }
    return item.lastResult === CHECK_RESULT.PASS ? '检查通过' : '检查失败';
  }

  getDependencyStatusExplanation(dep) {
    switch (dep.status) {
      case DEPENDENCY_STATUS.UP:
        return `依赖正常，已连续成功 ${dep.consecutiveSuccesses} 次`;
      case DEPENDENCY_STATUS.DOWN:
        return `依赖故障，已连续失败 ${dep.consecutiveFailures} 次，建议立即处理`;
      case DEPENDENCY_STATUS.DEGRADED:
        return `依赖异常，连续失败 ${dep.consecutiveFailures} 次，持续失败将导致服务降级`;
      case DEPENDENCY_STATUS.UNKNOWN:
        return '未进行健康检查，状态未知';
      default:
        return '未知状态';
    }
  }

  getServiceStatusExplanation(service, stats) {
    const base = `当前健康分数: ${service.healthScore}/100。`;
    
    switch (service.status) {
      case SERVICE_STATUS.HEALTHY:
        return base + `所有 ${stats.healthyDeps} 个依赖运行正常，服务状态良好。`;
      case SERVICE_STATUS.DEGRADED:
        return base + `${stats.degradedDeps} 个依赖异常，${stats.downDeps} 个依赖故障。服务已降级运行。`;
      case SERVICE_STATUS.UNHEALTHY:
        return base + `${stats.downDeps} 个依赖严重故障，服务不可用。请立即排查！`;
      case SERVICE_STATUS.RECOVERING:
        return base + '部分依赖已恢复，服务正在恢复中。';
      default:
        return base + '状态未知。';
    }
  }

  exportReportCSV(serviceId) {
    const report = this.generateHealthReport(serviceId);
    
    let csv = '类型,名称,状态,状态说明,详细信息\n';
    
    csv += `服务,${report.service.name},${report.service.status},"${report.service.statusExplanation}",健康分数: ${report.service.healthScore}\n`;
    
    report.dependencies.forEach(dep => {
      csv += `依赖,${dep.name},${dep.status},"${dep.statusExplanation}","连续失败: ${dep.consecutiveFailures}, 连续成功: ${dep.consecutiveSuccesses}"\n`;
    });
    
    report.checkItems.forEach(item => {
      csv += `检查项,${item.type},${item.enabled ? (item.lastResult || '未检查') : '已禁用'},"${item.statusExplanation}","配置: ${JSON.stringify(item.config)}"\n`;
    });
    
    report.recentFailures.forEach(sample => {
      const depName = report.dependencies.find(d => d.id === sample.dependencyId)?.name || '未知';
      csv += `失败样本,${depName},FAIL,"${sample.errorMessage}","HTTP ${sample.statusCode}, 响应时间: ${sample.responseTime}ms"\n`;
    });
    
    return csv;
  }

  batchImportServices(servicesData) {
    const results = {
      success: [],
      failed: [],
      total: servicesData.length
    };

    for (const serviceData of servicesData) {
      try {
        const service = store.addService({
          name: serviceData.name,
          description: serviceData.description,
          owner: serviceData.owner,
          tags: serviceData.tags || []
        });

        if (serviceData.dependencies) {
          for (const depData of serviceData.dependencies) {
            store.addDependency({
              serviceId: service.id,
              name: depData.name,
              url: depData.url,
              method: depData.method,
              timeout: depData.timeout,
              expectedStatus: depData.expectedStatus
            });
          }
        }

        results.success.push({
          id: service.id,
          name: service.name
        });
      } catch (error) {
        results.failed.push({
          name: serviceData.name,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = new HealthCheckEngine();
