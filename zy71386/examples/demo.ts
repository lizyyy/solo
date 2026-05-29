import { ContractSentinel } from '../src';

async function main() {
  console.log('=== 接口契约差异哨兵 - 演示 ===\n');

  const sentinel = new ContractSentinel('演示系统');

  console.log('1. 验证输入完整性...');
  const validation = sentinel.validateInput({
    openapiPath: './examples/sample-openapi.yaml',
    mockResponses: [],
    realResponses: []
  });

  if (!validation.valid) {
    console.log('   缺少的输入:', validation.missing.join(', '));
  }
  console.log('   ✅ 验证完成\n');

  console.log('2. 解析OpenAPI文档...');
  const openapiContract = sentinel.parseOpenAPI('./examples/sample-openapi.yaml');
  console.log(`   解析完成，共 ${openapiContract.endpoints.length} 个端点\n`);

  console.log('3. 模拟从响应数据推断契约...');
  const mockResponses = [
    {
      path: '/users',
      method: 'GET',
      statusCode: 200,
      body: {
        code: 0,
        data: [
          {
            id: '1',
            name: '张三',
            email: 'zhangsan@example.com',
            status: 'active',
            createdAt: '2024-01-01T00:00:00Z'
          }
        ],
        total: 100,
        extraField: '这个字段在文档中没有'
      }
    },
    {
      path: '/users/1',
      method: 'GET',
      statusCode: 200,
      body: {
        code: 0,
        data: {
          id: '1',
          name: '张三',
          email: 'zhangsan@example.com',
          status: 'active'
        }
      }
    }
  ];

  const mockContract = sentinel.parseFromResponses(mockResponses, 'mock', 'mock-1.0');
  console.log(`   Mock契约生成完成\n`);

  console.log('4. 比对OpenAPI文档与Mock响应...');
  const diff = sentinel.compare(openapiContract, mockContract);
  
  console.log(`   总差异数:`, diff.summary.totalDiffs);
  console.log(`   破坏性变更:`, diff.summary.breakingChanges);
  console.log(`   兼容性:`, diff.summary.isCompatible ? '兼容 ✅' : '不兼容 ❌');
  console.log();

  if (diff.endpointDiffs.length > 0) {
    console.log('   差异详情:');
    for (const endpointDiff of diff.endpointDiffs) {
      console.log(`   - ${endpointDiff.method} ${endpointDiff.path}`);
      for (const fieldDiff of endpointDiff.fieldDiffs.slice(0, 3)) {
        const icon = fieldDiff.severity === 'breaking' ? '🔴' : fieldDiff.severity === 'warning' ? '🟡' : '🔵';
        console.log(`     ${icon} ${fieldDiff.field}: ${fieldDiff.type}`);
        if (fieldDiff.source?.context) {
          console.log(`        上下文: ${fieldDiff.source.context}`);
        }
      }
    }
    console.log();
  }

  console.log('5. 生成样例数据...');
  const examples = sentinel.generateExamples(openapiContract);
  console.log(`   为 ${examples.length} 个端点生成了样例`);
  for (const ex of examples.slice(0, 2)) {
    console.log(`   - ${ex.method} ${ex.path}`);
  }
  console.log();

  console.log('6. 导出自定义报告...');
  sentinel.exportReport(diff, {
    format: 'html',
    outputPath: './examples/report.html',
    includeExamples: true
  });
  console.log('   HTML报告已导出到 ./examples/report.html');

  sentinel.exportReport(diff, {
    format: 'markdown',
    outputPath: './examples/report.md',
    includeExamples: true
  });
  console.log('   Markdown报告已导出到 ./examples/report.md');

  sentinel.exportReport(diff, {
    format: 'json',
    outputPath: './examples/report.json'
  });
  console.log('   JSON报告已导出到 ./examples/report.json');
  console.log();

  console.log('7. 追踪契约版本...');
  const record = sentinel.trackVersion(openapiContract);
  console.log(`   已追踪版本: ${record.version}`);
  console.log(`   变更数: ${record.changes.length}`);
  console.log();

  console.log('=== 演示完成 ===');
  console.log();
  console.log('💡 提示: 运行 npm run dev -- --help 查看更多命令');
}

main().catch(console.error);
