const { initDatabase } = require('../config/database');
const Storage = require('../services/storage');
const Comparator = require('../services/comparator');

const seedData = async () => {
  console.log('Seeding benchmark data...');
  
  await initDatabase();
  
  const run1Data = {
    run_id: 'v1.0.0-commit-abc123',
    version: 'v1.0.0',
    package: 'github.com/example/service',
    notes: 'Initial baseline version',
    pprof_summary: {
      cpu: { top10: ['runtime.scanobject', 'runtime.mallocgc'] },
      memory: { top10: ['bytes.makeSlice', 'strings.Builder'] }
    }
  };
  
  const run1Benchmarks = [
    {
      name: 'BenchmarkProcessData-8',
      ns_op: 1250.5,
      b_op: 256,
      allocs_op: 3,
      mb_s: 128.5
    },
    {
      name: 'BenchmarkSerializeJSON-8',
      ns_op: 850.25,
      b_op: 512,
      allocs_op: 5,
      mb_s: 256.0
    },
    {
      name: 'BenchmarkParseRequest-8',
      ns_op: 450.75,
      b_op: 128,
      allocs_op: 2,
      mb_s: null
    },
    {
      name: 'BenchmarkCacheGet-8',
      ns_op: 150.0,
      b_op: 64,
      allocs_op: 1,
      mb_s: null
    }
  ];
  
  const run1Id = await Storage.saveBenchmarkRun(run1Data);
  await Storage.saveBenchmarkResults(run1Id, run1Benchmarks);
  console.log(`Created run: ${run1Data.run_id}`);
  
  const run2Data = {
    run_id: 'v1.1.0-commit-def456',
    version: 'v1.1.0',
    package: 'github.com/example/service',
    notes: 'Optimized JSON serialization',
    pprof_summary: {
      cpu: { top10: ['runtime.memmove', 'encoding/json.encodeState'] },
      memory: { top10: ['encoding/json.Marshal'] }
    }
  };
  
  const run2Benchmarks = [
    {
      name: 'BenchmarkProcessData-8',
      ns_op: 1375.55,
      b_op: 256,
      allocs_op: 3,
      mb_s: 116.8
    },
    {
      name: 'BenchmarkSerializeJSON-8',
      ns_op: 595.175,
      b_op: 512,
      allocs_op: 5,
      mb_s: 366.08
    },
    {
      name: 'BenchmarkParseRequest-8',
      ns_op: 450.75,
      b_op: 128,
      allocs_op: 2,
      mb_s: null
    },
    {
      name: 'BenchmarkCacheGet-8',
      ns_op: 150.0,
      b_op: 64,
      allocs_op: 1,
      mb_s: null
    }
  ];
  
  const run2Id = await Storage.saveBenchmarkRun(run2Data);
  await Storage.saveBenchmarkResults(run2Id, run2Benchmarks);
  console.log(`Created run: ${run2Data.run_id}`);
  
  const run3Data = {
    run_id: 'v2.0.0-commit-ghi789',
    version: 'v2.0.0',
    package: 'github.com/example/service',
    notes: 'Major refactor with new cache layer',
    pprof_summary: {
      cpu: { top10: ['sync.(*Mutex).Lock', 'runtime.selectgo'] },
      memory: { top10: ['sync.Map', 'bytes.Buffer'] }
    }
  };
  
  const run3Benchmarks = [
    {
      name: 'BenchmarkProcessData-8',
      ns_op: 1062.925,
      b_op: 230,
      allocs_op: 2,
      mb_s: 151.0
    },
    {
      name: 'BenchmarkSerializeJSON-8',
      ns_op: 510.15,
      b_op: 486,
      allocs_op: 4,
      mb_s: 427.5
    },
    {
      name: 'BenchmarkParseRequest-8',
      ns_op: 405.675,
      b_op: 115,
      allocs_op: 2,
      mb_s: null
    },
    {
      name: 'BenchmarkCacheGet-8',
      ns_op: 135.0,
      b_op: 58,
      allocs_op: 1,
      mb_s: null
    },
    {
      name: 'BenchmarkNewFeature-8',
      ns_op: 250.0,
      b_op: 128,
      allocs_op: 2,
      mb_s: null
    }
  ];
  
  const run3Id = await Storage.saveBenchmarkRun(run3Data);
  await Storage.saveBenchmarkResults(run3Id, run3Benchmarks);
  console.log(`Created run: ${run3Data.run_id}`);
  
  const run4Data = {
    run_id: 'v2.1.0-commit-jkl012',
    version: 'v2.1.0',
    package: 'github.com/example/service',
    notes: 'Attempted optimization but introduced regression',
    pprof_summary: {
      cpu: { top10: ['runtime.gcDrain', 'runtime.scanobject'] },
      memory: { top10: ['bytes.makeSlice', 'runtime.mallocgc'] }
    }
  };
  
  const run4Benchmarks = [
    {
      name: 'BenchmarkProcessData-8',
      ns_op: 1434.94875,
      b_op: 276,
      allocs_op: 3,
      mb_s: 111.74
    },
    {
      name: 'BenchmarkSerializeJSON-8',
      ns_op: 688.7025,
      b_op: 559,
      allocs_op: 5,
      mb_s: 316.35
    },
    {
      name: 'BenchmarkParseRequest-8',
      ns_op: 446.2425,
      b_op: 127,
      allocs_op: 2,
      mb_s: null
    },
    {
      name: 'BenchmarkCacheGet-8',
      ns_op: 148.5,
      b_op: 64,
      allocs_op: 1,
      mb_s: null
    },
    {
      name: 'BenchmarkNewFeature-8',
      ns_op: 250.0,
      b_op: 128,
      allocs_op: 2,
      mb_s: null
    }
  ];
  
  const run4Id = await Storage.saveBenchmarkRun(run4Data);
  await Storage.saveBenchmarkResults(run4Id, run4Benchmarks);
  console.log(`Created run: ${run4Data.run_id}`);
  
  console.log('\nCreating comparisons...');
  
  const comparison1 = await Comparator.saveComparison(
    run1Data.run_id,
    run2Data.run_id,
    'Comparing v1.0.0 to v1.1.0 - JSON optimization'
  );
  console.log(`Created comparison: v1.0.0 vs v1.1.0 -> ${comparison1.overallStatus}`);
  
  const comparison2 = await Comparator.saveComparison(
    run2Data.run_id,
    run3Data.run_id,
    'Comparing v1.1.0 to v2.0.0 - Major refactor'
  );
  console.log(`Created comparison: v1.1.0 vs v2.0.0 -> ${comparison2.overallStatus}`);
  
  const comparison3 = await Comparator.saveComparison(
    run3Data.run_id,
    run4Data.run_id,
    'Comparing v2.0.0 to v2.1.0 - Regression detected'
  );
  console.log(`Created comparison: v2.0.0 vs v2.1.0 -> ${comparison3.overallStatus}`);
  
  console.log('\nAdding audit tags...');
  
  await Storage.addAuditTag(
    run1Id,
    'baseline',
    'system',
    'Initial baseline version for all comparisons'
  );
  console.log('Added tag: baseline to v1.0.0');
  
  await Storage.addAuditTag(
    run2Id,
    'approved',
    'alice',
    'JSON optimization verified - 30% improvement'
  );
  console.log('Added tag: approved to v1.1.0');
  
  await Storage.addAuditTag(
    run3Id,
    'approved',
    'bob',
    'Major refactor with significant improvements'
  );
  console.log('Added tag: approved to v2.0.0');
  
  await Storage.addAuditTag(
    run4Id,
    'needs_review',
    'charlie',
    'Performance regression detected - requires investigation'
  );
  console.log('Added tag: needs_review to v2.1.0');
  
  console.log('\nSeeding complete!');
  console.log('\nSummary:');
  console.log('- 4 benchmark runs created');
  console.log('- 3 comparisons created');
  console.log('- 4 audit tags added');
};

seedData().catch(console.error);
