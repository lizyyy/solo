import { v4 as uuidv4 } from 'uuid';
import { Store } from '../data/store.js';
import { DegradeAction, ServiceStatus, DrillStatus } from '../data/types.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const simulatorService = {
  async simulateRequest(plan, isRecoveryRun = false) {
    const requestId = uuidv4();
    const trace = [];
    const timestamp = new Date().toISOString();

    const traceEvent = (serviceId, event, data = {}) => {
      trace.push({
        id: uuidv4(),
        serviceId,
        event,
        timestamp: new Date().toISOString(),
        data,
      });
    };

    traceEvent('gateway', 'REQUEST_START', {
      endpoint: plan.endpoint,
      method: plan.method,
      isRecoveryRun,
    });

    const injectFaults = isRecoveryRun ? [] : plan.injectedFaults;
    let finalResponse = null;
    let finalAction = null;
    let blocked = false;
    let blockReason = '';
    const matchedRules = [];

    const simulatedServices = this._getEndpointServices(plan.endpoint);

    for (const serviceId of simulatedServices) {
      const fault = injectFaults.find((f) => f.serviceId === serviceId);

      if (!fault) {
        traceEvent(serviceId, 'CALL_SUCCESS', {
          response: this._getHealthyResponse(serviceId, plan.requestBody),
        });
        continue;
      }

      traceEvent(serviceId, 'FAULT_INJECTED', {
        faultType: fault.faultType,
        timeoutMs: fault.timeoutMs,
      });

      if (fault.faultType === 'timeout') {
        await delay(Math.min(fault.timeoutMs || 1000, 3000));
      }

      const rule = Store.findMatchingRule(serviceId, fault.faultType);

      if (rule) {
        matchedRules.push(rule);
        traceEvent(serviceId, 'RULE_MATCHED', {
          ruleId: rule.id,
          ruleName: rule.name,
          action: rule.action,
        });

        switch (rule.action) {
          case DegradeAction.BLOCK:
            blocked = true;
            blockReason = `${serviceId} 触发阻断规则: ${rule.name}`;
            traceEvent(serviceId, 'DEGRADE_BLOCK', { reason: blockReason });
            break;

          case DegradeAction.CACHE:
            if (Store.isCacheValid(serviceId)) {
              const cacheEntry = Store.getCacheEntry(serviceId);
              finalAction = {
                type: 'cache',
                serviceId,
                ruleName: rule.name,
                data: cacheEntry.data,
                expired: false,
                age: Math.floor((Date.now() - cacheEntry.timestamp) / 1000),
              };
              traceEvent(serviceId, 'DEGRADE_CACHE', {
                cacheData: cacheEntry.data,
                cacheAge: finalAction.age,
              });
            } else {
              const cacheEntry = Store.getCacheEntry(serviceId);
              finalAction = {
                type: 'cache_expired',
                serviceId,
                ruleName: rule.name,
                data: cacheEntry?.data || null,
                expired: true,
              };
              traceEvent(serviceId, 'CACHE_EXPIRED', {
                age: Math.floor((Date.now() - (cacheEntry?.timestamp || 0)) / 1000),
              });

              if (Store.isCoreService(serviceId)) {
                blocked = true;
                blockReason = `${serviceId} 核心接口缓存过期，禁止静默降级`;
                traceEvent(serviceId, 'CORE_BLOCK_NO_SILENT', { reason: blockReason });
              }
            }
            break;

          case DegradeAction.FALLBACK:
            finalAction = {
              type: 'fallback',
              serviceId,
              ruleName: rule.name,
              data: rule.fallbackData,
            };
            traceEvent(serviceId, 'DEGRADE_FALLBACK', {
              fallbackData: rule.fallbackData,
            });
            break;

          case DegradeAction.NO_DEGRADE:
            traceEvent(serviceId, 'NO_DEGRADE_CONFIGURED');
            break;
        }
      } else {
        traceEvent(serviceId, 'NO_RULE_MATCHED');
        if (Store.isCoreService(serviceId)) {
          blocked = true;
          blockReason = `${serviceId} 核心接口无降级规则，禁止静默失败`;
          traceEvent(serviceId, 'CORE_BLOCK_NO_RULE', { reason: blockReason });
        }
      }
    }

    let userVisibleResult = '';
    let success = false;

    if (blocked) {
      userVisibleResult = `请求被拒绝: ${blockReason}`;
      finalResponse = {
        success: false,
        error: blockReason,
        code: 'DEGRADE_BLOCKED',
      };
    } else if (finalAction) {
      userVisibleResult = this._describeUserImpact(finalAction);
      finalResponse = {
        success: true,
        data: this._buildFinalResponse(plan.endpoint, finalAction, plan.requestBody),
        degraded: true,
        degradeInfo: finalAction,
      };
      success = true;
    } else {
      userVisibleResult = '请求正常完成，未触发降级';
      finalResponse = {
        success: true,
        data: this._buildHealthyResponse(plan.endpoint, plan.requestBody),
      };
      success = true;
    }

    traceEvent('gateway', 'REQUEST_COMPLETE', {
      success,
      blocked,
      action: finalAction,
      userVisibleResult,
    });

    return {
      requestId,
      timestamp,
      trace,
      matchedRules,
      blocked,
      finalAction,
      userVisibleResult,
      response: finalResponse,
      success,
    };
  },

  _getEndpointServices(endpoint) {
    const mapping = {
      '/api/v1/homepage': ['gateway', 'recommend-service', 'member-service'],
      '/api/v1/order': ['gateway', 'order-service', 'inventory-service', 'price-service'],
      '/api/v1/member/benefits': ['gateway', 'member-service', 'benefit-service'],
    };
    return mapping[endpoint] || ['gateway'];
  },

  _getHealthyResponse(serviceId, body) {
    const responses = {
      'recommend-service': {
        products: [
          { id: 1, name: '新品推荐 A', price: 299, score: 98 },
          { id: 2, name: '新品推荐 B', price: 599, score: 95 },
        ],
      },
      'member-service': {
        memberLevel: 'gold',
        discount: 0.85,
        points: 12580,
      },
      'order-service': {
        orderId: 'ORD-' + Date.now(),
        status: 'created',
      },
      'inventory-service': {
        stockLeft: 98,
        deducted: body?.quantity || 1,
      },
      'price-service': {
        finalPrice: 254.15,
        originalPrice: 299,
        discount: 0.85,
        memberDiscount: true,
      },
      'benefit-service': {
        coupons: ['满100减20', '免邮券'],
        memberDay: '每月15日',
      },
    };
    return responses[serviceId] || { success: true };
  },

  _buildHealthyResponse(endpoint, body) {
    const responses = {
      '/api/v1/homepage': {
        banner: '首页推荐',
        recommendations: [
          { id: 1, name: '新品推荐 A', price: 299 },
          { id: 2, name: '新品推荐 B', price: 599 },
        ],
        userInfo: {
          memberLevel: 'gold',
          discount: 0.85,
        },
      },
      '/api/v1/order': {
        orderId: 'ORD-' + Date.now(),
        status: 'created',
        stockInfo: { stockLeft: 98 },
        priceInfo: { finalPrice: 254.15, originalPrice: 299 },
      },
      '/api/v1/member/benefits': {
        memberLevel: 'gold',
        coupons: ['满100减20', '免邮券'],
        points: 12580,
      },
    };
    return responses[endpoint] || { success: true };
  },

  _buildFinalResponse(endpoint, action, body) {
    const base = this._buildHealthyResponse(endpoint, body);

    if (action.type === 'cache' || action.type === 'cache_expired') {
      if (action.serviceId === 'recommend-service') {
        return {
          ...base,
          recommendations: action.data?.products || [],
          degradedNotice: action.type === 'cache_expired'
            ? '⚠️ 使用过期缓存数据'
            : '⚠️ 推荐服务降级，使用缓存数据',
        };
      }
    }

    if (action.type === 'fallback') {
      if (action.serviceId === 'member-service') {
        return {
          ...base,
          userInfo: {
            memberLevel: 'normal',
            discount: 1.0,
            degradedNotice: '⚠️ 会员服务降级，以普通用户身份处理',
          },
        };
      }
      if (action.serviceId === 'price-service') {
        return {
          ...base,
          priceInfo: {
            ...action.data,
            degradedNotice: '⚠️ 价格服务降级，使用兜底价格',
          },
        };
      }
    }

    return base;
  },

  _describeUserImpact(action) {
    const impacts = {
      cache: '使用本地缓存数据展示，数据可能不是最新',
      cache_expired: '使用已过期的缓存数据，数据存在不确定性',
      fallback: '使用预设兜底数据，部分功能可能受限',
    };
    return `${action.serviceId} 触发降级策略 [${action.ruleName}]，用户影响：${impacts[action.type] || '未知'}`;
  },

  async executeDrill(planId) {
    const plan = Store.getDrillPlanById(planId);
    if (!plan) {
      throw new Error(`演练计划不存在: ${planId}`);
    }

    const current = Store.getCurrentDrill();
    if (current && current.status === DrillStatus.RUNNING) {
      throw new Error(`演练进行中，不可重复启动。当前演练: ${current.planName}`);
    }

    const drillId = uuidv4();
    const drill = {
      id: drillId,
      planId: plan.id,
      planName: plan.name,
      status: DrillStatus.RUNNING,
      startedAt: new Date().toISOString(),
      baselineResult: null,
      degradedResult: null,
      recoveryResult: null,
      comparison: null,
    };

    Store.setCurrentDrill(drill);

    try {
      drill.baselineResult = await this.simulateRequest(plan, false);

      const degradedPlan = { ...plan, injectedFaults: plan.injectedFaults };
      drill.degradedResult = await this.simulateRequest(degradedPlan, false);

      drill.status = DrillStatus.COMPLETED;
      drill.completedAt = new Date().toISOString();
      drill.comparison = this._compareResults(
        drill.baselineResult,
        drill.degradedResult
      );
      drill.summary = this._generateSummary(drill);

      Store.saveDrillResult(drill);
      Store.setCurrentDrill(null);

      return drill;
    } catch (error) {
      drill.status = DrillStatus.FAILED;
      drill.error = error.message;
      drill.completedAt = new Date().toISOString();
      Store.saveDrillResult(drill);
      Store.setCurrentDrill(null);
      throw error;
    }
  },

  async runRecovery(originalResultId) {
    const original = Store.getDrillResultById(originalResultId);
    if (!original) {
      throw new Error(`原演练结果不存在: ${originalResultId}`);
    }

    const plan = Store.getDrillPlanById(original.planId);
    if (!plan) {
      throw new Error(`演练计划已被删除`);
    }

    const recoveryResult = await this.simulateRequest(plan, true);

    original.recoveryResult = recoveryResult;
    original.recoveryRunAt = new Date().toISOString();
    original.recoveryComparison = this._compareResults(
      original.baselineResult,
      recoveryResult
    );
    original.recoveryPassed =
      original.recoveryComparison?.differences?.length === 0;

    Store.saveDrillResult(original);
    return original;
  },

  _compareResults(baseline, test) {
    const differences = [];

    if (baseline.success !== test.success) {
      differences.push({
        field: 'success',
        baseline: baseline.success,
        test: test.success,
        impact: '请求成功状态变化',
      });
    }

    if (baseline.blocked !== test.blocked) {
      differences.push({
        field: 'blocked',
        baseline: baseline.blocked,
        test: test.blocked,
        impact: '请求阻断状态变化',
      });
    }

    if (baseline.matchedRules?.length !== test.matchedRules?.length) {
      differences.push({
        field: 'matchedRules',
        baseline: baseline.matchedRules?.length || 0,
        test: test.matchedRules?.length || 0,
        impact: '命中降级规则数量变化',
      });
    }

    if (baseline.userVisibleResult !== test.userVisibleResult) {
      differences.push({
        field: 'userVisibleResult',
        baseline: baseline.userVisibleResult,
        test: test.userVisibleResult,
        impact: '用户可见结果变化',
      });
    }

    return {
      hasDifferences: differences.length > 0,
      differences,
    };
  },

  _generateSummary(drill) {
    const degraded = drill.degradedResult;
    const baseline = drill.baselineResult;

    const summary = {
      planName: drill.planName,
      runAt: drill.startedAt,
      faultInjections: drill.degradedResult?.trace?.filter(t => t.event === 'FAULT_INJECTED').map(t => ({
        service: t.serviceId,
        fault: t.data?.faultType,
      })) || [],
      userImpact: degraded?.userVisibleResult || '无影响',
      ruleMatches: degraded?.matchedRules?.map(r => r.name) || [],
      success: drill.status === DrillStatus.COMPLETED,
      baselineSuccess: baseline?.success,
      degradedSuccess: degraded?.success,
      degradedBlocked: degraded?.blocked,
    };

    return summary;
  },
};
