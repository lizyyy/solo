import * as THREE from 'three';
import { GeometryCalculator } from '../src/core/geometry-calculator.js';

export function runGeometryCalculatorTests() {
  console.log('=== 开始几何计算模块测试 ===\n');
  
  const calculator = new GeometryCalculator();
  let passed = 0;
  let failed = 0;

  console.log('测试1: 计算包围盒');
  try {
    const vertices = new Float32Array([
      -1, -1, -1,
       1, -1, -1,
       1,  1, -1,
      -1,  1, -1,
      -1, -1,  1,
       1, -1,  1,
       1,  1,  1,
      -1,  1,  1
    ]);

    const box = calculator.computeBoundingBox(vertices);
    
    console.assert(box.min.x === -1, `min.x 应为 -1, 实际为 ${box.min.x}`);
    console.assert(box.min.y === -1, `min.y 应为 -1, 实际为 ${box.min.y}`);
    console.assert(box.min.z === -1, `min.z 应为 -1, 实际为 ${box.min.z}`);
    console.assert(box.max.x === 1, `max.x 应为 1, 实际为 ${box.max.x}`);
    console.assert(box.max.y === 1, `max.y 应为 1, 实际为 ${box.max.y}`);
    console.assert(box.max.z === 1, `max.z 应为 1, 实际为 ${box.max.z}`);
    
    console.log('  ✅ 通过');
    passed++;
  } catch (e) {
    console.log(`  ❌ 失败: ${e.message}`);
    failed++;
  }

  console.log('\n测试2: 包围盒相交检测');
  try {
    const box1 = new THREE.Box3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(2, 2, 2)
    );
    const box2 = new THREE.Box3(
      new THREE.Vector3(1, 1, 1),
      new THREE.Vector3(3, 3, 3)
    );
    const box3 = new THREE.Box3(
      new THREE.Vector3(5, 5, 5),
      new THREE.Vector3(6, 6, 6)
    );

    console.assert(calculator.boxIntersects(box1, box2) === true, 'box1 和 box2 应该相交');
    console.assert(calculator.boxIntersects(box1, box3) === false, 'box1 和 box3 不应该相交');
    
    console.log('  ✅ 通过');
    passed++;
  } catch (e) {
    console.log(`  ❌ 失败: ${e.message}`);
    failed++;
  }

  console.log('\n测试3: 计算包围盒最小间隙');
  try {
    const box1 = new THREE.Box3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 1, 1)
    );
    const box2 = new THREE.Box3(
      new THREE.Vector3(2, 0, 0),
      new THREE.Vector3(3, 1, 1)
    );
    const box3 = new THREE.Box3(
      new THREE.Vector3(0.5, 0.5, 0.5),
      new THREE.Vector3(1.5, 1.5, 1.5)
    );

    const gap1 = calculator.computeBoxMinimumGap(box1, box2);
    const gap2 = calculator.computeBoxMinimumGap(box1, box3);

    console.assert(Math.abs(gap1 - 1.0) < 0.001, `间隙应为 1.0, 实际为 ${gap1}`);
    console.assert(gap2 === 0, `相交的包围盒间隙应为 0, 实际为 ${gap2}`);
    
    console.log('  ✅ 通过');
    passed++;
  } catch (e) {
    console.log(`  ❌ 失败: ${e.message}`);
    failed++;
  }

  console.log('\n测试4: 计算包围盒尺寸');
  try {
    const box = new THREE.Box3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(2, 3, 4)
    );

    const size = calculator.computeBoundingBoxSize(box);

    console.assert(size.width === 2, `宽度应为 2, 实际为 ${size.width}`);
    console.assert(size.height === 3, `高度应为 3, 实际为 ${size.height}`);
    console.assert(size.depth === 4, `深度应为 4, 实际为 ${size.depth}`);
    console.assert(size.volume === 24, `体积应为 24, 实际为 ${size.volume}`);
    
    console.log('  ✅ 通过');
    passed++;
  } catch (e) {
    console.log(`  ❌ 失败: ${e.message}`);
    failed++;
  }

  console.log('\n测试5: 计算包围盒中心');
  try {
    const box = new THREE.Box3(
      new THREE.Vector3(-2, -4, -6),
      new THREE.Vector3(2, 4, 6)
    );

    const center = calculator.computeBoxCenter(box);

    console.assert(center.x === 0, `中心 x 应为 0, 实际为 ${center.x}`);
    console.assert(center.y === 0, `中心 y 应为 0, 实际为 ${center.y}`);
    console.assert(center.z === 0, `中心 z 应为 0, 实际为 ${center.z}`);
    
    console.log('  ✅ 通过');
    passed++;
  } catch (e) {
    console.log(`  ❌ 失败: ${e.message}`);
    failed++;
  }

  console.log('\n测试6: 创建附件包围盒');
  try {
    const position = new THREE.Vector3(10, 20, 30);
    const size = new THREE.Vector3(2, 4, 6);

    const box = calculator.createAttachmentBoundingBox(position, size);

    console.assert(box.min.x === 9, `min.x 应为 9, 实际为 ${box.min.x}`);
    console.assert(box.min.y === 18, `min.y 应为 18, 实际为 ${box.min.y}`);
    console.assert(box.min.z === 27, `min.z 应为 27, 实际为 ${box.min.z}`);
    console.assert(box.max.x === 11, `max.x 应为 11, 实际为 ${box.max.x}`);
    console.assert(box.max.y === 22, `max.y 应为 22, 实际为 ${box.max.y}`);
    console.assert(box.max.z === 33, `max.z 应为 33, 实际为 ${box.max.z}`);
    
    console.log('  ✅ 通过');
    passed++;
  } catch (e) {
    console.log(`  ❌ 失败: ${e.message}`);
    failed++;
  }

  console.log('\n测试7: 计算最小距离');
  try {
    const verticesA = new Float32Array([0, 0, 0]);
    const verticesB = new Float32Array([3, 4, 0]);

    const distance = calculator.computeMinimumDistance(verticesA, verticesB);

    console.assert(Math.abs(distance - 5.0) < 0.001, `距离应为 5.0, 实际为 ${distance}`);
    
    console.log('  ✅ 通过');
    passed++;
  } catch (e) {
    console.log(`  ❌ 失败: ${e.message}`);
    failed++;
  }

  console.log('\n测试8: 计算最近点');
  try {
    const verticesA = new Float32Array([0, 0, 0]);
    const verticesB = new Float32Array([3, 4, 0]);

    const result = calculator.computeClosestPoints(verticesA, verticesB);

    console.assert(Math.abs(result.distance - 5.0) < 0.001, `距离应为 5.0, 实际为 ${result.distance}`);
    console.assert(result.pointA.x === 0, `pointA.x 应为 0, 实际为 ${result.pointA.x}`);
    console.assert(result.pointB.x === 3, `pointB.x 应为 3, 实际为 ${result.pointB.x}`);
    
    console.log('  ✅ 通过');
    passed++;
  } catch (e) {
    console.log(`  ❌ 失败: ${e.message}`);
    failed++;
  }

  console.log('\n=== 几何计算模块测试结果 ===');
  console.log(`通过: ${passed}`);
  console.log(`失败: ${failed}`);
  console.log(`总计: ${passed + failed}`);

  return { passed, failed, total: passed + failed };
}
