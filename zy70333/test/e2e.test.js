const assert = require('assert');
const http = require('http');

const { initializeInMemoryStore } = require('../src/utils/inMemoryStore');

initializeInMemoryStore();

const app = require('../src/server');

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          };
          resolve(response);
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
            parseError: e.message
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function buildOptions(method, path, body = null) {
  const options = {
    hostname: 'localhost',
    port: PORT,
    path,
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  if (body) {
    options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
  }
  return options;
}

async function runTests() {
  console.log('===========================================');
  console.log('低代码表单版本 API - 端到端测试');
  console.log('===========================================\n');

  let server;
  let formId;
  let submissionIdV1;
  let submissionIdV2;

  try {
    server = app.listen(PORT);
    console.log('测试服务器启动在端口', PORT);

    console.log('\n--- 测试 1: 创建表单 ---');
    const createRes = await request(
      buildOptions('POST', '/api/forms', { name: '测试报名表', description: 'E2E测试' }),
      { name: '测试报名表', description: 'E2E测试' }
    );
    assert.strictEqual(createRes.statusCode, 201, '应该返回201');
    assert.ok(createRes.body.formId, '应该返回formId');
    formId = createRes.body.formId;
    console.log('✅ 表单创建成功，ID:', formId);

    console.log('\n--- 测试 2: 为 v1 添加字段 ---');
    const addNameRes = await request(
      buildOptions('POST', `/api/forms/${formId}/fields`, {
        name: 'name',
        type: 'text',
        label: '姓名',
        required: true
      }),
      {
        name: 'name',
        type: 'text',
        label: '姓名',
        required: true
      }
    );
    assert.strictEqual(addNameRes.statusCode, 201, '添加姓名字段应该成功');

    const addEmailRes = await request(
      buildOptions('POST', `/api/forms/${formId}/fields`, {
        name: 'email',
        type: 'email',
        label: '邮箱',
        required: true
      }),
      {
        name: 'email',
        type: 'email',
        label: '邮箱',
        required: true
      }
    );
    assert.strictEqual(addEmailRes.statusCode, 201, '添加邮箱字段应该成功');
    console.log('✅ v1 字段添加成功');

    console.log('\n--- 测试 3: 发布 v1 ---');
    const publishV1Res = await request(
      buildOptions('POST', `/api/forms/${formId}/versions/1/publish`),
      {}
    );
    assert.strictEqual(publishV1Res.statusCode, 200, '发布 v1 应该成功');
    assert.strictEqual(publishV1Res.body.version.status, 'published', '版本状态应该是 published');
    console.log('✅ v1 发布成功');

    console.log('\n--- 测试 4: 已发布版本不能直接修改 ---');
    const addFieldToPublishedRes = await request(
      buildOptions('POST', `/api/forms/${formId}/fields`, {
        name: 'forbidden_field',
        type: 'text',
        label: '禁止字段',
        required: false
      }),
      {
        name: 'forbidden_field',
        type: 'text',
        label: '禁止字段',
        required: false
      }
    );
    assert.strictEqual(addFieldToPublishedRes.statusCode, 400, '修改已发布版本应该失败');
    assert.ok(addFieldToPublishedRes.body.error.includes('Published or frozen versions cannot be directly modified'),
      '错误信息应该说明已发布版本不能修改');
    console.log('✅ 已发布版本保护生效');

    console.log('\n--- 测试 5: 使用 v1 提交数据 ---');
    const submitV1Res = await request(
      buildOptions('POST', `/api/submissions/${formId}/submit`, {
        submissionKey: 'test_user_001',
        data: {
          name: '测试用户',
          email: 'test@example.com'
        }
      }),
      {
        submissionKey: 'test_user_001',
        data: {
          name: '测试用户',
          email: 'test@example.com'
        }
      }
    );
    assert.strictEqual(submitV1Res.statusCode, 201, 'v1 提交应该成功');
    assert.ok(submitV1Res.body.submissionId, '应该返回 submissionId');
    assert.strictEqual(submitV1Res.body.version, 1, '应该使用 v1 提交');
    submissionIdV1 = submitV1Res.body.submissionId;
    console.log('✅ v1 数据提交成功，ID:', submissionIdV1);

    console.log('\n--- 测试 6: 重复提交同一 submissionKey（幂等性）---');
    const idempotentRes = await request(
      buildOptions('POST', `/api/submissions/${formId}/submit`, {
        submissionKey: 'test_user_001',
        data: {
          name: '测试用户已更新',
          email: 'updated@example.com'
        }
      }),
      {
        submissionKey: 'test_user_001',
        data: {
          name: '测试用户已更新',
          email: 'updated@example.com'
        }
      }
    );
    assert.strictEqual(idempotentRes.statusCode, 200, '幂等更新应该返回 200');
    assert.strictEqual(idempotentRes.body.isNew, false, 'isNew 应该为 false');
    assert.strictEqual(idempotentRes.body.data.name, '测试用户已更新', '数据应该被更新');
    console.log('✅ 幂等性机制工作正常');

    console.log('\n--- 测试 7: 创建 v2，新增必填字段 phone ---');
    const createV2Res = await request(
      buildOptions('POST', `/api/forms/${formId}/versions`, {
        changeLog: '新增电话号码字段'
      }),
      {
        changeLog: '新增电话号码字段'
      }
    );
    assert.strictEqual(createV2Res.statusCode, 201, '创建 v2 应该成功');
    assert.strictEqual(createV2Res.body.version.version, 2, '新版本号应该是 2');

    const addPhoneRes = await request(
      buildOptions('POST', `/api/forms/${formId}/fields`, {
        name: 'phone',
        type: 'text',
        label: '电话',
        required: true
      }),
      {
        name: 'phone',
        type: 'text',
        label: '电话',
        required: true
      }
    );
    assert.strictEqual(addPhoneRes.statusCode, 201, '添加 phone 字段应该成功');

    const publishV2Res = await request(
      buildOptions('POST', `/api/forms/${formId}/versions/2/publish`),
      {}
    );
    assert.strictEqual(publishV2Res.statusCode, 200, '发布 v2 应该成功');
    console.log('✅ v2 创建并发布成功');

    console.log('\n--- 测试 8: 新版本必填字段不影响旧提交（查询验证）---');
    const getOldSubmissionRes = await request(
      buildOptions('GET', `/api/submissions/${submissionIdV1}`)
    );
    assert.strictEqual(getOldSubmissionRes.statusCode, 200, '查询旧数据应该成功');
    assert.strictEqual(getOldSubmissionRes.body.version, 1, '旧数据版本应该保持 v1');
    assert.ok(!getOldSubmissionRes.body.data.phone, '旧数据不应该有 phone 字段');
    assert.strictEqual(getOldSubmissionRes.body.isValid, true, '旧数据应该仍然有效');
    console.log('✅ 旧数据不受新版本必填字段影响');

    console.log('\n--- 测试 9: v2 提交必须包含 phone 字段 ---');
    const submitV2NoPhoneRes = await request(
      buildOptions('POST', `/api/submissions/${formId}/submit`, {
        submissionKey: 'test_user_invalid_v2',
        data: {
          name: '新用户',
          email: 'new@example.com'
        }
      }),
      {
        submissionKey: 'test_user_invalid_v2',
        data: {
          name: '新用户',
          email: 'new@example.com'
        }
      }
    );
    assert.strictEqual(submitV2NoPhoneRes.statusCode, 400, '缺少必填字段应该失败');
    assert.ok(submitV2NoPhoneRes.body.validationErrors.some(e => e.field === 'phone'),
      '应该有 phone 字段的校验错误');

    const submitV2Res = await request(
      buildOptions('POST', `/api/submissions/${formId}/submit`, {
        submissionKey: 'test_user_002',
        data: {
          name: '新用户',
          email: 'new@example.com',
          phone: '13800138000'
        }
      }),
      {
        submissionKey: 'test_user_002',
        data: {
          name: '新用户',
          email: 'new@example.com',
          phone: '13800138000'
        }
      }
    );
    assert.strictEqual(submitV2Res.statusCode, 201, '包含必填字段应该成功');
    submissionIdV2 = submitV2Res.body.submissionId;
    console.log('✅ v2 必填字段校验生效');

    console.log('\n--- 测试 10: 按版本查询提交 ---');
    const getV1SubmissionsRes = await request(
      buildOptions('GET', `/api/submissions/form/${formId}?version=1`)
    );
    assert.strictEqual(getV1SubmissionsRes.statusCode, 200, '查询 v1 提交应该成功');
    const v1Submissions = getV1SubmissionsRes.body;
    assert.ok(v1Submissions.every(s => s.version === 1), '所有结果应该是 v1 提交');
    console.log('✅ 按版本查询工作正常');

    console.log('\n--- 测试 11: 查询提交带版本上下文（字段差异）---');
    const contextRes = await request(
      buildOptions('GET', `/api/submissions/${submissionIdV1}/context`)
    );
    assert.strictEqual(contextRes.statusCode, 200, '查询上下文应该成功');
    assert.strictEqual(contextRes.body.validationContext.submittedVersion, 1, '提交版本应该是 v1');
    assert.ok(contextRes.body.fieldDifferences.addedInLatest.some(f => f.field === 'phone'),
      '应该识别 phone 是在最新版本新增的字段');
    console.log('✅ 字段差异识别正常');

    console.log('\n--- 测试 12: 删除字段带迁移说明 ---');
    const createV3Res = await request(
      buildOptions('POST', `/api/forms/${formId}/versions`, {
        changeLog: '删除邮箱字段'
      }),
      {
        changeLog: '删除邮箱字段'
      }
    );
    assert.strictEqual(createV3Res.statusCode, 201, '创建 v3 应该成功');

    const deleteEmailRes = await request(
      buildOptions('DELETE', `/api/forms/${formId}/fields/email`, {
        migrationNote: '邮箱字段已废弃，改用联系表单系统发送通知'
      }),
      {
        migrationNote: '邮箱字段已废弃，改用联系表单系统发送通知'
      }
    );
    assert.strictEqual(deleteEmailRes.statusCode, 200, '删除字段应该成功');
    
    const deletedField = deleteEmailRes.body.version.fields.find(f => f.name === 'email');
    assert.strictEqual(deletedField.deleted, true, '字段应该被标记为已删除');
    assert.ok(deletedField.migrationNote.includes('废弃'), '应该有迁移说明');
    console.log('✅ 删除字段带迁移说明工作正常');

    console.log('\n--- 测试 13: 版本冻结 ---');
    const freezeV1Res = await request(
      buildOptions('POST', `/api/forms/${formId}/versions/1/freeze`),
      {}
    );
    assert.strictEqual(freezeV1Res.statusCode, 200, '冻结 v1 应该成功');
    assert.strictEqual(freezeV1Res.body.version.status, 'frozen', '状态应该是 frozen');

    const refreezeRes = await request(
      buildOptions('POST', `/api/forms/${formId}/versions/1/freeze`),
      {}
    );
    assert.strictEqual(refreezeRes.statusCode, 400, '重复冻结应该失败');
    console.log('✅ 版本冻结机制正常');

    console.log('\n--- 测试 14: 导出 - 按原始版本 ---');
    const exportOriginalRes = await request(
      buildOptions('POST', `/api/export/${formId}`, {
        mode: 'original'
      }),
      {
        mode: 'original'
      }
    );
    assert.strictEqual(exportOriginalRes.statusCode, 200, '原始版本导出应该成功');
    assert.strictEqual(exportOriginalRes.body.exportInfo.exportMode, 'original', '导出模式应该是 original');
    console.log('✅ 原始版本导出正常');

    console.log('\n--- 测试 15: 导出 - 按最新版本映射（展示缺口）---');
    const exportLatestRes = await request(
      buildOptions('POST', `/api/export/${formId}`, {
        mode: 'latest'
      }),
      {
        mode: 'latest'
      }
    );
    assert.strictEqual(exportLatestRes.statusCode, 200, '最新版本导出应该成功');
    assert.strictEqual(exportLatestRes.body.exportInfo.exportMode, 'latest', '导出模式应该是 latest');
    
    const v1Records = exportLatestRes.body.records.filter(r => r.submittedVersion === 1);
    assert.ok(v1Records.length > 0, '应该有 v1 记录');
    
    const v1Record = v1Records[0];
    const phoneGap = v1Record.gaps.find(g => g.field === 'phone');
    assert.ok(phoneGap, 'v1 记录应该有 phone 字段的缺口');
    assert.strictEqual(phoneGap.severity, 'critical', '新增必填字段缺口应该是 critical');
    
    assert.ok(exportLatestRes.body.migrationGaps.length > 0, '应该返回可解释的缺口');
    console.log('✅ 最新版本映射导出正常，缺口识别正确');

    console.log('\n--- 测试 16: 同一 submissionKey 不能切换版本 ---');
    const versionSwitchRes = await request(
      buildOptions('POST', `/api/submissions/${formId}/submit`, {
        submissionKey: 'test_user_001',
        version: 2,
        data: {
          name: '用户',
          email: 'email@example.com',
          phone: '13900139000'
        }
      }),
      {
        submissionKey: 'test_user_001',
        version: 2,
        data: {
          name: '用户',
          email: 'email@example.com',
          phone: '13900139000'
        }
      }
    );
    assert.strictEqual(versionSwitchRes.statusCode, 400, '切换版本应该失败');
    assert.ok(versionSwitchRes.body.error.includes('Cannot update with different version'),
      '错误信息应该说明不能切换版本');
    console.log('✅ submissionKey 版本锁定正常');

    console.log('\n===========================================');
    console.log('✅ 所有测试通过！');
    console.log('===========================================\n');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
  }
}

runTests();