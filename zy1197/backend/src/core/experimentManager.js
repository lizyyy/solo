const Reactor = require('./reactor');
const Proactor = require('./proactor');
const { Event, EventTimeline } = require('./eventSystem');

class ExperimentManager {
  constructor() {
    this.experiments = new Map();
    this.activeExperiment = null;
  }

  createExperiment(config) {
    const experimentId = require('uuid').v4();
    const experiment = {
      id: experimentId,
      config: {
        name: config.name || `Experiment ${experimentId}`,
        description: config.description || '',
        seed: config.seed || Date.now(),
        connections: config.connections || 10,
        readEvents: config.readEvents || 100,
        writeEvents: config.writeEvents || 50,
        callbackDelay: config.callbackDelay || 10,
        readTimeout: config.readTimeout || 5000,
        writeTimeout: config.writeTimeout || 5000,
        failureRate: config.failureRate || 0,
        threadPoolSize: config.threadPoolSize || 4,
        handlers: config.handlers || [],
        ...config
      },
      createdAt: Date.now(),
      status: 'created',
      reactorResults: null,
      proactorResults: null,
      comparison: null
    };

    this.experiments.set(experimentId, experiment);
    return experiment;
  }

  async runExperiment(experimentId) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    experiment.status = 'running';
    this.activeExperiment = experiment;

    try {
      experiment.reactorResults = await this.runReactorTest(experiment.config);
      experiment.proactorResults = await this.runProactorTest(experiment.config);
      experiment.comparison = this.compareResults(
        experiment.reactorResults,
        experiment.proactorResults
      );
      experiment.status = 'completed';
    } catch (error) {
      experiment.status = 'failed';
      experiment.error = error.message;
    }

    experiment.completedAt = Date.now();
    return experiment;
  }

  async runReactorTest(config) {
    const reactor = new Reactor({
      maxConnections: config.connections,
      readTimeout: config.readTimeout,
      writeTimeout: config.writeTimeout,
      handlerTimeout: 10000,
      failureRate: config.failureRate,
      callbackDelay: config.callbackDelay
    });

    this.registerHandlers(reactor, config.handlers);

    reactor.start();

    const startTime = Date.now();

    for (let i = 0; i < config.connections; i++) {
      const connId = `reactor-conn-${i}`;
      reactor.createConnection(connId);
    }

    for (let i = 0; i < config.readEvents; i++) {
      const connId = `reactor-conn-${i % config.connections}`;
      reactor.simulateRead(connId, `read-data-${i}`);
      await this.delay(1);
    }

    for (let i = 0; i < config.writeEvents; i++) {
      const connId = `reactor-conn-${i % config.connections}`;
      reactor.simulateWrite(connId, `write-data-${i}`);
      await this.delay(1);
    }

    await this.waitForCompletion(reactor, config);

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    const metrics = reactor.getMetrics();
    const timeline = reactor.getTimeline();

    reactor.stop();

    return {
      model: 'Reactor',
      metrics,
      timeline: timeline.slice(0, 1000),
      executionTime: totalTime,
      throughput: metrics.eventsProcessed > 0
        ? (metrics.eventsProcessed / (totalTime / 1000)).toFixed(2)
        : 0
    };
  }

  async runProactorTest(config) {
    const proactor = new Proactor({
      maxConnections: config.connections,
      readTimeout: config.readTimeout,
      writeTimeout: config.writeTimeout,
      handlerTimeout: 10000,
      failureRate: config.failureRate,
      callbackDelay: config.callbackDelay,
      threadPoolSize: config.threadPoolSize
    });

    this.registerHandlers(proactor, config.handlers, true);

    proactor.start();

    const startTime = Date.now();

    for (let i = 0; i < config.connections; i++) {
      const connId = `proactor-conn-${i}`;
      proactor.createConnection(connId);
    }

    for (let i = 0; i < config.readEvents; i++) {
      const connId = `proactor-conn-${i % config.connections}`;
      proactor.asyncRead(connId);
      await this.delay(1);
    }

    for (let i = 0; i < config.writeEvents; i++) {
      const connId = `proactor-conn-${i % config.connections}`;
      proactor.asyncWrite(connId, `write-data-${i}`);
      await this.delay(1);
    }

    await this.waitForCompletion(proactor, config);

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    const metrics = proactor.getMetrics();
    const timeline = proactor.getTimeline();

    proactor.stop();

    return {
      model: 'Proactor',
      metrics,
      timeline: timeline.slice(0, 1000),
      executionTime: totalTime,
      throughput: metrics.eventsProcessed > 0
        ? (metrics.eventsProcessed / (totalTime / 1000)).toFixed(2)
        : 0
    };
  }

  registerHandlers(model, handlers, isProactor = false) {
    const defaultHandlers = {
      connection_accepted: (event) => {
        console.log(`[${model.constructor.name}] Connection accepted: ${event.data.connectionId}`);
      },
      connection_closed: (event) => {
        console.log(`[${model.constructor.name}] Connection closed: ${event.data.connectionId}`);
      }
    };

    if (isProactor) {
      defaultHandlers.read_completed = (event) => {
        console.log(`[Proactor] Read completed: ${event.data.connectionId} - ${event.data.data}`);
      };
      defaultHandlers.write_completed = (event) => {
        console.log(`[Proactor] Write completed: ${event.data.connectionId} - ${event.data.bytesWritten} bytes`);
      };
    } else {
      defaultHandlers.read_ready = (event) => {
        console.log(`[Reactor] Read ready: ${event.data.connectionId} - ${event.data.data}`);
      };
      defaultHandlers.write_ready = (event) => {
        console.log(`[Reactor] Write ready: ${event.data.connectionId} - ${event.data.data}`);
      };
    }

    for (const [eventType, handler] of Object.entries(defaultHandlers)) {
      model.registerHandler(eventType, handler);
    }

    handlers.forEach(handlerConfig => {
      model.registerHandler(handlerConfig.eventType, (event) => {
        console.log(`[Custom Handler] ${handlerConfig.name} processing event: ${event.id}`);
      });
    });
  }

  async waitForCompletion(model, config) {
    const maxWaitTime = 30000;
    const pollInterval = 100;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const metrics = model.getMetrics();
      if (metrics.currentQueueSize === 0 && 
          (model.threadPool ? model.threadPool.activeThreads === 0 : true)) {
        await this.delay(500);
        const metrics2 = model.getMetrics();
        if (metrics2.currentQueueSize === 0) {
          break;
        }
      }
      await this.delay(pollInterval);
    }
  }

  compareResults(reactorResults, proactorResults) {
    return {
      executionTime: {
        reactor: reactorResults.executionTime,
        proactor: proactorResults.executionTime,
        difference: reactorResults.executionTime - proactorResults.executionTime,
        winner: reactorResults.executionTime < proactorResults.executionTime ? 'Reactor' : 'Proactor'
      },
      throughput: {
        reactor: parseFloat(reactorResults.throughput),
        proactor: parseFloat(proactorResults.throughput),
        difference: parseFloat(reactorResults.throughput) - parseFloat(proactorResults.throughput),
        winner: parseFloat(reactorResults.throughput) > parseFloat(proactorResults.throughput) ? 'Reactor' : 'Proactor'
      },
      successRate: {
        reactor: parseFloat(reactorResults.metrics.successRate),
        proactor: parseFloat(proactorResults.metrics.successRate)
      },
      avgLatency: {
        reactor: parseFloat(reactorResults.metrics.avgLatency),
        proactor: parseFloat(proactorResults.metrics.avgLatency)
      },
      threadUsage: {
        reactor: 1,
        proactor: proactorResults.metrics.avgThreadUsage || 0
      },
      eventsProcessed: {
        reactor: reactorResults.metrics.eventsProcessed,
        proactor: proactorResults.metrics.eventsProcessed
      },
      eventsFailed: {
        reactor: reactorResults.metrics.eventsFailed,
        proactor: proactorResults.metrics.eventsFailed
      }
    };
  }

  getExperiment(experimentId) {
    return this.experiments.get(experimentId);
  }

  getAllExperiments() {
    return Array.from(this.experiments.values());
  }

  deleteExperiment(experimentId) {
    return this.experiments.delete(experimentId);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  exportToJSON(experimentId) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }
    return JSON.stringify(experiment, null, 2);
  }

  exportToMarkdown(experimentId) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const md = [];
    md.push(`# ${experiment.config.name}`);
    md.push('');
    md.push(`**ID:** ${experiment.id}`);
    md.push(`**Status:** ${experiment.status}`);
    md.push(`**Created:** ${new Date(experiment.createdAt).toISOString()}`);
    if (experiment.completedAt) {
      md.push(`**Completed:** ${new Date(experiment.completedAt).toISOString()}`);
    }
    md.push('');

    md.push('## Configuration');
    md.push('');
    md.push('| Parameter | Value |');
    md.push('|-----------|-------|');
    md.push(`| Connections | ${experiment.config.connections} |`);
    md.push(`| Read Events | ${experiment.config.readEvents} |`);
    md.push(`| Write Events | ${experiment.config.writeEvents} |`);
    md.push(`| Callback Delay | ${experiment.config.callbackDelay}ms |`);
    md.push(`| Failure Rate | ${(experiment.config.failureRate * 100).toFixed(1)}% |`);
    md.push(`| Thread Pool Size | ${experiment.config.threadPoolSize} |`);
    md.push('');

    if (experiment.comparison) {
      md.push('## Results Comparison');
      md.push('');
      md.push('| Metric | Reactor | Proactor | Winner |');
      md.push('|--------|---------|----------|--------|');
      md.push(`| Execution Time | ${experiment.comparison.executionTime.reactor}ms | ${experiment.comparison.executionTime.proactor}ms | ${experiment.comparison.executionTime.winner} |`);
      md.push(`| Throughput | ${experiment.comparison.throughput.reactor} events/s | ${experiment.comparison.throughput.proactor} events/s | ${experiment.comparison.throughput.winner} |`);
      md.push(`| Success Rate | ${experiment.comparison.successRate.reactor}% | ${experiment.comparison.successRate.proactor}% | - |`);
      md.push(`| Avg Latency | ${experiment.comparison.avgLatency.reactor}ms | ${experiment.comparison.avgLatency.proactor}ms | - |`);
      md.push(`| Thread Usage | ${experiment.comparison.threadUsage.reactor} thread | ${experiment.comparison.threadUsage.proactor} threads | - |`);
      md.push('');
    }

    if (experiment.reactorResults) {
      md.push('## Reactor Details');
      md.push('');
      md.push(`- **Events Processed:** ${experiment.reactorResults.metrics.eventsProcessed}`);
      md.push(`- **Events Failed:** ${experiment.reactorResults.metrics.eventsFailed}`);
      md.push(`- **Total Time:** ${experiment.reactorResults.executionTime}ms`);
      md.push(`- **Throughput:** ${experiment.reactorResults.throughput} events/s`);
      md.push('');
    }

    if (experiment.proactorResults) {
      md.push('## Proactor Details');
      md.push('');
      md.push(`- **Events Processed:** ${experiment.proactorResults.metrics.eventsProcessed}`);
      md.push(`- **Events Failed:** ${experiment.proactorResults.metrics.eventsFailed}`);
      md.push(`- **Total Time:** ${experiment.proactorResults.executionTime}ms`);
      md.push(`- **Throughput:** ${experiment.proactorResults.throughput} events/s`);
      md.push(`- **Avg Thread Usage:** ${experiment.proactorResults.metrics.avgThreadUsage} threads`);
      md.push('');
    }

    return md.join('\n');
  }
}

module.exports = ExperimentManager;
