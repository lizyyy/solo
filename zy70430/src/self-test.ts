import { RequestSizeGuardrail } from './guardrail';
import { ReportExporter } from './exporter';
import * as fs from 'fs-extra';

function generateLongString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789，。！？；：""\'\'（）【】';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function runTests() {
  console.log('=== 请求大小护栏自检脚本 ===\n');

  fs.emptyDirSync('./src/data');
  fs.emptyDirSync('./exports');

  const guardrail = new RequestSizeGuardrail({ maxFieldLength: 200 });
  const exporter = new ReportExporter(guardrail);

  console.log('✅ 护栏实例初始化成功');
  console.log('   配置:', guardrail.getConfig(), '\n');

  console.log('📝 测试1: 创建跨天灰度发布备忘样例');
  const grayReleaseNotes = [
    {
      projectName: '智慧物业平台V2.3',
      version: '2.3.20240515',
      releaseDate: '2024-05-15',
      grayStartTime: '2024-05-15 08:00:00',
      grayEndTime: '2024-05-16 20:00:00',
      targetUsers: '北京朝阳区所有小区业主',
      features: [
        {
          name: '报修工单智能分派',
          description: '根据维修人员实时位置和技能标签自动分派工单',
          riskLevel: 'medium',
          rollbackPlan: '切回原手动分派模块'
        },
        {
          name: '业主APP消息推送优化',
          description: '推送内容过长导致部分机型显示异常的问题修复。增加消息截断逻辑，超过500字后自动截断并显示"查看更多"按钮。经过测试验证在iOS 15+和Android 10+设备上表现正常。但在部分低端Android设备上仍存在渲染性能问题，需要持续观察用户反馈数据。' + generateLongString(400),
          riskLevel: 'high',
          rollbackPlan: '使用旧版推送服务'
        }
      ],
      changeLog: '本次更新包含12项功能优化和8个Bug修复。主要更新集中在报修流程优化和性能提升。详细说明请参考Confluence文档。' + generateLongString(300),
      operator: 'zhangwei',
      approver: 'liming',
      status: 'processing'
    },
    {
      projectName: '社区团购系统',
      version: '1.8.0',
      releaseDate: '2024-05-14',
      grayStartTime: '2024-05-14 10:00:00',
      grayEndTime: '2024-05-15 18:00:00',
      targetUsers: '试点小区团长',
      features: [
        {
          name: '团长佣金结算优化',
          description: '支持T+1自动结算和账单明细导出功能',
          riskLevel: 'low',
          rollbackPlan: '手动计算佣金'
        }
      ],
      changeLog: '优化团长端界面，增加数据统计面板',
      operator: 'wangfang',
      approver: 'chenjian',
      status: 'completed'
    }
  ];

  const grayResults = grayReleaseNotes.map((note, index) => {
    const result = guardrail.processRequest(
      '灰度发布系统',
      '跨天灰度发布备忘',
      note,
      { batch: `BATCH-202405-${index + 1}` }
    );
    console.log(`   记录 ${index + 1}: ${result.record.id}, 问题数: ${result.record.fieldIssues.length}`);
    return result;
  });

  console.log('   ✅ 跨天灰度发布备忘创建成功\n');

  console.log('📝 测试2: 创建物业报修单样例');
  const repairOrders = [
    {
      orderNo: 'WYBX-20240515-0088',
      community: '阳光花园小区',
      building: '3号楼',
      unit: '2单元',
      room: '1503',
      ownerName: '赵先生',
      phone: '13800138000',
      repairType: '水电维修',
      title: '厨房水龙头漏水',
      description: '洗菜盆冷热水龙头连接处漏水，滴水比较严重，已经关闭了总阀门。需要尽快上门维修，最好明天上午9点以后家里有人。' + generateLongString(250),
      appointmentTime: '2024-05-16 09:00:00',
      urgency: 'normal',
      images: ['img1.jpg', 'img2.jpg'],
      createTime: '2024-05-15 18:30:00',
      status: 'pending',
      source: '业主APP'
    }
  ];

  const repairResults = repairOrders.map((order, index) => {
    const result = guardrail.processRequest(
      '物业服务中心',
      '物业报修单',
      order,
      { channel: 'mobile' }
    );
    console.log(`   报修单 ${index + 1}: ${result.record.id}, 问题数: ${result.record.fieldIssues.length}`);
    return result;
  });

  console.log('   ✅ 物业报修单创建成功\n');

  console.log('📝 测试3: 原始输入溯源验证');
  const testRecord = grayResults[0].record;
  const originalDesc = guardrail.getFieldOriginalValue(testRecord.id, 'features[1].description');
  console.log(`   字段路径: features[1].description`);
  console.log(`   原始值长度: ${originalDesc?.length} 字符`);
  console.log(`   匹配验证: ${originalDesc === testRecord.originalInput.features[1].description ? '✅ 通过' : '❌ 失败'}`);
  console.log();

  console.log('📝 测试4: 人工修正备注（物业报修单）');
  const repairRecord = repairResults[0].record;
  const descIssue = repairRecord.fieldIssues.find(i => i.fieldPath === 'description');
  if (descIssue) {
    const correction = guardrail.addCorrection(
      repairRecord.id,
      'description',
      'kefu_liyi',
      `字段长度 ${descIssue.actualLength} 字节，超过限制 ${descIssue.maxLength} 字节，标记为 overflow`,
      `字段长度 ${descIssue.actualLength} 字节，确认业主报修描述完整，业务侧允许报修单描述字段最长500字节，该字段属于特殊业务场景豁免`,
      '报修单描述字段经业务确认，属于业主详细报修场景，需保留完整信息。已在工单系统中单独配置该字段的长度限制为500字节。当前系统默认配置200字节不适用于该场景。',
      '业务豁免审批单: WORK-2024-0515-001'
    );
    console.log(`   修正记录: ${correction?.id}`);
    console.log(`   字段路径: ${correction?.fieldPath}`);
    console.log(`   操作人: ${correction?.operator}`);
    console.log(`   修正理由: ${correction?.reason}`);
    console.log(`   处理依据: ${correction?.evidence}`);
    console.log(`   ✅ 人工修正添加成功`);
  }
  console.log();

  console.log('📝 测试5: 重复提交检测');
  const duplicateTest = guardrail.processRequest(
    '灰度发布系统',
    '跨天灰度发布备忘',
    grayReleaseNotes[1],
    { batch: 'BATCH-202405-TEST' }
  );
  console.log(`   重复提交检测: ${duplicateTest.isDuplicate ? '✅ 检测成功 - 复用旧结论' : '❌ 检测失败'}`);
  console.log(`   原有记录ID: ${duplicateTest.existingRecord?.id}`);
  console.log(`   状态保持: ${duplicateTest.record.status}`);
  console.log();

  console.log('📝 测试6: 边界情况覆盖');
  const boundaryTests = [
    { name: '刚好达到阈值', str: generateLongString(200), expectIssues: 0 },
    { name: '超出阈值1字节', str: generateLongString(201), expectIssues: 1 },
    { name: '超出阈值50%', str: generateLongString(300), expectIssues: 1 },
    { name: '超出阈值100%', str: generateLongString(400), expectIssues: 1 },
    { name: '嵌套对象深层字段', obj: { a: { b: { c: { d: generateLongString(300) } } } }, expectIssues: 1 },
    { name: '数组多元素超长', obj: { items: [generateLongString(250), generateLongString(260), 'normal'] }, expectIssues: 2 },
    { name: '混合嵌套数组', obj: { level1: { items: [{ name: generateLongString(220) }] } }, expectIssues: 1 }
  ];

  let passed = 0;
  for (const test of boundaryTests) {
    const input = test.str ? { field: test.str } : test.obj!;
    const result = guardrail.processRequest('边界测试', test.name, input);
    const actualIssues = result.record.fieldIssues.length;
    const pass = actualIssues === test.expectIssues;
    if (pass) passed++;
    console.log(`   ${pass ? '✅' : '❌'} ${test.name}: 预期 ${test.expectIssues} 个问题, 实际 ${actualIssues} 个`);

    if (result.record.fieldIssues.length > 0) {
      result.record.fieldIssues.forEach(issue => {
        console.log(`      - ${issue.fieldPath}: ${issue.actualLength} 字节, 严重程度 ${issue.severity}`);
      });
    }
  }
  console.log(`   边界测试: ${passed}/${boundaryTests.length} 通过\n`);

  console.log('📝 测试7: 导出复核报告');
  const exportPaths = await exporter.exportForReview('test-runner');
  console.log(`   JSON报告: ${exportPaths.jsonPath}`);
  console.log(`   Markdown报告: ${exportPaths.mdPath}`);
  console.log(`   ✅ 报告导出成功\n`);

  const allRecords = guardrail.getAllRecords();
  console.log('=== 最终统计 ===');
  console.log(`总记录数: ${allRecords.length}`);
  console.log(`待复核记录: ${guardrail.getPendingRecords().length}`);
  console.log(`含有人工修正: ${allRecords.filter(r => r.corrections.length > 0).length}`);
  console.log(`总问题字段数: ${allRecords.reduce((sum, r) => sum + r.fieldIssues.length, 0)}`);
  console.log();
  console.log('=== 所有测试完成 ===');

  console.log('\n📋 人工修正记录详情（按字段路径）:');
  allRecords.filter(r => r.corrections.length > 0).forEach(record => {
    record.corrections.forEach(corr => {
      console.log(`\n  [${corr.fieldPath}]`);
      console.log(`    来源记录: ${record.id} (${record.source} - ${record.requestType})`);
      console.log(`    原系统判断: ${corr.originalDecision}`);
      console.log(`    人工修正: ${corr.correctedDecision}`);
      console.log(`    处理依据: ${corr.evidence}`);
    });
  });
}

runTests().catch(console.error);
