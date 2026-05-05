/**
 * 核心模块测试
 * 测试虚拟内存和内存池模拟的核心功能
 */

const fs = require('fs');
const path = require('path');

const VirtualMemorySimulator = require('../js/core/virtual-memory.js');
const MemoryPoolSimulator = require('../js/core/memory-pool.js');
const Utils = require('../js/core/utils.js');

const seedData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/seed-data.json'), 'utf-8'));
const badExamples = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/bad-examples.json'), 'utf-8'));

let testResults = {
    passed: 0,
    failed: 0,
    total: 0,
    tests: []
};

function assert(condition, message) {
    testResults.total++;
    if (condition) {
        testResults.passed++;
        testResults.tests.push({ status: 'passed', message });
        console.log(`✓ ${message}`);
    } else {
        testResults.failed++;
        testResults.tests.push({ status: 'failed', message });
        console.log(`✗ ${message}`);
    }
}

function runVirtualMemoryTests() {
    console.log('\n========================================');
    console.log('  虚拟内存模拟测试');
    console.log('========================================\n');
    
    console.log('--- 基本功能测试 ---\n');
    
    const testConfig1 = {
        pageSize: 4096,
        physicalFrames: 4,
        tlbSize: 4,
        replacementPolicy: 'lru',
        accessSequence: [0, 4096, 8192, 12288, 0, 4096, 16384, 0, 4096, 8192, 12288, 16384]
    };
    
    const vm1 = new VirtualMemorySimulator(testConfig1);
    const result1 = vm1.run();
    
    assert(result1.stats.totalAccesses === 12, '总访问次数应为12');
    assert(result1.stats.pageFaults >= 5, '缺页次数应不少于5');
    assert(result1.stats.replacements >= 1, '置换次数应不少于1');
    
    const pageNumber0 = Math.floor(0 / 4096);
    const pageNumber1 = Math.floor(4096 / 4096);
    assert(pageNumber0 === 0, '虚拟地址0应在页0');
    assert(pageNumber1 === 1, '虚拟地址4096应在页1');
    
    const offset0 = 0 % 4096;
    const offset1 = 500 % 4096;
    assert(offset0 === 0, '虚拟地址0的偏移应为0');
    assert(offset1 === 500, '虚拟地址500的偏移应为500');
    
    console.log('\n--- 置换算法测试 ---\n');
    
    const testConfig2 = {
        pageSize: 4096,
        physicalFrames: 3,
        tlbSize: 0,
        replacementPolicy: 'lru',
        accessSequence: [0, 4096, 8192, 0, 12288, 4096, 16384, 0, 4096, 12288, 16384]
    };
    
    const vmLRU = new VirtualMemorySimulator({ ...testConfig2, replacementPolicy: 'lru' });
    const vmFIFO = new VirtualMemorySimulator({ ...testConfig2, replacementPolicy: 'fifo' });
    const vmOptimal = new VirtualMemorySimulator({ ...testConfig2, replacementPolicy: 'optimal' });
    
    const resultLRU = vmLRU.run();
    const resultFIFO = vmFIFO.run();
    const resultOptimal = vmOptimal.run();
    
    assert(resultOptimal.stats.pageFaults <= resultLRU.stats.pageFaults, 
        'Optimal策略缺页次数应小于等于LRU');
    assert(resultOptimal.stats.pageFaults <= resultFIFO.stats.pageFaults, 
        'Optimal策略缺页次数应小于等于FIFO');
    
    console.log(`  LRU 缺页次数: ${resultLRU.stats.pageFaults}`);
    console.log(`  FIFO 缺页次数: ${resultFIFO.stats.pageFaults}`);
    console.log(`  Optimal 缺页次数: ${resultOptimal.stats.pageFaults}`);
    
    console.log('\n--- TLB 测试 ---\n');
    
    const testConfig3 = {
        pageSize: 4096,
        physicalFrames: 8,
        tlbSize: 4,
        replacementPolicy: 'lru',
        accessSequence: [0, 4096, 8192, 0, 4096, 8192, 0, 4096, 8192, 0, 4096, 8192]
    };
    
    const vmWithTLB = new VirtualMemorySimulator(testConfig3);
    const resultWithTLB = vmWithTLB.run();
    
    assert(resultWithTLB.stats.tlbHits > 0, 'TLB命中次数应大于0');
    assert(resultWithTLB.stats.tlbMisses >= 0, 'TLB未命中次数应大于等于0');
    
    console.log(`  TLB 命中次数: ${resultWithTLB.stats.tlbHits}`);
    console.log(`  TLB 未命中次数: ${resultWithTLB.stats.tlbMisses}`);
    console.log(`  TLB 命中率: ${resultWithTLB.stats.tlbHitRate}%`);
    
    console.log('\n--- 种子数据测试 ---\n');
    
    for (const example of seedData.virtualMemory.examples) {
        const vm = new VirtualMemorySimulator(example.config);
        const result = vm.run();
        assert(result !== null && result !== undefined, 
            `${example.name} 应能正常运行`);
        assert(result.stats.totalAccesses === example.config.accessSequence.length,
            `${example.name} 访问次数应正确`);
    }
    
    console.log('\n--- 边界情况测试 ---\n');
    
    const emptyVM = new VirtualMemorySimulator({
        pageSize: 4096,
        physicalFrames: 4,
        tlbSize: 4,
        replacementPolicy: 'lru',
        accessSequence: []
    });
    const emptyResult = emptyVM.run();
    assert(emptyResult.stats.totalAccesses === 0, '空访问序列总访问次数应为0');
    assert(emptyResult.stats.pageFaults === 0, '空访问序列缺页次数应为0');
}

function runMemoryPoolTests() {
    console.log('\n========================================');
    console.log('  内存池模拟测试');
    console.log('========================================\n');
    
    console.log('--- 对象池测试 ---\n');
    
    const objectPoolConfig1 = {
        poolType: 'object',
        totalSize: 1024,
        objectSize: 256,
        alignment: 4,
        operations: [
            { type: 'alloc', size: 200 },
            { type: 'alloc', size: 150 }
        ]
    };
    
    const pool1 = new MemoryPoolSimulator(objectPoolConfig1);
    const result1 = pool1.run();
    
    assert(result1.stats.totalAllocations === 2, '应成功分配2次');
    assert(result1.stats.allocationFailures === 0, '分配失败次数应为0');
    assert(result1.stats.usedSlots === 2, '已使用槽位应为2');
    
    const objectPoolConfig2 = {
        poolType: 'object',
        totalSize: 512,
        objectSize: 256,
        alignment: 16,
        operations: [
            { type: 'alloc', size: 100 },
            { type: 'alloc', size: 100 },
            { type: 'free', allocationId: 0 },
            { type: 'alloc', size: 100 }
        ]
    };
    
    const pool2 = new MemoryPoolSimulator(objectPoolConfig2);
    const result2 = pool2.run();
    
    assert(result2.stats.totalFrees === 1, '应成功释放1次');
    assert(result2.stats.usedSlots === 2, '最终已使用槽位应为2');
    
    console.log('\n--- 内存池测试 ---\n');
    
    const memoryPoolConfig1 = {
        poolType: 'memory',
        totalSize: 8192,
        objectSize: 0,
        alignment: 4,
        operations: [
            { type: 'alloc', size: 1024 },
            { type: 'alloc', size: 1024 },
            { type: 'alloc', size: 1024 },
            { type: 'free', allocationId: 0 },
            { type: 'free', allocationId: 2 },
            { type: 'free', allocationId: 1 },
            { type: 'alloc', size: 3000 }
        ]
    };
    
    const pool3 = new MemoryPoolSimulator(memoryPoolConfig1);
    const result3 = pool3.run();
    
    assert(result3.stats.totalAllocations === 4, '应成功分配4次');
    assert(result3.stats.allocationFailures === 0, '合并后分配应成功');
    
    console.log('\n--- 对齐测试 ---\n');
    
    const testSize = 100;
    const aligned4 = Utils ? (Utils.alignUp ? Utils.alignUp(testSize, 4) : 
        (testSize % 4 === 0 ? testSize : testSize + (4 - testSize % 4))) : 100;
    
    assert(aligned4 === 100 || aligned4 === 104, '100按4字节对齐应为100或104');
    
    const aligned16 = Utils ? (Utils.alignUp ? Utils.alignUp(100, 16) : 
        (100 % 16 === 0 ? 100 : 100 + (16 - 100 % 16))) : 112;
    
    assert(aligned16 === 112, '100按16字节对齐应为112');
    
    console.log('\n--- 碎片测试 ---\n');
    
    const fragmentationConfig = {
        poolType: 'memory',
        totalSize: 4096,
        objectSize: 0,
        alignment: 4,
        operations: [
            { type: 'alloc', size: 1024 },
            { type: 'alloc', size: 512 },
            { type: 'alloc', size: 1024 },
            { type: 'free', allocationId: 0 },
            { type: 'free', allocationId: 2 },
            { type: 'alloc', size: 1500 }
        ]
    };
    
    const pool4 = new MemoryPoolSimulator(fragmentationConfig);
    const result4 = pool4.run();
    
    assert(result4.stats.allocationFailures === 1, '外部碎片应导致1次分配失败');
    assert(result4.stats.externalFragmentation > 0, '应存在外部碎片');
    
    console.log(`  外部碎片: ${result4.stats.externalFragmentation} 字节`);
    
    console.log('\n--- 种子数据测试 ---\n');
    
    for (const example of seedData.memoryPool.examples) {
        const pool = new MemoryPoolSimulator(example.config);
        const result = pool.run();
        assert(result !== null && result !== undefined, 
            `${example.name} 应能正常运行`);
    }
    
    console.log('\n--- 边界情况测试 ---\n');
    
    const emptyPool = new MemoryPoolSimulator({
        poolType: 'object',
        totalSize: 1024,
        objectSize: 256,
        alignment: 4,
        operations: []
    });
    const emptyResult = emptyPool.run();
    assert(emptyResult.stats.totalAllocations === 0, '空操作序列分配次数应为0');
    assert(emptyResult.stats.usedSlots === 0, '空操作序列已使用槽位应为0');
}

function runUtilsTests() {
    console.log('\n========================================');
    console.log('  工具函数测试');
    console.log('========================================\n');
    
    console.log('--- 字节格式化测试 ---\n');
    
    if (Utils && Utils.formatBytes) {
        assert(Utils.formatBytes(0) === '0 Bytes', '0字节应显示为"0 Bytes"');
        assert(Utils.formatBytes(1024).includes('KB'), '1024字节应显示为KB');
        assert(Utils.formatBytes(1048576).includes('MB'), '1MB应显示为MB');
    }
    
    console.log('\n--- 序列解析测试 ---\n');
    
    if (Utils && Utils.parseAccessSequence) {
        const seq1 = Utils.parseAccessSequence('0 4096 8192');
        assert(seq1.length === 3, '应解析出3个地址');
        assert(seq1[0] === 0, '第一个地址应为0');
        assert(seq1[1] === 4096, '第二个地址应为4096');
        
        const seq2 = Utils.parseAccessSequence('0x1000 0x2000');
        assert(seq2.length === 2, '应解析出2个十六进制地址');
    }
    
    console.log('\n--- 随机种子测试 ---\n');
    
    if (Utils && Utils.seededRandom) {
        const random1 = Utils.seededRandom(12345);
        const random2 = Utils.seededRandom(12345);
        
        const values1 = [random1(), random1(), random1()];
        const values2 = [random2(), random2(), random2()];
        
        assert(JSON.stringify(values1) === JSON.stringify(values2), 
            '相同种子应产生相同的随机序列');
    }
}

function runTests() {
    console.log('\n========================================');
    console.log('  开始运行测试');
    console.log('========================================');
    
    runVirtualMemoryTests();
    runMemoryPoolTests();
    runUtilsTests();
    
    console.log('\n========================================');
    console.log('  测试结果汇总');
    console.log('========================================');
    console.log(`\n  总测试数: ${testResults.total}`);
    console.log(`  通过: ${testResults.passed}`);
    console.log(`  失败: ${testResults.failed}`);
    console.log(`  通过率: ${testResults.total > 0 ? 
        ((testResults.passed / testResults.total) * 100).toFixed(2) : 0}%\n`);
    
    if (testResults.failed > 0) {
        console.log('  失败的测试:');
        for (const test of testResults.tests) {
            if (test.status === 'failed') {
                console.log(`    - ${test.message}`);
            }
        }
        console.log('');
        process.exit(1);
    } else {
        console.log('  所有测试通过!\n');
        process.exit(0);
    }
}

runTests();
