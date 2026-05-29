const FormData = require('form-data');
const fs = require('fs-extra');
const path = require('path');
const TestHelper = require('./test-helper');
const http = require('http');

const API_BASE = 'http://localhost:3000/api';

async function httpRequest(options, data = null, formData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          };
          resolve(response);
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);

    if (formData) {
      formData.pipe(req);
    } else if (data) {
      req.write(JSON.stringify(data));
      req.end();
    } else {
      req.end();
    }
  });
}

async function uploadLut(filePath, metadata) {
  const form = new FormData();
  form.append('lutFile', fs.createReadStream(filePath));
  Object.keys(metadata).forEach(key => {
    if (key === 'tags') {
      form.append(key, JSON.stringify(metadata[key]));
    } else {
      form.append(key, metadata[key]);
    }
  });

  const options = {
    method: 'POST',
    path: '/api/luts/upload',
    host: 'localhost',
    port: 3000,
    headers: form.getHeaders()
  };

  return httpRequest(options, null, form);
}

async function overwriteLut(filePath, metadata) {
  const form = new FormData();
  form.append('lutFile', fs.createReadStream(filePath));
  Object.keys(metadata).forEach(key => {
    form.append(key, metadata[key]);
  });

  const options = {
    method: 'POST',
    path: '/api/luts/overwrite',
    host: 'localhost',
    port: 3000,
    headers: form.getHeaders()
  };

  return httpRequest(options, null, form);
}

async function supplementLut(filePath, metadata) {
  const form = new FormData();
  form.append('lutFile', fs.createReadStream(filePath));
  Object.keys(metadata).forEach(key => {
    form.append(key, metadata[key]);
  });

  const options = {
    method: 'POST',
    path: '/api/luts/supplement',
    host: 'localhost',
    port: 3000,
    headers: form.getHeaders()
  };

  return httpRequest(options, null, form);
}

async function postJson(path, data) {
  const options = {
    method: 'POST',
    path,
    host: 'localhost',
    port: 3000,
    headers: { 'Content-Type': 'application/json' }
  };
  return httpRequest(options, data);
}

async function getJson(path) {
  const options = {
    method: 'GET',
    path,
    host: 'localhost',
    port: 3000
  };
  return httpRequest(options);
}

async function runTests() {
  const helper = new TestHelper();
  await helper.init();

  console.log('\n' + '='.repeat(60));
  console.log('  电影调色LUT台账 - 综合测试');
  console.log('='.repeat(60));

  let project1Id, project2Id, scene1Id, scene2Id, lut1Uuid;

  try {
    console.log('\n【第一阶段: 基础功能测试 - 成功路径】');

    console.log('\n1. 项目与场景创建');
    let res = await postJson('/api/projects', { name: '《深海迷航》', description: '科幻电影调色项目' });
    helper.logResult('创建项目1', res.statusCode === 201, res.body?.name || res.body?.error);
    project1Id = res.body?.id;

    res = await postJson('/api/projects', { name: '《城市之光》', description: '都市夜景调色项目' });
    helper.logResult('创建项目2', res.statusCode === 201);
    project2Id = res.body?.id;

    res = await postJson(`/api/projects/${project1Id}/scenes`, { name: '深渊探索', sceneCode: 'S01', description: '深海场景主色调' });
    helper.logResult('创建场景1', res.statusCode === 201);
    scene1Id = res.body?.id;

    res = await postJson(`/api/projects/${project1Id}/scenes`, { name: '水面日出', sceneCode: 'S02', description: '日出场景' });
    helper.logResult('创建场景2', res.statusCode === 201);
    scene2Id = res.body?.id;

    console.log('\n2. LUT上传与校验');
    const lutFile1 = helper.createTestCubeFile('daylight_basic.cube', 'daylight_v1');
    res = await uploadLut(lutFile1, {
      projectId: project1Id,
      sceneId: scene1Id,
      name: '日光基础',
      version: 'v1.0',
      colorist: '张调色师',
      notes: '基础日光色调，偏暖',
      tags: ['日光', '基础', '暖色调']
    });
    helper.logResult('上传LUT v1.0', res.statusCode === 201, res.body?.file_hash ? `哈希: ${res.body.file_hash.substring(0, 16)}...` : res.body?.error);
    lut1Uuid = res.body?.uuid;

    res = await getJson(`/api/luts/${lut1Uuid}`);
    helper.logResult('查询LUT详情', res.statusCode === 200 && res.body?.uuid === lut1Uuid);
    helper.logResult('验证文件哈希存在', !!res.body?.file_hash);
    helper.logResult('验证版本历史记录', Array.isArray(res.body?.versionHistory));
    helper.logResult('验证操作日志记录', Array.isArray(res.body?.operationLogs));

    console.log('\n3. 版本覆盖测试');
    const lutFile1v2 = helper.createTestCubeFile('daylight_v2.cube', 'daylight_v2_modified');
    res = await overwriteLut(lutFile1v2, {
      projectId: project1Id,
      sceneId: scene1Id,
      name: '日光基础',
      version: 'v1.0',
      colorist: '李调色师',
      notes: '调整对比度',
      reason: '导演要求降低对比度'
    });
    helper.logResult('覆盖版本v1.0', res.statusCode === 200, res.body?.file_hash ? `新哈希: ${res.body.file_hash.substring(0, 16)}...` : res.body?.error);

    res = await getJson(`/api/luts/${lut1Uuid}`);
    const hasOverwriteHistory = res.body?.versionHistory?.some(h => h.action === 'overwrite');
    helper.logResult('验证版本覆盖历史', hasOverwriteHistory);
    helper.logResult('验证归档文件生成', res.body?.archives?.length > 0);

    console.log('\n4. 新版本上传（v1.1）');
    const lutFile1v1_1 = helper.createTestCubeFile('daylight_v1.1.cube', 'daylight_v1.1_new');
    res = await uploadLut(lutFile1v1_1, {
      projectId: project1Id,
      sceneId: scene1Id,
      name: '日光基础',
      version: 'v1.1',
      colorist: '张调色师',
      notes: '微调色温',
      tags: ['日光', '微调']
    });
    helper.logResult('上传新版本v1.1', res.statusCode === 201);

    console.log('\n5. 补录功能测试');
    const oldLutFile = helper.createTestCubeFile('legacy_2023.cube', 'legacy_2023_archive');
    res = await supplementLut(oldLutFile, {
      projectId: project1Id,
      sceneId: scene2Id,
      name: '2023年存档版本',
      version: 'v0.9-beta',
      colorist: '王师傅',
      notes: '历史存档，仅供参考',
      reason: '整理历史档案时发现'
    });
    helper.logResult('补录历史LUT', res.statusCode === 201);
    helper.logResult('补录LUT状态为归档', res.body?.status === 'archived');

    console.log('\n6. 撤回功能测试');
    const lutToWithdrawUuid = res.body?.uuid;
    res = await postJson(`/api/luts/${lutToWithdrawUuid}/withdraw`, {
      reason: '发现历史LUT存在色彩偏移问题',
      operator: '审核员'
    });
    helper.logResult('撤回LUT', res.statusCode === 200);

    res = await getJson(`/api/luts/${lutToWithdrawUuid}`);
    helper.logResult('验证撤回后状态', res.body?.status === 'withdrawn');

    console.log('\n【第二阶段: 冲突检测 - 失败路径】');

    console.log('\n7. 同名文件不同内容冲突');
    const conflictFile = helper.createTestCubeFile('conflict.cube', 'conflict_content_different');
    res = await uploadLut(conflictFile, {
      projectId: project1Id,
      sceneId: scene1Id,
      name: '日光基础',
      version: 'v1.0',
      colorist: '测试',
      notes: '故意同名'
    });
    helper.logResult('阻止同名不同内容', res.statusCode === 400 && res.body?.error?.includes('已存在同名'));

    console.log('\n8. 版本号格式错误');
    const badVersionFile = helper.createTestCubeFile('bad_version.cube', 'bad_version_test');
    res = await uploadLut(badVersionFile, {
      projectId: project1Id,
      sceneId: scene1Id,
      name: '版本测试',
      version: '1.0',
      colorist: '测试'
    });
    helper.logResult('拒绝错误版本号格式', res.statusCode === 400 && res.body?.error?.includes('版本号格式错误'));

    console.log('\n9. 不支持的文件格式');
    const invalidFile = helper.createInvalidFile('test.txt');
    res = await uploadLut(invalidFile, {
      projectId: project1Id,
      sceneId: scene1Id,
      name: '格式测试',
      version: 'v1.0',
      colorist: '测试'
    });
    helper.logResult('拒绝不支持的文件格式', res.statusCode === 400);

    console.log('\n10. 项目不存在');
    const badProjectFile = helper.createTestCubeFile('bad_project.cube', 'bad_project_test');
    res = await uploadLut(badProjectFile, {
      projectId: 99999,
      sceneId: scene1Id,
      name: '不存在项目',
      version: 'v1.0',
      colorist: '测试'
    });
    helper.logResult('拒绝不存在的项目', res.statusCode === 400 && res.body?.error?.includes('项目不存在'));

    console.log('\n11. 场景错配（跨项目场景）');
    const crossSceneFile = helper.createTestCubeFile('cross_scene.cube', 'cross_scene_test');
    res = await uploadLut(crossSceneFile, {
      projectId: project2Id,
      sceneId: scene1Id,
      name: '跨场景测试',
      version: 'v1.0',
      colorist: '测试'
    });
    helper.logResult('阻止跨项目场景错配', res.statusCode === 400 && res.body?.error?.includes('不属于当前项目'));

    console.log('\n12. 重复文件哈希检测');
    const duplicateFile = helper.createTestCubeFile('duplicate.cube', 'daylight_v2_modified');
    res = await uploadLut(duplicateFile, {
      projectId: project2Id,
      name: '重复文件测试',
      version: 'v1.0',
      colorist: '测试'
    });
    helper.logResult('上传重复文件（允许但记录冲突）', res.statusCode === 201);

    const duplicateUuid = res.body?.uuid;
    res = await getJson('/api/luts/conflicts/list');
    helper.logResult('冲突记录被正确记录', Array.isArray(res.body) && res.body.some(c => c.lut_uuid === duplicateUuid));

    console.log('\n13. 版本回退警告');
    const oldVersionFile = helper.createTestCubeFile('old_version.cube', 'old_version_test');
    res = await uploadLut(oldVersionFile, {
      projectId: project1Id,
      sceneId: scene1Id,
      name: '日光基础',
      version: 'v0.5',
      colorist: '测试'
    });
    helper.logResult('低版本上传记录冲突状态', res.statusCode === 201 && res.body?.status === 'conflict');

    console.log('\n14. 相同文件覆盖被拒绝');
    const sameContentFile = helper.createTestCubeFile('same.cube', 'daylight_v2_modified');
    res = await overwriteLut(sameContentFile, {
      projectId: project1Id,
      sceneId: scene1Id,
      name: '日光基础',
      version: 'v1.0',
      reason: '测试相同内容'
    });
    helper.logResult('拒绝相同文件覆盖', res.statusCode === 400 && res.body?.error?.includes('内容相同'));

    console.log('\n15. 补录必须有原因');
    const noReasonFile = helper.createTestCubeFile('no_reason.cube', 'no_reason_test');
    res = await supplementLut(noReasonFile, {
      projectId: project1Id,
      name: '无原因补录',
      version: 'v1.0'
    });
    helper.logResult('补录无原因被拒绝', res.statusCode === 400 && res.body?.error?.includes('补录原因'));

    console.log('\n16. 重复撤回被拒绝');
    res = await postJson(`/api/luts/${lutToWithdrawUuid}/withdraw`, { reason: '再次撤回' });
    helper.logResult('拒绝重复撤回', res.statusCode === 400 && res.body?.error?.includes('已被撤回'));

    console.log('\n【第三阶段: 数据完整性验证】');

    console.log('\n17. 查询与过滤');
    res = await getJson(`/api/luts?projectId=${project1Id}`);
    helper.logResult('按项目查询LUT列表', res.statusCode === 200 && Array.isArray(res.body));
    helper.logResult('项目1至少有4个LUT记录', res.body?.length >= 4);

    res = await getJson(`/api/luts?status=withdrawn`);
    helper.logResult('按状态过滤查询', res.statusCode === 200 && res.body?.some(l => l.uuid === lutToWithdrawUuid));

    console.log('\n18. 项目统计');
    res = await getJson(`/api/projects/${project1Id}`);
    helper.logResult('项目统计信息完整', res.body?.stats?.total >= 4 && res.body?.stats?.scenes?.length === 2);

    console.log('\n19. 导出功能');
    res = await getJson(`/api/projects/${project1Id}/export`);
    helper.logResult('CSV导出功能正常', res.statusCode === 200 && res.headers['content-type']?.includes('csv'));

    res = await getJson(`/api/luts/${lut1Uuid}/export`);
    helper.logResult('完整报告导出正常', res.statusCode === 200);

    console.log('\n20. 端到端追溯验证');
    res = await getJson(`/api/luts/${lut1Uuid}`);
    const lut = res.body;
    const traceChecks = [
      !!lut?.file_hash,
      !!lut?.versionHistory?.length,
      !!lut?.operationLogs?.length,
      !!lut?.archives?.length,
      lut?.tags?.length > 0
    ];
    helper.logResult('LUT可追溯性完整', traceChecks.every(c => c),
      `哈希:${!!lut?.file_hash} 历史:${lut?.versionHistory?.length} 日志:${lut?.operationLogs?.length} 归档:${lut?.archives?.length} 标签:${lut?.tags?.length}`);

    console.log('\n【第四阶段: 边界场景】');

    console.log('\n21. 无场景LUT上传');
    const noSceneFile = helper.createTestCubeFile('no_scene.cube', 'no_scene_test');
    res = await uploadLut(noSceneFile, {
      projectId: project1Id,
      name: '通用调色板',
      version: 'v1.0',
      colorist: '测试'
    });
    helper.logResult('允许无场景的通用LUT', res.statusCode === 201);

    console.log('\n22. 同项目同名场景拒绝');
    res = await postJson(`/api/projects/${project1Id}/scenes`, { name: '深渊探索' });
    helper.logResult('拒绝同项目同名场景', res.statusCode === 400);

    console.log('\n23. 同名项目拒绝');
    res = await postJson('/api/projects', { name: '《深海迷航》' });
    helper.logResult('拒绝同名项目', res.statusCode === 400);

  } catch (error) {
    console.error('\n测试执行出错:', error);
  } finally {
    helper.printSummary();
    await helper.cleanup();
    console.log('\n测试完成！');
    process.exit(0);
  }
}

setTimeout(async () => {
  await runTests();
}, 2000);
