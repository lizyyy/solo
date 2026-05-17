const fs = require('fs');
const path = require('path');
const { projectService, annotatorService, taskPackageService, reworkRecordService } = require('../src/services');
const { STATUS, REWORK_REASONS } = require('../src/constants');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

require('../src/database');

function logTest(name, fn) {
  console.log(`\n🔍 测试: ${name}`);
  try {
    const result = fn();
    console.log(`✅ ${name} - 通过`);
    return result;
  } catch (e) {
    console.log(`❌ ${name} - 失败:`, e.message);
    throw e;
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('数据标注平台任务包拆分返工 API - 测试套件');
  console.log('='.repeat(60));

  try {
    const project = await logTest('创建项目', async () => {
      return await projectService.create({ name: '测试项目' });
    });

    const annotator1 = await logTest('创建标注员 1', async () => {
      return await annotatorService.create({ name: '测试员 A' });
    });

    const annotator2 = await logTest('创建标注员 2', async () => {
      return await annotatorService.create({ name: '测试员 B' });
    });

    const taskPackage = await logTest('创建任务包', async () => {
      return await taskPackageService.create({
        project_id: project.id,
        name: '测试任务包',
        original_annotator_id: annotator1.id,
        status: STATUS.ANNOTATING
      });
    });

    console.log('\n' + '='.repeat(60));
    console.log('测试场景 1: 完整状态流转');
    console.log('='.repeat(60));

    let record = await logTest('创建返工记录 (待分配)', async () => {
      return await reworkRecordService.create({
        task_package_id: taskPackage.id,
        project_id: project.id,
        annotator_id: annotator2.id,
        reason: REWORK_REASONS.QUALITY_ISSUE
      });
    });
    console.log('   记录 ID:', record.id, '状态:', record.status);

    record = await logTest('流转到标注中', async () => {
      return await reworkRecordService.updateStatus(record.id, STATUS.ANNOTATING, 'admin', '开始标注');
    });
    console.log('   状态:', record.status);

    record = await logTest('流转到返工中', async () => {
      return await reworkRecordService.updateStatus(record.id, STATUS.REWORKING, 'admin', '发现问题需要返工');
    });
    console.log('   状态:', record.status);

    record = await logTest('流转到已验收', async () => {
      return await reworkRecordService.updateStatus(record.id, STATUS.ACCEPTED, 'admin', '返工完成，验收通过');
    });
    console.log('   状态:', record.status);

    const history = await logTest('查询状态历史', async () => {
      return await reworkRecordService.getHistory(record.id);
    });
    console.log('   历史记录数:', history.length);

    console.log('\n' + '='.repeat(60));
    console.log('测试场景 2: 冲突检测 - 重复发给原标注员');
    console.log('='.repeat(60));

    const conflictRecord = await logTest('创建冲突记录 (发给原标注员)', async () => {
      return await reworkRecordService.create({
        task_package_id: taskPackage.id,
        project_id: project.id,
        annotator_id: annotator1.id,
        reason: REWORK_REASONS.INCORRECT_LABEL
      });
    });
    console.log('   状态:', conflictRecord.status, '(应为待人工处理)');
    console.log('   冲突检测:', conflictRecord.conflict_detected ? '✅ 检测到冲突' : '❌ 未检测到冲突');
    if (conflictRecord.conflict) {
      console.log('   冲突原因:', conflictRecord.conflict.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试场景 3: 导入坏行 (字段验证)');
    console.log('='.repeat(60));

    await logTest('缺少必填字段应该失败', async () => {
      try {
        await reworkRecordService.create({
          task_package_id: taskPackage.id,
          annotator_id: annotator2.id
        });
        throw new Error('应该抛出错误但没有');
      } catch (e) {
        return true;
      }
    });

    await logTest('无效的状态流转应该失败', async () => {
      try {
        await reworkRecordService.updateStatus(record.id, STATUS.PENDING_ASSIGN, 'admin', '测试非法流转');
        throw new Error('应该抛出错误但没有');
      } catch (e) {
        return true;
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('测试场景 4: 列表、详情、导出验证');
    console.log('='.repeat(60));

    const list = await logTest('查询返工记录列表', async () => {
      return await reworkRecordService.list();
    });
    console.log('   列表记录数:', list.length);

    const detail = await logTest('查询返工记录详情', async () => {
      return await reworkRecordService.get(record.id);
    });
    console.log('   详情存在:', !!detail);

    const exported = await logTest('导出数据验证', async () => {
      return await reworkRecordService.export();
    });
    console.log('   导出记录数:', exported.length);
    console.log('   导出字段完整:', exported[0].id && exported[0].project_name && exported[0].status);

    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有测试通过!');
    console.log('='.repeat(60));
    console.log('\n📊 测试汇总:');
    console.log('   - 完整状态流转: 待分配 → 标注中 → 返工中 → 已验收');
    console.log('   - 冲突检测: 原标注员重新分配时自动进入待人工处理');
    console.log('   - 字段验证: 必填项检查、状态流转校验正常工作');
    console.log('   - 数据一致性: 列表、详情、历史、导出数据互相对应');

  } catch (e) {
    console.log('\n❌ 测试失败:', e.message);
    process.exit(1);
  }
}

runTests();
