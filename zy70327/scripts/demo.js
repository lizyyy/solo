require('dotenv').config();
const http = require('http');
const testSamples = require('./test-data');

const BASE_URL = `localhost:${process.env.PORT || 3000}`;

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        ...options,
        hostname: 'localhost',
        port: process.env.PORT || 3000,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              data: data ? JSON.parse(data) : {},
            });
          } catch (e) {
            resolve({ statusCode: res.statusCode, data });
          }
        });
      }
    );

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runDemo() {
  console.log('🚀 开始演示慢接口自动归档 API\n');
  console.log('='.repeat(60));

  console.log('\n📊 场景1: 数据库慢请求\n');
  const dbResult = await makeRequest(
    { method: 'POST', path: '/api/archives/submit' },
    testSamples.databaseSlow
  );
  console.log('状态码:', dbResult.statusCode);
  console.log('归档类别:', dbResult.data.data?.category);
  console.log('是否新建:', dbResult.data.data?.is_new);
  console.log('证据:', JSON.stringify(dbResult.data.data?.evidence, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 场景2: 下游服务慢请求\n');
  const downResult = await makeRequest(
    { method: 'POST', path: '/api/archives/submit' },
    testSamples.downstreamSlow
  );
  console.log('状态码:', downResult.statusCode);
  console.log('归档类别:', downResult.data.data?.category);
  console.log('是否新建:', downResult.data.data?.is_new);

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 场景3: 缓存穿透检测\n');
  const cacheResult = await makeRequest(
    { method: 'POST', path: '/api/archives/submit' },
    testSamples.cachePenetration
  );
  console.log('状态码:', cacheResult.statusCode);
  console.log('归档类别:', cacheResult.data.data?.category);
  console.log('是否新建:', cacheResult.data.data?.is_new);
  console.log('证据:', JSON.stringify(cacheResult.data.data?.evidence, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 场景4: 参数异常检测\n');
  const paramResult = await makeRequest(
    { method: 'POST', path: '/api/archives/submit' },
    testSamples.parameterError
  );
  console.log('状态码:', paramResult.statusCode);
  console.log('归档类别:', paramResult.data.data?.category);
  console.log('是否新建:', paramResult.data.data?.is_new);

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 场景5: 未知类别（缺少 traceId）\n');
  const unknownResult = await makeRequest(
    { method: 'POST', path: '/api/archives/submit' },
    testSamples.unknownCategory
  );
  console.log('状态码:', unknownResult.statusCode);
  console.log('归档类别:', unknownResult.data.data?.category);
  console.log('是否新建:', unknownResult.data.data?.is_new);
  console.log('证据:', JSON.stringify(unknownResult.data.data?.evidence, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 场景6: 重复请求（合并到已有归档）\n');
  const dupResult = await makeRequest(
    { method: 'POST', path: '/api/archives/submit' },
    testSamples.duplicateRequest
  );
  console.log('状态码:', dupResult.statusCode);
  console.log('归档类别:', dupResult.data.data?.category);
  console.log('是否新建:', dupResult.data.data?.is_new);
  console.log('是否复发:', dupResult.data.data?.is_recurrence);
  console.log('⚠️  注意: 重复请求不会创建新的归档，而是合并到已有归档并增加计数');

  console.log('\n' + '='.repeat(60));
  console.log('\n📋 查询归档列表\n');
  const listResult = await makeRequest({ method: 'GET', path: '/api/archives' });
  console.log('总归档数:', listResult.data.total);
  console.log('归档列表:', listResult.data.data?.map(a => ({
    id: a.id,
    path: a.api_path,
    method: a.http_method,
    category: a.category,
    status: a.status,
    occurrences: a.occurrence_count,
  })));

  if (dbResult.data.data?.archive_id) {
    console.log('\n' + '='.repeat(60));
    console.log('\n📋 查询单个归档详情\n');
    const detailResult = await makeRequest({
      method: 'GET',
      path: `/api/archives/${dbResult.data.data.archive_id}`,
    });
    console.log('归档详情:', JSON.stringify(detailResult.data.data?.archive, null, 2));
    console.log('样本数量:', detailResult.data.data?.samples?.length);
    console.log('历史记录数量:', detailResult.data.data?.history?.length);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📋 按 traceId 查询相似历史\n');
  const traceResult = await makeRequest({
    method: 'GET',
    path: '/api/archives/trace/trace-db-001',
  });
  console.log('相似样本数:', traceResult.data.total);

  console.log('\n' + '='.repeat(60));
  console.log('\n📋 更新状态: 从待看 -> 处理中\n');
  const firstArchive = listResult.data.data?.[0];
  if (firstArchive) {
    const statusResult = await makeRequest(
      { method: 'PUT', path: `/api/archives/${firstArchive.id}/status` },
      { status: 'processing', operator: '张三', comment: '开始分析' }
    );
    console.log('更新后状态:', statusResult.data.data?.status);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📋 分配负责人\n');
  if (firstArchive) {
    const assignResult = await makeRequest(
      { method: 'PUT', path: `/api/archives/${firstArchive.id}/assign` },
      { responsible: '李四', operator: '张三' }
    );
    console.log('负责人:', assignResult.data.data?.responsible);
    console.log('状态:', assignResult.data.data?.status);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📋 更新处理备注\n');
  if (firstArchive) {
    const notesResult = await makeRequest(
      { method: 'PUT', path: `/api/archives/${firstArchive.id}/notes` },
      { notes: '发现是用户表索引问题，需要添加复合索引', operator: '李四' }
    );
    console.log('备注:', notesResult.data.data?.notes);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📋 标记为已修复\n');
  if (firstArchive) {
    const resolvedResult = await makeRequest(
      { method: 'PUT', path: `/api/archives/${firstArchive.id}/status` },
      { status: 'resolved', operator: '李四', comment: '已添加索引并上线' }
    );
    console.log('更新后状态:', resolvedResult.data.data?.status);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📋 标记误报示例\n');
  const secondArchive = listResult.data.data?.[1];
  if (secondArchive) {
    const falsePosResult = await makeRequest(
      { method: 'PUT', path: `/api/archives/${secondArchive.id}/false-positive` },
      { operator: '王五', comment: '这是正常的批量操作，不是慢查询' }
    );
    console.log('状态:', falsePosResult.data.data?.status);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 场景7: 已修复问题复发\n');
  const recurrenceResult = await makeRequest(
    { method: 'POST', path: '/api/archives/submit' },
    { ...testSamples.databaseSlow, trace_id: 'trace-db-recurrence-001' }
  );
  console.log('状态码:', recurrenceResult.statusCode);
  console.log('归档类别:', recurrenceResult.data.data?.category);
  console.log('是否新建:', recurrenceResult.data.data?.is_new);
  console.log('是否复发:', recurrenceResult.data.data?.is_recurrence);
  console.log('⚠️  注意: 已修复的问题复发时，状态会自动重置为待看');

  console.log('\n' + '='.repeat(60));
  console.log('\n📈 获取统计数据\n');
  const statsResult = await makeRequest({ method: 'GET', path: '/api/stats/dashboard' });
  console.log('仪表盘数据:', JSON.stringify(statsResult.data.data, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('\n📈 获取趋势报告\n');
  const trendResult = await makeRequest({ method: 'GET', path: '/api/stats/trend?days=7' });
  console.log('趋势数据:', JSON.stringify(trendResult.data.data, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ 演示完成！');
  console.log('\n总结:');
  console.log('- 成功归档了 5 个不同类别的慢请求');
  console.log('- 演示了重复请求合并');
  console.log('- 演示了状态流转（待看 -> 处理中 -> 已修复）');
  console.log('- 演示了分配负责人和更新备注');
  console.log('- 演示了问题复发自动重置状态');
  console.log('- 展示了统计和趋势报告功能');
}

runDemo().catch(console.error);
