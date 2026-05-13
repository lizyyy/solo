const { v4: uuidv4 } = require('uuid');

class CompressionService {
  constructor() {
    this.strategies = new Map();
    this.clients = new Map();
    this.history = [];
    this._initializeDefaultData();
  }

  _initializeDefaultData() {
    this.clients.set('ios_1.0.0', {
      id: 'ios_1.0.0',
      platform: 'ios',
      version: '1.0.0',
      capabilities: {
        gzip: false,
        deflate: false,
        br: false
      },
      description: 'iOS旧版本客户端，不支持压缩'
    });

    this.clients.set('ios_2.0.0', {
      id: 'ios_2.0.0',
      platform: 'ios',
      version: '2.0.0',
      capabilities: {
        gzip: true,
        deflate: true,
        br: false
      },
      description: 'iOS新版本客户端，支持gzip和deflate'
    });

    this.clients.set('android_1.5.0', {
      id: 'android_1.5.0',
      platform: 'android',
      version: '1.5.0',
      capabilities: {
        gzip: false,
        deflate: false,
        br: false
      },
      description: 'Android旧版本客户端，不支持压缩'
    });

    this.clients.set('android_2.5.0', {
      id: 'android_2.5.0',
      platform: 'android',
      version: '2.5.0',
      capabilities: {
        gzip: true,
        deflate: true,
        br: true
      },
      description: 'Android新版本客户端，支持所有压缩算法'
    });

    const defaultStrategy = {
      id: uuidv4(),
      name: '默认抱怨列表压缩策略',
      description: '针对抱怨列表接口的压缩策略',
      apiGroups: ['/api/complaints', '/api/complaints/*'],
      contentTypes: ['application/json'],
      excludedContentTypes: ['image/', 'video/', 'audio/', 'application/gzip', 'application/zip'],
      minResponseSize: 1024,
      maxResponseSize: 10 * 1024 * 1024,
      rules: [
        {
          id: 'rule_1',
          priority: 1,
          name: '旧客户端跳过',
          condition: {
            type: 'client_capability',
            operator: 'not_support',
            value: ['gzip', 'deflate', 'br']
          },
          action: 'skip',
          reason: '客户端不支持任何压缩算法'
        },
        {
          id: 'rule_2',
          priority: 2,
          name: '小响应跳过',
          condition: {
            type: 'response_size',
            operator: 'less_than',
            value: 1024
          },
          action: 'skip',
          reason: '响应大小小于阈值，压缩收益不明显'
        },
        {
          id: 'rule_3',
          priority: 3,
          name: '图片或已压缩内容跳过',
          condition: {
            type: 'content_type',
            operator: 'matches',
            value: ['image/', 'video/', 'audio/', 'application/gzip', 'application/zip']
          },
          action: 'skip',
          reason: '内容类型不适合压缩或已压缩'
        },
        {
          id: 'rule_4',
          priority: 4,
          name: '大JSON压缩',
          condition: {
            type: 'content_type',
            operator: 'equals',
            value: 'application/json'
          },
          action: 'compress',
          compressionAlgorithm: 'gzip',
          compressionLevel: 6
        }
      ],
      grayStrategy: {
        enabled: true,
        type: 'percentage',
        percentage: 100,
        clientVersions: ['ios_2.0.0', 'android_2.5.0'],
        startTime: new Date('2024-01-01').toISOString(),
        endTime: null
      },
      status: 'active',
      version: 1,
      previousVersions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.strategies.set(defaultStrategy.id, defaultStrategy);
  }

  getAllStrategies() {
    return Array.from(this.strategies.values());
  }

  getStrategyById(id) {
    return this.strategies.get(id);
  }

  createStrategy(data) {
    const id = uuidv4();
    const strategy = {
      id,
      name: data.name,
      description: data.description || '',
      apiGroups: data.apiGroups || [],
      contentTypes: data.contentTypes || ['application/json'],
      excludedContentTypes: data.excludedContentTypes || [],
      minResponseSize: data.minResponseSize || 1024,
      maxResponseSize: data.maxResponseSize || 10 * 1024 * 1024,
      rules: data.rules || [],
      grayStrategy: data.grayStrategy || {
        enabled: false,
        type: 'percentage',
        percentage: 100,
        clientVersions: [],
        startTime: new Date().toISOString(),
        endTime: null
      },
      status: 'active',
      version: 1,
      previousVersions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.strategies.set(id, strategy);
    return strategy;
  }

  updateStrategy(id, data) {
    const strategy = this.strategies.get(id);
    if (!strategy) return null;

    const previousVersion = { ...strategy };
    delete previousVersion.previousVersions;

    const updatedStrategy = {
      ...strategy,
      name: data.name !== undefined ? data.name : strategy.name,
      description: data.description !== undefined ? data.description : strategy.description,
      apiGroups: data.apiGroups !== undefined ? data.apiGroups : strategy.apiGroups,
      contentTypes: data.contentTypes !== undefined ? data.contentTypes : strategy.contentTypes,
      excludedContentTypes: data.excludedContentTypes !== undefined ? data.excludedContentTypes : strategy.excludedContentTypes,
      minResponseSize: data.minResponseSize !== undefined ? data.minResponseSize : strategy.minResponseSize,
      maxResponseSize: data.maxResponseSize !== undefined ? data.maxResponseSize : strategy.maxResponseSize,
      rules: data.rules !== undefined ? data.rules : strategy.rules,
      grayStrategy: data.grayStrategy !== undefined ? data.grayStrategy : strategy.grayStrategy,
      status: data.status !== undefined ? data.status : strategy.status,
      version: strategy.version + 1,
      previousVersions: [...strategy.previousVersions, previousVersion],
      updatedAt: new Date().toISOString()
    };

    this.strategies.set(id, updatedStrategy);
    return updatedStrategy;
  }

  deleteStrategy(id) {
    return this.strategies.delete(id);
  }

  rollbackStrategy(id) {
    const strategy = this.strategies.get(id);
    if (!strategy || strategy.previousVersions.length === 0) return null;

    const previousVersion = strategy.previousVersions[strategy.previousVersions.length - 1];
    const newPreviousVersions = strategy.previousVersions.slice(0, -1);

    const rolledBackStrategy = {
      ...previousVersion,
      version: strategy.version + 1,
      previousVersions: newPreviousVersions,
      updatedAt: new Date().toISOString()
    };

    this.strategies.set(id, rolledBackStrategy);
    return rolledBackStrategy;
  }

  getAllClients() {
    return Array.from(this.clients.values());
  }

  getClientById(id) {
    return this.clients.get(id);
  }

  createClient(data) {
    const id = data.id || `${data.platform}_${data.version}`;
    const client = {
      id,
      platform: data.platform,
      version: data.version,
      capabilities: data.capabilities || {
        gzip: false,
        deflate: false,
        br: false
      },
      description: data.description || ''
    };
    this.clients.set(id, client);
    return client;
  }

  _matchApiGroup(path, apiGroups) {
    for (const group of apiGroups) {
      if (group.endsWith('/*')) {
        const prefix = group.slice(0, -1);
        if (path.startsWith(prefix)) return true;
      }
      if (path === group) return true;
    }
    return false;
  }

  _matchContentType(contentType, patterns) {
    for (const pattern of patterns) {
      if (pattern.endsWith('/')) {
        if (contentType.startsWith(pattern)) return true;
      }
      if (contentType === pattern) return true;
    }
    return false;
  }

  _isInGrayStrategy(strategy, clientId) {
    if (!strategy.grayStrategy.enabled) return true;

    const gray = strategy.grayStrategy;
    const now = new Date();

    if (gray.startTime && new Date(gray.startTime) > now) return false;
    if (gray.endTime && new Date(gray.endTime) < now) return false;

    if (gray.type === 'version' && gray.clientVersions.length > 0) {
      return gray.clientVersions.includes(clientId);
    }

    if (gray.type === 'percentage') {
      const hash = this._simpleHash(clientId);
      return (hash % 100) < gray.percentage;
    }

    return true;
  }

  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  _evaluateRule(rule, request, client, response) {
    const condition = rule.condition;

    switch (condition.type) {
      case 'client_capability': {
        const supportsAny = condition.value.some(algo => client.capabilities[algo]);
        if (condition.operator === 'not_support') return !supportsAny;
        if (condition.operator === 'support') return supportsAny;
        return false;
      }
      case 'response_size': {
        const size = response.size;
        if (condition.operator === 'less_than') return size < condition.value;
        if (condition.operator === 'greater_than') return size > condition.value;
        if (condition.operator === 'equals') return size === condition.value;
        return false;
      }
      case 'content_type': {
        const contentType = response.contentType;
        if (condition.operator === 'matches') {
          return this._matchContentType(contentType, condition.value);
        }
        if (condition.operator === 'equals') {
          return contentType === condition.value;
        }
        return false;
      }
      default:
        return false;
    }
  }

  _estimateCompressionRatio(contentType, size) {
    if (contentType === 'application/json') {
      if (size > 100000) return 0.15;
      if (size > 10000) return 0.2;
      return 0.25;
    }
    if (contentType.startsWith('text/')) {
      return 0.3;
    }
    return 0.5;
  }

  simulateRequest(requestData) {
    const { clientId, path, responseSize, contentType } = requestData;

    if (!clientId) throw new Error('缺少clientId参数');
    if (!path) throw new Error('缺少path参数');
    if (responseSize === undefined) throw new Error('缺少responseSize参数');
    if (!contentType) throw new Error('缺少contentType参数');

    const client = this.clients.get(clientId);
    if (!client) throw new Error(`客户端 ${clientId} 不存在`);

    const matchingStrategies = Array.from(this.strategies.values()).filter(strategy => {
      if (strategy.status !== 'active') return false;
      return this._matchApiGroup(path, strategy.apiGroups);
    });

    if (matchingStrategies.length === 0) {
      const record = {
        id: uuidv4(),
        clientId,
        path,
        responseSize,
        contentType,
        timestamp: new Date().toISOString(),
        decision: 'skip',
        reason: '无匹配策略',
        matchedStrategy: null,
        matchedRule: null,
        compressionAlgorithm: null,
        originalSize: responseSize,
        compressedSize: responseSize,
        savingsBytes: 0,
        savingsRatio: 0,
        isOldClientSkipped: false,
        compatibleRisk: false,
        inGray: false
      };
      this.history.push(record);
      return record;
    }

    const strategy = matchingStrategies[0];
    const inGray = this._isInGrayStrategy(strategy, clientId);

    if (!inGray) {
      const record = {
        id: uuidv4(),
        clientId,
        path,
        responseSize,
        contentType,
        timestamp: new Date().toISOString(),
        decision: 'skip',
        reason: '不在灰度范围内',
        matchedStrategy: strategy.id,
        matchedRule: null,
        compressionAlgorithm: null,
        originalSize: responseSize,
        compressedSize: responseSize,
        savingsBytes: 0,
        savingsRatio: 0,
        isOldClientSkipped: false,
        compatibleRisk: false,
        inGray: false
      };
      this.history.push(record);
      return record;
    }

    const sortedRules = [...strategy.rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      const matches = this._evaluateRule(rule, requestData, client, { size: responseSize, contentType });

      if (matches) {
        let decision = rule.action;
        let compressionAlgorithm = null;
        let compressedSize = responseSize;
        let savingsBytes = 0;
        let savingsRatio = 0;
        let isOldClientSkipped = false;
        let compatibleRisk = false;

        if (decision === 'compress') {
          const supportsAlgorithm = client.capabilities[rule.compressionAlgorithm];
          if (!supportsAlgorithm) {
            decision = 'skip';
            isOldClientSkipped = true;
          } else {
            compressionAlgorithm = rule.compressionAlgorithm;
            const ratio = this._estimateCompressionRatio(contentType, responseSize);
            compressedSize = Math.round(responseSize * ratio);
            savingsBytes = responseSize - compressedSize;
            savingsRatio = (savingsBytes / responseSize * 100).toFixed(2);
          }
        }

        if (decision === 'skip' && rule.id === 'rule_1') {
          isOldClientSkipped = true;
        }

        const record = {
          id: uuidv4(),
          clientId,
          path,
          responseSize,
          contentType,
          timestamp: new Date().toISOString(),
          decision,
          reason: rule.reason || `命中规则: ${rule.name}`,
          matchedStrategy: strategy.id,
          matchedRule: rule.id,
          matchedRuleName: rule.name,
          compressionAlgorithm,
          originalSize: responseSize,
          compressedSize,
          savingsBytes,
          savingsRatio,
          isOldClientSkipped,
          compatibleRisk,
          inGray: true
        };
        this.history.push(record);
        return record;
      }
    }

    const record = {
      id: uuidv4(),
      clientId,
      path,
      responseSize,
      contentType,
      timestamp: new Date().toISOString(),
      decision: 'skip',
      reason: '无匹配规则',
      matchedStrategy: strategy.id,
      matchedRule: null,
      compressionAlgorithm: null,
      originalSize: responseSize,
      compressedSize: responseSize,
      savingsBytes: 0,
      savingsRatio: 0,
      isOldClientSkipped: false,
      compatibleRisk: false,
      inGray: true
    };
    this.history.push(record);
    return record;
  }

  getHistory() {
    return this.history.slice().reverse();
  }

  getHistoryById(id) {
    return this.history.find(h => h.id === id);
  }

  queryStatistics() {
    const history = this.history;

    if (history.length === 0) {
      return {
        totalRequests: 0,
        compressedRequests: 0,
        skippedRequests: 0,
        totalSavingsBytes: 0,
        averageSavingsRatio: 0,
        hitRules: {},
        clientVersionStats: {},
        compatibleRisk: {
          hasRisk: false,
          riskDetails: [],
          oldClientSkipped: 0,
          oldClientSkippedRatio: 0
        }
      };
    }

    const totalRequests = history.length;
    const compressedRequests = history.filter(h => h.decision === 'compress').length;
    const skippedRequests = history.filter(h => h.decision === 'skip').length;
    const totalSavingsBytes = history.reduce((sum, h) => sum + h.savingsBytes, 0);
    const compressedHistory = history.filter(h => h.decision === 'compress');
    const averageSavingsRatio = compressedHistory.length > 0
      ? (compressedHistory.reduce((sum, h) => sum + parseFloat(h.savingsRatio), 0) / compressedHistory.length).toFixed(2)
      : 0;

    const hitRules = {};
    history.forEach(h => {
      if (h.matchedRule) {
        const key = h.matchedRuleName || h.matchedRule;
        if (!hitRules[key]) {
          hitRules[key] = { count: 0, compressed: 0, skipped: 0 };
        }
        hitRules[key].count++;
        if (h.decision === 'compress') hitRules[key].compressed++;
        if (h.decision === 'skip') hitRules[key].skipped++;
      }
    });

    const clientVersionStats = {};
    history.forEach(h => {
      if (!clientVersionStats[h.clientId]) {
        clientVersionStats[h.clientId] = {
          totalRequests: 0,
          compressedRequests: 0,
          skippedRequests: 0,
          totalSavingsBytes: 0,
          averageSavingsRatio: 0,
          isOldClient: false,
          isOldClientSkipped: 0
        };
      }
      const stats = clientVersionStats[h.clientId];
      stats.totalRequests++;
      if (h.decision === 'compress') {
        stats.compressedRequests++;
      }
      if (h.decision === 'skip') {
        stats.skippedRequests++;
      }
      stats.totalSavingsBytes += h.savingsBytes;
      if (h.isOldClientSkipped) {
        stats.isOldClientSkipped++;
        stats.isOldClient = true;
      }
    });

    Object.keys(clientVersionStats).forEach(clientId => {
      const stats = clientVersionStats[clientId];
      if (stats.compressedRequests > 0) {
        const clientHistory = history.filter(h => h.clientId === clientId && h.decision === 'compress');
        stats.averageSavingsRatio = (clientHistory.reduce((sum, h) => sum + parseFloat(h.savingsRatio), 0) / clientHistory.length).toFixed(2);
      }
    });

    const oldClientSkipped = history.filter(h => h.isOldClientSkipped).length;
    const oldClientSkippedRatio = totalRequests > 0 ? (oldClientSkipped / totalRequests * 100).toFixed(2) : 0;

    const hasRisk = oldClientSkippedRatio > 20;
    const riskDetails = [];
    if (hasRisk) {
      riskDetails.push(`旧客户端跳过比例过高: ${oldClientSkippedRatio}%，建议检查灰度策略`);
    }

    return {
      totalRequests,
      compressedRequests,
      skippedRequests,
      totalSavingsBytes,
      averageSavingsRatio,
      hitRules,
      clientVersionStats,
      compatibleRisk: {
        hasRisk,
        riskDetails,
        oldClientSkipped,
        oldClientSkippedRatio
      }
    };
  }
}

module.exports = new CompressionService();
