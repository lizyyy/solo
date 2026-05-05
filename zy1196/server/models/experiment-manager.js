const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const EXPERIMENTS_DIR = path.join(__dirname, '../../data/experiments');

class ExperimentManager {
  constructor() {
    this.experiments = new Map();
    this.ensureDirectoryExists();
  }

  ensureDirectoryExists() {
    if (!fs.existsSync(EXPERIMENTS_DIR)) {
      fs.mkdirSync(EXPERIMENTS_DIR, { recursive: true });
    }
  }

  createExperiment(config) {
    const experiment = {
      id: uuidv4(),
      name: config.name || `实验-${Date.now()}`,
      description: config.description || '',
      config: {
        connectionCount: config.connectionCount || 10,
        bufferSize: config.bufferSize || 1024,
        dataArrivalTime: config.dataArrivalTime || 100,
        dataArrivalJitter: config.dataArrivalJitter || 20,
        processingTime: config.processingTime || 50,
        processingJitter: config.processingJitter || 10,
        timeout: config.timeout || 5000,
        models: config.models || ['blocking', 'non_blocking', 'multiplexing', 'async']
      },
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      status: 'created',
      results: {},
      comparison: null
    };

    this.experiments.set(experiment.id, experiment);
    return experiment;
  }

  getExperiment(id) {
    return this.experiments.get(id);
  }

  getAllExperiments() {
    return Array.from(this.experiments.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  updateExperimentStatus(id, status, extra = {}) {
    const experiment = this.experiments.get(id);
    if (!experiment) return null;

    experiment.status = status;
    Object.assign(experiment, extra);
    return experiment;
  }

  addModelResult(experimentId, modelType, result) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;

    experiment.results[modelType] = result;
    return experiment;
  }

  generateComparison(experiment) {
    if (!experiment || Object.keys(experiment.results).length === 0) {
      return null;
    }

    const comparison = {
      summary: {},
      detailed: {},
      rankings: {}
    };

    const metrics = [
      'totalTime',
      'throughputBytes',
      'threadCount',
      'cpuSpins',
      'pollCount',
      'emptyPollCount',
      'eventLoopTicks',
      'avgWaitTime',
      'avgProcessingTime'
    ];

    const metricLabels = {
      totalTime: '总耗时',
      throughputBytes: '吞吐量 (B/s)',
      threadCount: '线程数',
      cpuSpins: 'CPU 空转次数',
      pollCount: '轮询次数',
      emptyPollCount: '空轮询次数',
      eventLoopTicks: '事件循环 tick 数',
      avgWaitTime: '平均等待时间 (ms)',
      avgProcessingTime: '平均处理时间 (ms)'
    };

    for (const metric of metrics) {
      comparison.detailed[metric] = {
        label: metricLabels[metric] || metric,
        values: {}
      };
    }

    for (const [modelType, result] of Object.entries(experiment.results)) {
      const metrics = result.metrics;
      comparison.summary[modelType] = {
        modelName: result.modelName,
        totalTime: metrics.totalTime,
        throughput: metrics.throughput,
        threadCount: metrics.threadCount,
        completed: metrics.completedCount,
        timeout: metrics.timeoutCount
      };

      comparison.detailed.totalTime.values[modelType] = metrics.totalTime;
      comparison.detailed.throughputBytes.values[modelType] = metrics.throughputBytes;
      comparison.detailed.threadCount.values[modelType] = metrics.threadCount;
      comparison.detailed.cpuSpins.values[modelType] = metrics.cpuSpins;
      comparison.detailed.pollCount.values[modelType] = metrics.pollCount;
      comparison.detailed.emptyPollCount.values[modelType] = metrics.emptyPollCount;
      comparison.detailed.eventLoopTicks.values[modelType] = metrics.eventLoopTicks;
      comparison.detailed.avgWaitTime.values[modelType] = metrics.avgWaitTime;
      comparison.detailed.avgProcessingTime.values[modelType] = metrics.avgProcessingTime;
    }

    comparison.rankings = this.calculateRankings(comparison.detailed);

    return comparison;
  }

  calculateRankings(detailed) {
    const rankings = {};
    
    const lowerIsBetter = ['totalTime', 'threadCount', 'cpuSpins', 'emptyPollCount', 'avgWaitTime', 'avgProcessingTime'];
    const higherIsBetter = ['throughputBytes'];

    for (const [metric, data] of Object.entries(detailed)) {
      const entries = Object.entries(data.values);
      
      entries.sort((a, b) => {
        if (lowerIsBetter.includes(metric)) {
          return a[1] - b[1];
        } else if (higherIsBetter.includes(metric)) {
          return b[1] - a[1];
        }
        return 0;
      });

      rankings[metric] = {
        label: data.label,
        ranked: entries.map(([modelType, value], index) => ({
          modelType,
          value,
          rank: index + 1
        }))
      };
    }

    return rankings;
  }

  exportToMarkdown(experiment) {
    const comparison = this.generateComparison(experiment);
    if (!comparison) {
      return `# ${experiment.name}\n\n*暂无可用数据*\n`;
    }

    let markdown = `# ${experiment.name}\n\n`;
    
    if (experiment.description) {
      markdown += `> ${experiment.description}\n\n`;
    }

    markdown += `## 实验配置\n\n`;
    markdown += `| 参数 | 值 |\n|------|-----|\n`;
    markdown += `| 连接数 | ${experiment.config.connectionCount} |\n`;
    markdown += `| 缓冲区大小 | ${experiment.config.bufferSize} bytes |\n`;
    markdown += `| 数据到达时间 | ${experiment.config.dataArrivalTime}ms (±${experiment.config.dataArrivalJitter}ms) |\n`;
    markdown += `| 处理耗时 | ${experiment.config.processingTime}ms (±${experiment.config.processingJitter}ms) |\n`;
    markdown += `| 超时时间 | ${experiment.config.timeout}ms |\n`;
    markdown += `| 测试模型 | ${experiment.config.models.join(', ')} |\n\n`;

    markdown += `## 结果概览\n\n`;
    markdown += `| 模型 | 总耗时 | 吞吐量 | 线程数 | 完成数 | 超时数 |\n`;
    markdown += `|------|--------|--------|--------|--------|--------|\n`;
    
    for (const [modelType, summary] of Object.entries(comparison.summary)) {
      markdown += `| ${summary.modelName} | ${summary.totalTime}ms | ${summary.throughput} | ${summary.threadCount} | ${summary.completed} | ${summary.timeout} |\n`;
    }
    markdown += `\n`;

    markdown += `## 详细对比\n\n`;
    
    for (const [metric, data] of Object.entries(comparison.detailed)) {
      markdown += `### ${data.label}\n\n`;
      markdown += `| 模型 | 值 |\n|------|-----|\n`;
      
      const ranked = comparison.rankings[metric]?.ranked || [];
      for (const item of ranked) {
        const modelName = comparison.summary[item.modelType]?.modelName || item.modelType;
        let displayValue = item.value;
        if (metric === 'throughputBytes') {
          displayValue = `${(item.value / 1024).toFixed(2)} KB/s`;
        } else if (typeof item.value === 'number') {
          displayValue = item.value.toFixed(2);
        }
        
        const rankEmoji = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : '';
        markdown += `| ${rankEmoji} ${modelName} | ${displayValue} |\n`;
      }
      markdown += `\n`;
    }

    markdown += `## 各模型分析\n\n`;
    
    const modelDescriptions = {
      blocking: `### 阻塞 I/O\n\n**特点：**\n- 每个连接一个线程\n- 调用 read/write 会阻塞直到数据就绪\n- 实现简单，但线程开销大\n\n**适用场景：**\n- 连接数少且稳定\n- 对实时性要求不高\n`,
      non_blocking: `### 非阻塞 I/O\n\n**特点：**\n- 单线程处理\n- 轮询检查 fd 状态\n- 可能产生大量空轮询\n\n**问题：**\n- CPU 空转严重\n- 需要频繁系统调用\n`,
      multiplexing: `### I/O 多路复用\n\n**特点：**\n- 单线程 + epoll/select/poll\n- 批量等待多个 fd\n- 就绪后逐个处理\n\n**优势：**\n- 线程数少\n- 空轮询少\n- 适合高并发\n`,
      async: `### 异步 I/O\n\n**特点：**\n- 提交请求后立即返回\n- 内核完成后通知\n- 真正的异步处理\n\n**优势：**\n- 最理想的高并发模型\n- 最少的上下文切换\n`
    };

    for (const modelType of Object.keys(comparison.summary)) {
      if (modelDescriptions[modelType]) {
        markdown += modelDescriptions[modelType] + '\n';
      }
    }

    markdown += `---\n\n*生成时间: ${new Date(experiment.completedAt || Date.now()).toISOString()}*\n`;
    markdown += `*实验 ID: ${experiment.id}*\n`;

    return markdown;
  }

  exportToJSON(experiment) {
    const comparison = this.generateComparison(experiment);
    return JSON.stringify({
      experiment,
      comparison
    }, null, 2);
  }

  saveExperiment(experiment) {
    this.ensureDirectoryExists();
    const filePath = path.join(EXPERIMENTS_DIR, `${experiment.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(experiment, null, 2));
  }

  loadExperiment(id) {
    const filePath = path.join(EXPERIMENTS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      this.experiments.set(data.id, data);
      return data;
    }
    return null;
  }

  deleteExperiment(id) {
    const experiment = this.experiments.get(id);
    if (experiment) {
      this.experiments.delete(id);
      const filePath = path.join(EXPERIMENTS_DIR, `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    }
    return false;
  }

  loadAllExperiments() {
    this.ensureDirectoryExists();
    const files = fs.readdirSync(EXPERIMENTS_DIR).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      try {
        const id = file.replace('.json', '');
        this.loadExperiment(id);
      } catch (e) {
        console.error(`加载实验文件失败: ${file}`, e);
      }
    }
  }
}

const experimentManager = new ExperimentManager();
experimentManager.loadAllExperiments();

module.exports = experimentManager;
