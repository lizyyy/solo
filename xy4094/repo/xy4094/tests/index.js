import { DataParser } from '../src/modules/parser.js';
import { GeoCalculator } from '../src/modules/geo.js';
import { RiskEngine, RiskLevel, RiskType } from '../src/modules/riskEngine.js';
import { ReplayStateMachine } from '../src/modules/replay.js';

console.log('=== 风场航迹黑匣子 - 单元测试 ===\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`✅ PASS: ${message} (actual: ${actual}, expected: ${expected})`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${message} (actual: ${actual}, expected: ${expected})`);
    failed++;
  }
}

function assertClose(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) <= tolerance) {
    console.log(`✅ PASS: ${message} (actual: ${actual.toFixed(4)}, expected: ${expected.toFixed(4)}, tolerance: ${tolerance})`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${message} (actual: ${actual.toFixed(4)}, expected: ${expected.toFixed(4)}, tolerance: ${tolerance})`);
    failed++;
  }
}

console.log('--- 1. GeoCalculator 地理计算测试 ---\n');

const geo = new GeoCalculator();

const pointA = { latitude: 30.0, longitude: 120.0 };
const pointB = { latitude: 30.01, longitude: 120.01 };

const distance = geo.distanceBetween(pointA, pointB);
const expectedDistance = 1572;
assertClose(distance, expectedDistance, 10, '两点之间距离计算');

const bearing = geo.calculateBearing(30.0, 120.0, 30.01, 120.01);
assert(bearing > 0 && bearing < 90, '方位角计算应在0-90度之间');

const windAngle = geo.calculateWindAngle(0, 90);
assertClose(windAngle, 90, 0.1, '风航夹角计算 (航向0°, 风向90°)');

const windAngle2 = geo.calculateWindAngle(350, 10);
assertClose(windAngle2, 20, 0.1, '风航夹角计算 (航向350°, 风向10°)');

const formatDist = geo.formatDistance(1234);
assertEqual(formatDist, '1.23km', '距离格式化 (1234m)');

const formatTime = geo.formatTime(Date.now());
assert(formatTime.includes(':'), '时间格式化应包含冒号');

console.log('\n--- 2. DataParser 数据解析测试 ---\n');

const parser = new DataParser();

const sampleTrackData = {
  points: [
    {
      timestamp: Date.now() - 60000,
      latitude: 30.0,
      longitude: 120.0,
      altitude: 50,
      speed: 10,
      heading: 90,
      gimbalPitch: -45
    },
    {
      timestamp: Date.now() - 30000,
      latitude: 30.005,
      longitude: 120.005,
      altitude: 80,
      speed: 12,
      heading: 180,
      gimbalPitch: -60
    },
    {
      timestamp: Date.now(),
      latitude: 30.01,
      longitude: 120.01,
      altitude: 100,
      speed: 8,
      heading: 270,
      gimbalPitch: -30
    }
  ]
};

try {
  const parsedTrack = parser.parseTrackData(sampleTrackData);
  assertEqual(parsedTrack.pointCount, 3, '轨迹点数量解析');
  assert(parsedTrack.duration > 0, '轨迹持续时间应大于0');
  console.log('✅ PASS: 轨迹数据解析成功');
  passed++;
} catch (e) {
  console.log(`❌ FAIL: 轨迹数据解析失败 - ${e.message}`);
  failed++;
}

const sampleCSV = `timestamp,windSpeed,windDirection,temperature
2024-01-15T10:00:00Z,8.5,180,22.5
2024-01-15T10:05:00Z,9.2,190,22.3
2024-01-15T10:10:00Z,8.8,175,22.6`;

try {
  const parsedWeather = parser.parseWeatherData(sampleCSV);
  assertEqual(parsedWeather.recordCount, 3, '气象记录数量解析');
  assert(parsedWeather.records[0].windSpeed === 8.5, '风速解析');
  console.log('✅ PASS: 气象CSV数据解析成功');
  passed++;
} catch (e) {
  console.log(`❌ FAIL: 气象CSV数据解析失败 - ${e.message}`);
  failed++;
}

const sampleGeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [120.0, 30.0],
          [120.01, 30.0],
          [120.01, 30.01],
          [120.0, 30.01],
          [120.0, 30.0]
        ]]
      },
      properties: {
        name: '测试禁飞区',
        level: 'warning'
      }
    }
  ]
};

try {
  const parsedNoFly = parser.parseNoFlyZoneData(sampleGeoJSON);
  assertEqual(parsedNoFly.featureCount, 1, 'GeoJSON特性数量解析');
  console.log('✅ PASS: GeoJSON数据解析成功');
  passed++;
} catch (e) {
  console.log(`❌ FAIL: GeoJSON数据解析失败 - ${e.message}`);
  failed++;
}

const testPoint = { latitude: 30.005, longitude: 120.005 };
const insidePolygon = geo.pointInPolygon(testPoint, sampleGeoJSON.features[0].geometry);
assert(insidePolygon === true, '点在多边形内检测');

const outsidePoint = { latitude: 30.02, longitude: 120.02 };
const outsidePolygon = geo.pointInPolygon(outsidePoint, sampleGeoJSON.features[0].geometry);
assert(outsidePolygon === false, '点在多边形外检测');

console.log('\n--- 3. RiskEngine 风险引擎测试 ---\n');

const riskEngine = new RiskEngine();

const testData = {
  track: {
    points: [
      {
        timestamp: Date.now() - 10000,
        latitude: 30.0,
        longitude: 120.0,
        altitude: 50,
        speed: 10,
        heading: 90,
        gimbalPitch: -45
      },
      {
        timestamp: Date.now(),
        latitude: 30.005,
        longitude: 120.005,
        altitude: 80,
        speed: 16,
        heading: 180,
        gimbalPitch: -88
      }
    ],
    startTime: Date.now() - 10000,
    endTime: Date.now(),
    duration: 10000,
    pointCount: 2
  },
  weather: {
    records: [
      { timestamp: Date.now() - 10000, windSpeed: 15, windDirection: 0 },
      { timestamp: Date.now(), windSpeed: 12, windDirection: 90 }
    ],
    recordCount: 2
  },
  noFlyZones: null,
  alerts: null
};

const events = riskEngine.analyze(testData);
console.log(`分析生成 ${events.length} 个风险事件`);

const stats = riskEngine.getEventStats();
console.log(`统计: 严重=${stats.critical}, 警告=${stats.warning}, 信息=${stats.info}`);

const speedEvents = riskEngine.getEventsByType(RiskType.SPEED_EXCEED);
assert(speedEvents.length > 0, '应检测到速度超限事件');

const gimbalEvents = riskEngine.getEventsByType(RiskType.GIMBAL_ANGLE_ISSUE);
assert(gimbalEvents.length > 0, '应检测到云台角度异常事件');

const annotation = riskEngine.addManualAnnotation({
  timestamp: Date.now(),
  progress: 0.5,
  pointIndex: 1,
  position: { latitude: 30.0, longitude: 120.0, altitude: 100 },
  level: RiskLevel.WARNING,
  description: '测试人工标注'
});

assert(annotation.isManual === true, '人工标注事件标识');

const allEvents = riskEngine.getAllEvents();
assert(allEvents.length > events.length, '添加标注后事件数量应增加');

console.log('\n--- 4. ReplayStateMachine 回放状态机测试 ---\n');

const replay = new ReplayStateMachine();

const replayPoints = [
  { timestamp: 1000, latitude: 30.0, longitude: 120.0, altitude: 50, speed: 10, heading: 90, gimbalPitch: -45 },
  { timestamp: 2000, latitude: 30.001, longitude: 120.001, altitude: 60, speed: 11, heading: 100, gimbalPitch: -50 },
  { timestamp: 3000, latitude: 30.002, longitude: 120.002, altitude: 70, speed: 12, heading: 110, gimbalPitch: -55 },
  { timestamp: 4000, latitude: 30.003, longitude: 120.003, altitude: 80, speed: 13, heading: 120, gimbalPitch: -60 }
];

try {
  const initState = replay.initialize(replayPoints);
  assertEqual(initState.status, 'ready', '初始化后状态应为ready');
  assertEqual(initState.startTime, 1000, '开始时间正确');
  assertEqual(initState.endTime, 4000, '结束时间正确');
  assertEqual(initState.duration, 3000, '持续时间正确');
  console.log('✅ PASS: 回放状态机初始化成功');
  passed++;
} catch (e) {
  console.log(`❌ FAIL: 回放状态机初始化失败 - ${e.message}`);
  failed++;
}

const stateBefore = replay.getState();
assertEqual(stateBefore.currentTime, 1000, '初始当前时间');

replay.seek(2500);
const stateAfterSeek = replay.getState();
assert(stateAfterSeek.currentTime >= 2000 && stateAfterSeek.currentTime <= 3000, 'seek后时间应在正确范围内');
assertEqual(stateAfterSeek.progress, (2500 - 1000) / 3000, '进度计算正确');

const currentPoint = replay.getCurrentPoint();
assert(currentPoint !== null, '应能获取当前点');
assert(currentPoint.latitude !== undefined, '当前点应包含纬度');
assert(currentPoint.longitude !== undefined, '当前点应包含经度');

replay.seekToProgress(0.5);
const progressState = replay.getState();
assertClose(progressState.progress, 0.5, 0.01, '按进度跳转正确');

replay.setSpeed(2);
const speedState = replay.getState();
assertEqual(speedState.speed, 2, '设置播放速度正确');

console.log('\n--- 5. 插值计算测试 ---\n');

const point1 = replayPoints[0];
const point2 = replayPoints[1];

const interpolated = geo.interpolatePoint(point1, point2, 0.5);
assertClose(interpolated.latitude, (30.0 + 30.001) / 2, 0.0001, '纬度插值正确');
assertClose(interpolated.longitude, (120.0 + 120.001) / 2, 0.0001, '经度插值正确');
assertClose(interpolated.altitude, 55, 0.1, '高度插值正确');
assertClose(interpolated.speed, 10.5, 0.1, '速度插值正确');

const lerpAngleTest = geo.lerpAngle(350, 10, 0.5);
assertClose(lerpAngleTest, 0, 0.1, '角度插值 (350°到10°的中间应为0°)');

console.log('\n--- 6. 导入导出测试 ---\n');

const exported = riskEngine.export();
assert(exported.config !== undefined, '导出应包含配置');
assert(exported.riskEvents !== undefined, '导出应包含风险事件');
assert(exported.manualAnnotations !== undefined, '导出应包含人工标注');
console.log('✅ PASS: 风险引擎导出成功');
passed++;

const newRiskEngine = new RiskEngine();
newRiskEngine.import(exported);
const importedEvents = newRiskEngine.getAllEvents();
assertEqual(importedEvents.length, allEvents.length, '导入后事件数量应相同');
console.log('✅ PASS: 风险引擎导入成功');
passed++;

console.log('\n=== 测试完成 ===\n');
console.log(`✅ 通过: ${passed}`);
console.log(`❌ 失败: ${failed}`);
console.log(`📊 通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log('\n⚠️ 部分测试失败，请检查代码');
  process.exit(1);
} else {
  console.log('\n🎉 所有测试通过!');
  process.exit(0);
}
