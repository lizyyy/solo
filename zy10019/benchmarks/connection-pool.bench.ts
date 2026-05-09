import { PoolService } from '../src/core/pool-service';
import { PoolConfig } from '../src/types';

const benchConfig: PoolConfig = {
  name: 'benchmark-pool',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'benchmark',
    user: 'benchmark',
    password: 'benchmark'
  },
  min: 5,
  max: 20,
  acquireTimeout: 10000,
  idleTimeout: 60000,
  reapInterval: 30000,
  testOnBorrow: true,
  testOnReturn: false,
  testWhileIdle: true
};

interface BenchmarkResult {
  testName: string;
  totalOperations: number;
  duration: number;
  opsPerSecond: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  maxLatency: number;
  minLatency: number;
  errors: number;
}

interface LatencyStats {
  avg: number;
  p95: number;
  p99: number;
  max: number;
  min: number;
}

function calculateLatencyStats(latencies: number[]): LatencyStats {
  if (latencies.length === 0) {
    return { avg: 0, p95: 0, p99: 0, max: 0, min: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = sum / sorted.length;
  
  const p95Index = Math.floor(sorted.length * 0.95);
  const p99Index = Math.floor(sorted.length * 0.99);
  
  return {
    avg,
    p95: sorted[p95Index] || 0,
    p99: sorted[p99Index] || 0,
    max: sorted[sorted.length - 1] || 0,
    min: sorted[0] || 0
  };
}

async function benchmarkConcurrentAcquire(
  pool: PoolService,
  concurrency: number,
  operationsPerClient: number
): Promise<BenchmarkResult> {
  const latencies: number[] = [];
  let errors = 0;
  const startTime = Date.now();

  const clients = Array.from({ length: concurrency }, (_, clientIndex) => 
    (async () => {
      for (let i = 0; i < operationsPerClient; i++) {
        const opStart = Date.now();
        try {
          await pool.execute(
            async (conn) => {
              const connection = await conn;
              await new Promise(resolve => setTimeout(resolve, 10));
              return await connection.query(`SELECT ${clientIndex}_${i}`);
            },
            { requestId: `bench-${clientIndex}-${i}` }
          );
          latencies.push(Date.now() - opStart);
        } catch {
          errors++;
        }
      }
    })()
  );

  await Promise.all(clients);

  const duration = Date.now() - startTime;
  const totalOperations = concurrency * operationsPerClient;
  const latencyStats = calculateLatencyStats(latencies);

  return {
    testName: `Concurrent Acquire (${concurrency} clients)`,
    totalOperations,
    duration,
    opsPerSecond: totalOperations / (duration / 1000),
    avgLatency: latencyStats.avg,
    p95Latency: latencyStats.p95,
    p99Latency: latencyStats.p99,
    maxLatency: latencyStats.max,
    minLatency: latencyStats.min,
    errors
  };
}

async function benchmarkPoolExhaustion(
  pool: PoolService,
  maxConnections: number,
  totalRequests: number
): Promise<BenchmarkResult> {
  const latencies: number[] = [];
  let errors = 0;
  const startTime = Date.now();

  const requests = Array.from({ length: totalRequests }, (_, i) => 
    (async () => {
      const opStart = Date.now();
      try {
        await pool.execute(
          async (conn) => {
            const connection = await conn;
            await new Promise(resolve => setTimeout(resolve, 50));
            return await connection.query(`SELECT ${i}`);
          },
          { requestId: `exhaust-${i}`, timeout: 5000 }
        );
        latencies.push(Date.now() - opStart);
      } catch {
        errors++;
      }
    })()
  );

  await Promise.all(requests);

  const duration = Date.now() - startTime;
  const latencyStats = calculateLatencyStats(latencies);

  return {
    testName: `Pool Exhaustion (${maxConnections} max)`,
    totalOperations: totalRequests,
    duration,
    opsPerSecond: totalOperations / (duration / 1000),
    avgLatency: latencyStats.avg,
    p95Latency: latencyStats.p95,
    p99Latency: latencyStats.p99,
    maxLatency: latencyStats.max,
    minLatency: latencyStats.min,
    errors
  };
}

async function benchmarkCacheStrategy(
  pool: PoolService,
  cacheKey: string,
  operations: number
): Promise<BenchmarkResult> {
  const latencies: number[] = [];
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < operations; i++) {
    const opStart = Date.now();
    try {
      await pool.executeWithCache(
        cacheKey,
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { data: 'cached', timestamp: Date.now() };
        },
        { strategy: 'read-through', ttl: 60000 }
      );
      latencies.push(Date.now() - opStart);
    } catch {
      errors++;
    }
  }

  const duration = Date.now() - startTime;
  const latencyStats = calculateLatencyStats(latencies);

  return {
    testName: 'Cache Strategy (Read-Through)',
    totalOperations: operations,
    duration,
    opsPerSecond: operations / (duration / 1000),
    avgLatency: latencyStats.avg,
    p95Latency: latencyStats.p95,
    p99Latency: latencyStats.p99,
    maxLatency: latencyStats.max,
    minLatency: latencyStats.min,
    errors
  };
}

async function benchmarkCircuitBreaker(
  pool: PoolService,
  failureRate: number,
  operations: number
): Promise<BenchmarkResult> {
  const latencies: number[] = [];
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < operations; i++) {
    const opStart = Date.now();
    try {
      const shouldFail = Math.random() < failureRate;
      await pool.execute(
        async (conn) => {
          const connection = await conn;
          if (shouldFail) {
            throw new Error('Simulated failure');
          }
          return await connection.query('SELECT 1');
        },
        { requestId: `cb-${i}` }
      );
      latencies.push(Date.now() - opStart);
    } catch {
      errors++;
    }
  }

  const duration = Date.now() - startTime;
  const latencyStats = calculateLatencyStats(latencies);

  return {
    testName: `Circuit Breaker (${failureRate * 100}% failures)`,
    totalOperations: operations,
    duration,
    opsPerSecond: operations / (duration / 1000),
    avgLatency: latencyStats.avg,
    p95Latency: latencyStats.p95,
    p99Latency: latencyStats.p99,
    maxLatency: latencyStats.max,
    minLatency: latencyStats.min,
    errors
  };
}

function printResult(result: BenchmarkResult): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test: ${result.testName}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Total Operations: ${result.totalOperations.toLocaleString()}`);
  console.log(`  Duration: ${result.duration} ms`);
  console.log(`  Throughput: ${result.opsPerSecond.toFixed(2)} ops/sec`);
  console.log(`\n  Latency:`);
  console.log(`    Average: ${result.avgLatency.toFixed(2)} ms`);
  console.log(`    P95:     ${result.p95Latency.toFixed(2)} ms`);
  console.log(`    P99:     ${result.p99Latency.toFixed(2)} ms`);
  console.log(`    Min:     ${result.minLatency.toFixed(2)} ms`);
  console.log(`    Max:     ${result.maxLatency.toFixed(2)} ms`);
  console.log(`\n  Errors: ${result.errors} (${(result.errors / result.totalOperations * 100).toFixed(2)}%)`);
}

async function runAllBenchmarks(): Promise<void> {
  console.log('\nStarting Connection Pool Benchmarks...\n');

  const pool = new PoolService(
    { pool: benchConfig, cacheStrategy: 'read-through' },
    {
      enableEvents: true,
      enableCache: true,
      enableCircuitBreaker: true,
      enableRetry: true,
      enableIdempotency: true
    }
  );

  try {
    console.log('Initializing pool...');
    await pool.initialize();
    console.log('Pool initialized.\n');

    const results: BenchmarkResult[] = [];

    console.log('Running benchmark 1: Concurrent Acquire (low concurrency)...');
    results.push(await benchmarkConcurrentAcquire(pool, 10, 100));
    
    console.log('Running benchmark 2: Concurrent Acquire (high concurrency)...');
    results.push(await benchmarkConcurrentAcquire(pool, 50, 50));
    
    console.log('Running benchmark 3: Pool Exhaustion...');
    results.push(await benchmarkPoolExhaustion(pool, benchConfig.max, 100));
    
    console.log('Running benchmark 4: Cache Strategy...');
    results.push(await benchmarkCacheStrategy(pool, 'benchmark-cache-key', 100));
    
    console.log('Running benchmark 5: Circuit Breaker (10% failures)...');
    results.push(await benchmarkCircuitBreaker(pool, 0.1, 100));
    
    console.log('Running benchmark 6: Circuit Breaker (50% failures)...');
    results.push(await benchmarkCircuitBreaker(pool, 0.5, 100));

    console.log('\n' + '='.repeat(70));
    console.log('BENCHMARK RESULTS SUMMARY');
    console.log('='.repeat(70));

    results.forEach(printResult);

    console.log(`\n${'='.repeat(70)}`);
    console.log('All benchmarks completed!');
    console.log(`${'='.repeat(70)}\n`);

  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  } finally {
    await pool.close();
  }
}

runAllBenchmarks().catch(console.error);
