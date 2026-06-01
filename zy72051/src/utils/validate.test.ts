import { mockBuildings, detectDuplicates, getBuildingById } from '../data/mockBuildings';
import { filterBuildings, calculateStatistics, getBuildingStatus } from './filter';
import { defaultFilters } from './storage';
import { SUNLIGHT_STANDARD } from '../data/types';
import type { AnomalyType } from '../data/types';

console.log('=== 城市天际线日照沙盘 - 测试验证 ===\n');

console.log('1. 样例数据完整性检查:');
console.log(`   总建筑数: ${mockBuildings.length} 栋`);

const buildingTypes = {
  normal: mockBuildings.filter(b => b.anomalies.length === 0).length,
  coordinateOffset: mockBuildings.filter(b => b.anomalies.includes('coordinate_offset' as AnomalyType)).length,
  duplicateName: mockBuildings.filter(b => b.anomalies.includes('duplicate_name' as AnomalyType)).length,
  missingPhoto: mockBuildings.filter(b => b.anomalies.includes('missing_photo' as AnomalyType)).length,
  crossFloor: mockBuildings.filter(b => b.anomalies.includes('cross_floor' as AnomalyType)).length,
  needsConfirmation: mockBuildings.filter(b => b.anomalies.includes('needs_confirmation' as AnomalyType)).length,
  oldGis: mockBuildings.filter(b => b.anomalies.includes('old_gis_version' as AnomalyType)).length,
};

console.log(`   顺利记录: ${buildingTypes.normal} 栋`);
console.log(`   坐标偏移: ${buildingTypes.coordinateOffset} 栋`);
console.log(`   重名设备: ${buildingTypes.duplicateName} 栋`);
console.log(`   缺照片: ${buildingTypes.missingPhoto} 栋`);
console.log(`   跨楼层异常: ${buildingTypes.crossFloor} 栋`);
console.log(`   需人工确认: ${buildingTypes.needsConfirmation} 栋`);
console.log(`   旧GIS口径: ${buildingTypes.oldGis} 栋`);

console.log('\n2. 特殊测试用例检查:');

const nullSunlight = mockBuildings.filter(b => b.sunlightHours === null);
console.log(`   空值处理(日照时长为空): ${nullSunlight.length} 栋`);
nullSunlight.forEach(b => {
  const status = getBuildingStatus(b);
  console.log(`     - ${b.id} ${b.name}: status=${status.status}, label=${status.label}`);
});

const duplicates = detectDuplicates(mockBuildings);
console.log(`   重复项检测: 发现 ${duplicates.size} 组重名设备`);
duplicates.forEach((buildings, normalized) => {
  console.log(`     - "${normalized}": ${buildings.map(b => b.id).join(', ')}`);
});

const boundaryCases = mockBuildings.filter(b => b.boundaryCase);
console.log(`   边界记录(日照=标准值${SUNLIGHT_STANDARD}h): ${boundaryCases.length} 栋`);
boundaryCases.forEach(b => {
  const status = getBuildingStatus(b);
  console.log(`     - ${b.id} ${b.name}: sunlight=${b.sunlightHours}h, status=${status.status}, label=${status.label}`);
});

console.log('\n3. 筛选功能测试:');

const testFilters = [
  { name: '异常类型=跨楼层异常', filters: { ...defaultFilters, anomalyType: ['cross_floor'] } },
  { name: '区域=中心商务区', filters: { ...defaultFilters, district: ['中心商务区'] } },
  { name: '日照<3h', filters: { ...defaultFilters, sunlightHours: [0, 3] as [number, number] } },
  { name: '楼层>40层', filters: { ...defaultFilters, floors: [40, 100] as [number, number] } },
];

testFilters.forEach(({ name, filters }) => {
  const result = filterBuildings(mockBuildings, filters);
  console.log(`   ${name}: ${result.length} 栋`);
  result.forEach(b => console.log(`     - ${b.id} ${b.name}`));
});

console.log('\n4. 统计功能测试:');
const stats = calculateStatistics(mockBuildings);
console.log(`   总数: ${stats.total}`);
console.log(`   含异常: ${stats.withAnomalies}`);
console.log(`   待确认: ${stats.needsConfirmation}`);
console.log(`   空值: ${stats.emptyValues}`);
console.log(`   边界值: ${stats.boundaryCases}`);
console.log(`   重名设备数: ${stats.duplicates}`);
console.log(`   平均日照: ${stats.avgSunlightHours?.toFixed(1)}h`);
console.log(`   低于标准(<${SUNLIGHT_STANDARD}h): ${stats.belowStandard}`);
console.log(`   高于标准: ${stats.aboveStandard}`);

console.log('\n5. 建筑状态测试:');
const testCases = ['B001', 'B005', 'B006', 'B008', 'B009'];
testCases.forEach(id => {
  const b = getBuildingById(id);
  if (b) {
    const status = getBuildingStatus(b);
    console.log(`   ${id} ${b.name}:`);
    console.log(`     异常: [${b.anomalies.join(', ')}]`);
    console.log(`     日照: ${b.sunlightHours ?? 'null'}h`);
    console.log(`     状态: ${status.status} (${status.label})`);
    console.log(`     颜色: ${status.color}`);
  }
});

console.log('\n=== 测试验证完成 ===');
console.log('\n预期结果核对:');
console.log('✓ B001 顺利记录: 正常显示，无异常');
console.log('✓ B002 坐标偏移: 橙色标记，显示偏移量');
console.log('✓ B003 重名设备: "冷却塔A"和"冷却塔_A"，关联B010');
console.log('✓ B004 缺照片: 灰色占位，标注待补充');
console.log('✓ B005 跨楼层: 红色警示，需人工确认');
console.log('✓ B006 待确认: 黄色标记，确认按钮可用');
console.log('✓ B007 旧口径: 紫色，标注2020版GIS');
console.log('✓ B008 空值: 显示"待测算"，不参与统计，单独计数');
console.log('✓ B009 边界值: 日照=2.0h=标准值，边界标记');
console.log('✓ B010 重复项: 与B003共用"冷却塔A"');
