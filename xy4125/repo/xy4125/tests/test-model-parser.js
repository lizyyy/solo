import { ModelParser, ToothPosition } from '../src/core/model-parser.js';

export function runModelParserTests() {
  console.log('=== 开始模型解析模块测试 ===\n');
  
  const parser = new ModelParser();
  let passed = 0;
  let failed = 0;

  console.log('测试1: 获取牙位名称');
  try {
    const name11 = parser.getToothName(11);
    const name36 = parser.getToothName(36);
    const name48 = parser.getToothName(48);

    console.assert(name11 === '右上中切牙', `牙位11名称应为 '右上中切牙', 实际为 '${name11}'`);
    console.assert(name36 === '左下第一磨牙', `牙位36名称应为 '左下第一磨牙', 实际为 '${name36}'`);
    console.assert(name48 === '右下第三磨牙', `牙位48名称应为 '右下第三磨牙', 实际为 '${name48}'`);
    
    console.log('  ✅ 通过');
    passed++;
  } catch (e) {
    console.log(`  ❌ 失败: ${e.message}`);
    failed++;
  }

  console.log('\n测试2: 解析上颌标注JSON');
  try {
    const testAnnotation = {
      caseId: 'TEST-001',
      position: 'upper',
      unit: 'mm',
      scale: 1.0,
      notes: '测试标注',
      teeth: [
        {
          id: 1,
          fdiNumber: 11,
          present: true,
          hasAttachment: true,
          attachment: {
            type: 'rectangular',
            position: { x: 0, y: 0, z: 0 },
            size: { x: 2, y: 3, z: 1.5 },
            rotation: 0
          },
          movement: {
            translation: { x: 1, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 5 }
          },
          meshId: 'tooth_11'
        }
      ]
    };

    const parsed = parser.parseToothAnnotation(testAnnotation);

    console.assert(parsed.caseId === 'TEST-001', `caseId 应为 'TEST-001', 实际为 '${parsed.caseId}'`);
    console.assert(parsed.position === ToothPosition.MAXILLARY, `position 应为 maxillary, 实际为 '${parsed.position}'`);
    console.assert(parsed.unit === 'mm', `unit 应为 'mm', 实际为 '${parsed.unit}'`);
    console.assert(parsed.scale === 1.0, `scale 应为 1.0, 实际为 ${parsed.scale}`);
    console.assert(parsed.teeth.length === 1, `teeth.length 应为 1, 实际为 ${parsed.teeth.length}`);
    
    const tooth = parsed.teeth[0];
    console.assert(tooth.fdiNumber === 11, `fdiNumber 应为 11, 实际为 ${tooth.fdiNumber}`);
    console.assert(tooth.present === true, `present 应为 true, 实际为 ${tooth.present}`);
    console.assert(tooth.hasAttachment === true, `hasAttachment 应为 true, 实际为 ${tooth.hasAttachment}`);
    console.assert(tooth.attachment.type === 'rectangular', `attachment.type 应为 'rectangular', 实际为 '${tooth.attachment.type}'`);
    
    console.log('  ✅ 通过');
    passed++;
  } catch (e) {
    console.log(`  ❌ 失败: ${e.message}`);
    failed++;
  }

  console.log('\n测试3: 解析下颌标注JSON');
  try {
    const testAnnotation = {
      caseId: 'TEST-002',
      position: 'lower',
      unit: 'mm',
      scale: 1.0,
      notes: '下颌测试',
      teeth: [
        {
          id: 1,
          fdiNumber: 31,
          present: true,
          hasAttachment: false,
          meshId: 'tooth_31'
        }
      ]
    };

    const parsed = parser.parseToothAnnotation(testAnnotation);

    console.assert(parsed.position === ToothPosition.MANDIBULAR, `position 应为 mandibular, 实际为 '${parsed.position}'`);
    console.assert(parsed.teeth[0].fdiNumber === 31, `fdiNumber 应为 31, 实际为 ${parsed.teeth[0].fdiNumber}`);
    
    console.log('  ✅ 通过');
    passed++;
  } catch (e) {
    console.log(`  ❌ 失败: ${e.message}`);
    failed++;
  }

  console.log('\n测试4: 解析缺失的牙位');
  try {
    const testAnnotation = {
      caseId: 'TEST-003',
      position: 'upper',
      unit: 'mm',
      scale: 1.0,
      notes: '',
      teeth: [
        {
          id: 1,
          fdiNumber: 18,
          present: false,
          hasAttachment: false,
          meshId: 'tooth_18'
        }
      ]
    };

    const parsed = parser.parseToothAnnotation(testAnnotation);

    console.assert(parsed.teeth[0].present === false, `present 应为 false, 实际为 ${parsed.teeth[0].present}`);
    
    console.log('  ✅ 通过');
    passed++;
  } catch (e) {
    console.log(`  ❌ 失败: ${e.message}`);
    failed++;
  }

  console.log('\n测试5: 创建标注JSON');
  try {
    const originalAnnotation = {
      caseId: 'TEST-004',
      position: ToothPosition.MAXILLARY,
      unit: 'mm',
      scale: 1.0,
      notes: '测试创建',
      teeth: [
        {
          id: 1,
          fdiNumber: 12,
          name: '右上侧切牙',
          present: true,
          hasAttachment: true,
          attachment: {
            type: 'rectangular',
            position: { x: 1, y: 2, z: 3 },
            size: { x: 2, y: 3, z: 1.5 },
            rotation: 0
          },
          movement: {
            translation: { x: 0.5, y: 0, z: -0.5 },
            rotation: { x: 0, y: 0, z: Math.PI / 18 }
          },
          meshId: 'tooth_12'
        }
      ]
    };

    const created = parser.createToothAnnotation(originalAnnotation);

    console.assert(created.caseId === 'TEST-004', `caseId 应为 'TEST-004'`);
    console.assert(created.position === 'upper', `position 应为 'upper', 实际为 '${created.position}'`);
    console.assert(created.teeth.length === 1, `teeth.length 应为 1`);
    
    const tooth = created.teeth[0];
    console.assert(tooth.fdiNumber === 12, `fdiNumber 应为 12`);
    console.assert(tooth.attachment.position.x === 1, `attachment.position.x 应为 1`);
    console.assert(tooth.movement.rotation.z === 10, `rotation.z 应为 10度, 实际为 ${tooth.movement.rotation.z}`);
    
    console.log('  ✅ 通过');
    passed++;
  } catch (e) {
    console.log(`  ❌ 失败: ${e.message}`);
    failed++;
  }

  console.log('\n测试6: 使用 number 字段 (兼容格式)');
  try {
    const testAnnotation = {
      caseId: 'TEST-005',
      position: 'upper',
      unit: 'mm',
      scale: 1.0,
      notes: '',
      teeth: [
        {
          id: 1,
          number: 13,
          present: true,
          hasAttachment: false,
          meshId: 'tooth_13'
        }
      ]
    };

    const parsed = parser.parseToothAnnotation(testAnnotation);

    console.assert(parsed.teeth[0].fdiNumber === 13, `fdiNumber 应为 13, 实际为 ${parsed.teeth[0].fdiNumber}`);
    console.assert(parsed.teeth[0].name === '右上尖牙', `name 应为 '右上尖牙', 实际为 '${parsed.teeth[0].name}'`);
    
    console.log('  ✅ 通过');
    passed++;
  } catch (e) {
    console.log(`  ❌ 失败: ${e.message}`);
    failed++;
  }

  console.log('\n测试7: 默认值测试');
  try {
    const testAnnotation = {
      caseId: 'TEST-006',
      position: 'upper',
      teeth: [
        {
          id: 1,
          fdiNumber: 14
        }
      ]
    };

    const parsed = parser.parseToothAnnotation(testAnnotation);

    console.assert(parsed.unit === 'mm', `默认 unit 应为 'mm', 实际为 '${parsed.unit}'`);
    console.assert(parsed.scale === 1.0, `默认 scale 应为 1.0, 实际为 ${parsed.scale}`);
    console.assert(parsed.notes === '', `默认 notes 应为 '', 实际为 '${parsed.notes}'`);
    console.assert(parsed.teeth[0].present === true, `默认 present 应为 true, 实际为 ${parsed.teeth[0].present}`);
    console.assert(parsed.teeth[0].hasAttachment === false, `默认 hasAttachment 应为 false, 实际为 ${parsed.teeth[0].hasAttachment}`);
    
    console.log('  ✅ 通过');
    passed++;
  } catch (e) {
    console.log(`  ❌ 失败: ${e.message}`);
    failed++;
  }

  console.log('\n=== 模型解析模块测试结果 ===');
  console.log(`通过: ${passed}`);
  console.log(`失败: ${failed}`);
  console.log(`总计: ${passed + failed}`);

  return { passed, failed, total: passed + failed };
}
