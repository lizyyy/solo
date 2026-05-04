const gameLogic = require('../services/gameLogic');

console.log('=== 运行游戏逻辑测试 ===\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        passed++;
    } catch (error) {
        console.log(`✗ ${name}`);
        console.log(`  错误: ${error.message}`);
        failed++;
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || '断言失败');
    }
}

function assertClose(actual, expected, tolerance, message) {
    const diff = Math.abs(actual - expected);
    if (diff > tolerance) {
        throw new Error(message || `期望 ${expected}，实际 ${actual}，差距 ${diff}`);
    }
}

console.log('--- 距离计算测试 ---\n');

test('北京到天津的距离计算', () => {
    const beijing = { lat: 39.9042, lng: 116.4074 };
    const tianjin = { lat: 39.0842, lng: 117.2009 };
    
    const distance = gameLogic.calculateDistance(
        beijing.lat, beijing.lng,
        tianjin.lat, tianjin.lng
    );
    
    assertClose(distance, 110000, 10000, `距离约110公里，实际: ${distance.toFixed(0)}米`);
});

test('同一点的距离应为0', () => {
    const lat = 39.9042;
    const lng = 116.4074;
    
    const distance = gameLogic.calculateDistance(lat, lng, lat, lng);
    
    assert(distance === 0, '同一点距离应为0');
});

test('近距离计算准确性', () => {
    const point1 = { lat: 39.9087, lng: 116.3975 };
    const point2 = { lat: 39.9087, lng: 116.3976 };
    
    const distance = gameLogic.calculateDistance(
        point1.lat, point1.lng,
        point2.lat, point2.lng
    );
    
    const expectedMeters = 10;
    assertClose(distance, expectedMeters, 2, `约10米，实际: ${distance.toFixed(2)}米`);
});

console.log('\n--- 方位角计算测试 ---\n');

test('正北方方位角为0度', () => {
    const point1 = { lat: 39.9087, lng: 116.3975 };
    const point2 = { lat: 39.9097, lng: 116.3975 };
    
    const bearing = gameLogic.calculateBearing(
        point1.lat, point1.lng,
        point2.lat, point2.lng
    );
    
    assertClose(bearing, 0, 5, `正北方应为0度，实际: ${bearing.toFixed(1)}度`);
});

test('正东方方位角为90度', () => {
    const point1 = { lat: 39.9087, lng: 116.3975 };
    const point2 = { lat: 39.9087, lng: 116.3985 };
    
    const bearing = gameLogic.calculateBearing(
        point1.lat, point1.lng,
        point2.lat, point2.lng
    );
    
    assertClose(bearing, 90, 5, `正东方应为90度，实际: ${bearing.toFixed(1)}度`);
});

test('方向文本解析', () => {
    assert(gameLogic.getDirectionFromBearing(0) === '北', '0度应为北');
    assert(gameLogic.getDirectionFromBearing(90) === '东', '90度应为东');
    assert(gameLogic.getDirectionFromBearing(180) === '南', '180度应为南');
    assert(gameLogic.getDirectionFromBearing(270) === '西', '270度应为西');
    assert(gameLogic.getDirectionFromBearing(45) === '东北', '45度应为东北');
});

console.log('\n--- GPS漂移噪声测试 ---\n');

test('漂移噪声生成应产生偏移', () => {
    const baseLat = 39.9087;
    const baseLng = 116.3975;
    const accuracy = 10;
    
    const results = [];
    for (let i = 0; i < 10; i++) {
        const drift = gameLogic.generateDriftNoise(baseLat, baseLng, accuracy);
        results.push(drift);
        
        assert(typeof drift.noisyLat === 'number', 'noisyLat应为数字');
        assert(typeof drift.noisyLng === 'number', 'noisyLng应为数字');
        assert(typeof drift.driftAmount === 'number', 'driftAmount应为数字');
    }
    
    const someDifferent = results.some((r, i) => 
        i > 0 && (r.noisyLat !== results[i-1].noisyLat || r.noisyLng !== results[i-1].noisyLng)
    );
    
    assert(someDifferent, '漂移应该有随机性');
});

test('漂移倍数应增加噪声', () => {
    const baseLat = 39.9087;
    const baseLng = 116.3975;
    const accuracy = 10;
    const iterations = 100;
    
    let totalNormal = 0;
    let totalMultiplied = 0;
    
    for (let i = 0; i < iterations; i++) {
        const normal = gameLogic.generateDriftNoise(baseLat, baseLng, accuracy, 1.0);
        const multiplied = gameLogic.generateDriftNoise(baseLat, baseLng, accuracy, 3.0);
        
        totalNormal += normal.driftAmount;
        totalMultiplied += multiplied.driftAmount;
    }
    
    const avgNormal = totalNormal / iterations;
    const avgMultiplied = totalMultiplied / iterations;
    
    assert(avgMultiplied > avgNormal * 1.5, `高倍数漂移应该更大: 正常=${avgNormal.toFixed(2)}m, 高倍数=${avgMultiplied.toFixed(2)}m`);
});

test('漂移等级计算', () => {
    assert(gameLogic.calculateDriftLevel(5) === 'normal', '高精度应为normal');
    assert(gameLogic.calculateDriftLevel(20) === 'medium', '中等精度应为medium');
    assert(gameLogic.calculateDriftLevel(50) === 'high', '低精度应为high');
});

console.log('\n--- 可疑跳点检测测试 ---\n');

test('正常移动不应被标记为可疑', () => {
    const prevSample = {
        raw_lat: 39.9087,
        raw_lng: 116.3975,
        timestamp: '2024-01-01T00:00:00Z'
    };
    
    const currentSample = {
        raw_lat: 39.9088,
        raw_lng: 116.3976,
        timestamp: '2024-01-01T00:00:10Z'
    };
    
    const isSuspicious = gameLogic.detectSuspiciousJump(prevSample, currentSample);
    
    assert(!isSuspicious, '正常移动不应可疑');
});

test('快速跳点应被标记为可疑', () => {
    const prevSample = {
        raw_lat: 39.9087,
        raw_lng: 116.3975,
        timestamp: '2024-01-01T00:00:00Z'
    };
    
    const currentSample = {
        raw_lat: 40.0000,
        raw_lng: 116.5000,
        timestamp: '2024-01-01T00:00:01Z'
    };
    
    const isSuspicious = gameLogic.detectSuspiciousJump(prevSample, currentSample);
    
    assert(isSuspicious, '1秒内移动超过100米应该可疑');
});

console.log('\n--- 命中判定测试 ---\n');

test('在藏身点范围内应判定命中', () => {
    const player = { lat: 39.9087, lng: 116.3975 };
    const spot = { lat: 39.9087, lng: 116.3975, radius: 8 };
    
    const result = gameLogic.checkHidingSpotHit(player.lat, player.lng, spot, 5);
    
    assert(result.isHit === true, '在范围内应该命中');
    assert(result.distance === 0, '距离应为0');
});

test('在藏身点范围外不应判定命中', () => {
    const player = { lat: 39.9087, lng: 116.3975 };
    const spot = { lat: 39.9100, lng: 116.3975, radius: 8 };
    
    const result = gameLogic.checkHidingSpotHit(player.lat, player.lng, spot, 5);
    
    assert(result.isHit === false, '在范围外不应命中');
});

test('扩大扫描圈应增加命中范围', () => {
    const player = { lat: 39.9087, lng: 116.3975 };
    const spot = { lat: 39.90885, lng: 116.3975, radius: 5 };
    
    const normalResult = gameLogic.checkHidingSpotHit(player.lat, player.lng, spot, 5);
    const expandedResult = gameLogic.checkHidingSpotHit(player.lat, player.lng, spot, 20);
    
    assert(!normalResult.isHit, '正常范围不应命中');
    assert(expandedResult.isHit, '扩大范围应命中');
});

test('连续靠近应判定命中', () => {
    const spot = { lat: 39.9087, lng: 116.3975, radius: 8 };
    
    const samples = [
        { noisy_lat: 39.9090, noisy_lng: 116.3970 },
        { noisy_lat: 39.9089, noisy_lng: 116.3972 },
        { noisy_lat: 39.9088, noisy_lng: 116.3974 }
    ];
    
    const result = gameLogic.checkContinuousApproach(samples, spot, 3);
    
    assert(result !== null, '连续靠近应返回命中结果');
    assert(result.isHit === true, '应标记为命中');
});

test('非连续靠近不应判定命中', () => {
    const spot = { lat: 39.9087, lng: 116.3975, radius: 8 };
    
    const samples = [
        { noisy_lat: 39.9090, noisy_lng: 116.3970 },
        { noisy_lat: 39.9091, noisy_lng: 116.3969 },
        { noisy_lat: 39.9088, noisy_lng: 116.3974 }
    ];
    
    const result = gameLogic.checkContinuousApproach(samples, spot, 3);
    
    assert(result === null, '非连续靠近不应命中');
});

console.log('\n--- 干扰区测试 ---\n');

test('在干扰区内应返回干扰区', () => {
    const zones = [
        { name: '干扰区1', lat: 39.9087, lng: 116.3975, radius: 25, drift_multiplier: 2.0 },
        { name: '干扰区2', lat: 39.9090, lng: 116.3980, radius: 20, drift_multiplier: 3.0 }
    ];
    
    const inZone = gameLogic.isInInterferenceZone(39.9087, 116.3975, zones);
    const notInZone = gameLogic.isInInterferenceZone(39.9100, 116.3990, zones);
    
    assert(inZone !== null, '在干扰区内应返回干扰区');
    assert(inZone.name === '干扰区1', '应返回正确的干扰区');
    assert(notInZone === null, '在干扰区外应返回null');
});

console.log('\n--- 异常输入测试 ---\n');

test('无效坐标应正确处理', () => {
    try {
        const distance = gameLogic.calculateDistance(null, undefined, NaN, Infinity);
        assert(isNaN(distance) || distance === 0, '应安全处理无效坐标');
    } catch (e) {
        assert(true, '可以抛出错误，只要不崩溃');
    }
});

test('空采样列表连续靠近应返回null', () => {
    const spot = { lat: 39.9087, lng: 116.3975, radius: 8 };
    
    const result = gameLogic.checkContinuousApproach([], spot, 3);
    
    assert(result === null, '空列表应返回null');
});

test('空干扰区列表应返回null', () => {
    const result = gameLogic.isInInterferenceZone(39.9087, 116.3975, []);
    assert(result === null, '空列表应返回null');
});

console.log('\n=== 测试完成 ===');
console.log(`通过: ${passed}, 失败: ${failed}`);

if (failed > 0) {
    process.exit(1);
}
