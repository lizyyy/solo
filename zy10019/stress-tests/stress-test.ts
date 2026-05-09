import autocannon from 'autocannon';
import { PoolService } from '../src/core/pool-service';
import { PoolConfig } from '../src/types';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';

const stressConfig: PoolConfig = {
  name: 'stress-test-pool',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'stress',
    user: 'stress',
    password: 'stress'
  },
  min: 10,
  max: 50,
  acquireTimeout: 30000,
  idleTimeout: 60000,
  reapInterval: 30000,
  testOnBorrow: true,
  testOnReturn: false,
  testWhileIdle: true
};

interface StressTestResult {
  testName: string;
  duration: number;
  requests: {
    total: number;
    average: number;
    mean: number;
    stddev: number;
    min: number;
    max: number;
  };
  latency: {
    average: number;
    mean: number;
    stddev: number;
    min: number;
    max: number;
    p50: number;
    p75: number;
    p90: number;
    p99: number;
    p999: number;
  };
  throughput: {
    average: number;
    mean: number;
    stddev: number;
    min: number;
    max: number;
  };
  errors: number;
  timeouts: number;
  non2xx: number;
}

function formatAutocannonResult(result: autocannon.Result, testName: string): StressTestResult {
  return {
    testName,
    duration: result.duration,
    requests: {
      total: result.requests.total,
      average: result.requests.average,
      mean: result.requests.mean,
      stddev: result.requests.stddev,
      min: result.requests.min,
      max: result.requests.max
    },
    latency: {
      average: result.latency.average,
      mean: result.latency.mean,
      stddev: result.latency.stddev,
      min: result.latency.min,
      max: result.latency.max,
      p50: result.latency.p50,
      p75: result.latency.p75,
      p90: result.latency.p90,
      p99: result.latency.p99,
      p999: result.latency.p999
    },
    throughput: {
      average: result.throughput.average,
      mean: result.throughput.mean,
      stddev: result.throughput.stddev,
      min: result.throughput.min,
      max: result.throughput.max
    },
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx: result.non2xx
  };
}

function printStressResult(result: StressTestResult): void {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`STRESS TEST RESULTS: ${result.testName}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`\n📊 Summary`);
  console.log(`  Duration: ${result.duration} seconds`);
  console.log(`  Total Requests: ${result.requests.total.toLocaleString()}`);
  console.log(`  Errors: ${result.errors}`);
  console.log(`  Timeouts: ${result.timeouts}`);
  console.log(`  Non-2xx: ${result.non2xx}`);
  
  console.log(`\n🚀 Throughput`);
  console.log(`  Average: ${result.throughput.average.toFixed(2)} req/sec`);
  console.log(`  Mean: ${result.throughput.mean.toFixed(2)} req/sec`);
  console.log(`  Min: ${result.throughput.min} req/sec`);
  console.log(`  Max: ${result.throughput.max} req/sec`);

  console.log(`\n⏱️ Latency (ms)`);
  console.log(`  Average: ${result.latency.average.toFixed(2)}`);
  console.log(`  p50: ${result.latency.p50}`);
  console.log(`  p75: ${result.latency.p75}`);
  console.log(`  p90: ${result.latency.p90}`);
  console.log(`  p99: ${result.latency.p99}`);
  console.log(`  p999: ${result.latency.p999}`);
  console.log(`  Min: ${result.latency.min}`);
  console.log(`  Max: ${result.latency.max}`);
  console.log(`${'='.repeat(80)}\n`);
}

async function runStressTest(
  url: string,
  testName: string,
  options: {
    duration: number;
    connections: number;
    pipelining?: number;
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  }
): Promise<StressTestResult> {
  console.log(`\n🚨 Starting stress test: ${testName}`);
  console.log(`   URL: ${url}`);
  console.log(`   Duration: ${options.duration}s`);
  console.log(`   Connections: ${options.connections}`);
  console.log(`   Pipelining: ${options.pipelining ?? 1}\n`);

  const result = await autocannon({
    url,
    duration: options.duration,
    connections: options.connections,
    pipelining: options.pipelining ?? 1,
    method: options.method ?? 'GET',
    body: options.body,
    headers: options.headers,
    timeout: 10
  });

  const formatted = formatAutocannonResult(result, testName);
  printStressResult(formatted);
  return formatted;
}

async function startTestServer(): Promise<{ app: express.Application; server: any; pool: PoolService }> {
  const app = express();
  app.use(helmet());
  app.use(compression());
  app.use(express.json());

  const pool = new PoolService(
    { pool: stressConfig, cacheStrategy: 'read-through' },
    {
      enableEvents: true,
      enableCache: true,
      enableCircuitBreaker: true,
      enableRetry: true,
      enableIdempotency: true
    }
  );

  await pool.initialize();

  app.get('/health', (req, res) => {
    const health = pool.healthCheck();
    res.json(health);
  });

  app.get('/api/metrics', (req, res) => {
    const metrics = pool.getMetrics();
    res.json(metrics);
  });

  app.post('/api/execute', async (req, res) => {
    try {
      const { query, params } = req.body;
      const result = await pool.execute(
        async (conn) => {
          const connection = await conn;
          return await connection.query(query || 'SELECT 1', params);
        }
      );
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  app.get('/api/report', (req, res) => {
    const report = pool.generateReport();
    res.setHeader('Content-Type', 'text/markdown');
    res.send(report);
  });

  const server = app.listen(0, () => {
    const addr = server.address() as any;
    console.log(`Test server running on port ${addr.port}`);
  });

  return { app, server, pool };
}

async function runAllStressTests(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('🚨 CONNECTION POOL STRESS TESTING');
  console.log('='.repeat(80));

  const { server, pool } = await startTestServer();
  const addr = server.address() as any;
  const baseUrl = `http://localhost:${addr.port}`;

  try {
    const results: StressTestResult[] = [];

    results.push(await runStressTest(
      `${baseUrl}/health`,
      'Health Check (Low Load)',
      {
        duration: 10,
        connections: 10,
        pipelining: 1
      }
    ));

    results.push(await runStressTest(
      `${baseUrl}/api/metrics`,
      'Metrics Endpoint (Medium Load)',
      {
        duration: 30,
        connections: 50,
        pipelining: 5
      }
    ));

    results.push(await runStressTest(
      `${baseUrl}/api/execute`,
      'Query Execution (High Load)',
      {
        duration: 60,
        connections: 100,
        pipelining: 10,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT 1' })
      }
    ));

    results.push(await runStressTest(
      `${baseUrl}/api/execute`,
      'Query Execution (Extreme Load)',
      {
        duration: 30,
        connections: 200,
        pipelining: 20,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT 1' })
      }
    ));

    console.log('\n' + '='.repeat(80));
    console.log('📊 STRESS TEST SUMMARY');
    console.log('='.repeat(80));

    results.forEach((result, index) => {
      console.log(`\nTest ${index + 1}: ${result.testName}`);
      console.log(`  Throughput: ${result.throughput.average.toFixed(2)} req/sec`);
      console.log(`  Avg Latency: ${result.latency.average.toFixed(2)} ms`);
      console.log(`  p99 Latency: ${result.latency.p99} ms`);
      console.log(`  Errors: ${result.errors}`);
    });

    console.log('\nGenerating performance report...');
    const reportPath = `./reports/stress-test-report-${Date.now()}.md`;
    await pool.saveReport(reportPath, {
      title: 'Stress Test Performance Report',
      includeEvents: true,
      maxEvents: 500
    });
    console.log(`Report saved to: ${reportPath}`);

  } finally {
    await pool.close();
    server.close();
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ All stress tests completed!');
  console.log('='.repeat(80) + '\n');
}

runAllStressTests().catch(console.error);
