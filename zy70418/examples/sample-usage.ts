import axios from 'axios';

const API_BASE = 'http://localhost:3000/api/validation';

const sampleFiles = [
  {
    fileName: '产品宣传图_2024夏季款_001.jpg',
    supplierCode: 'SUP001',
    supplierName: '北京图像科技有限公司',
    department: '市场部'
  },
  {
    fileName: '品牌LOGO设计稿_v3.png',
    supplierCode: '',
    supplierName: '',
    department: '设计部'
  },
  {
    fileName: '活动现场照片_045.jpg',
    supplierCode: 'SUP999',
    supplierName: '未知供应商',
    department: '市场部'
  },
  {
    fileName: '商品详情页主图.png',
    supplierCode: 'SUP004',
    supplierName: '深圳高峰图片社',
    department: '审核部'
  },
  {
    fileName: '首页Banner设计稿_终稿.psd',
    supplierCode: 'SUP003',
    supplierName: '广州创意设计室',
    department: '设计部'
  }
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runDemo() {
  console.log('=== 文件入库校验服务演示 ===\n');

  try {
    console.log('1. 创建校验批次...');
    const batchRes = await axios.post(`${API_BASE}/batches`, {
      batchName: '高峰图片审核样本批次',
      department: '审核部',
      createdBy: '张审核'
    });
    const batchId = batchRes.data.batchId;
    console.log(`   批次创建成功: ${batchId}\n`);

    await delay(500);

    console.log('2. 批量上传样例文件并进行校验...');
    for (const file of sampleFiles) {
      console.log(`   - 处理: ${file.fileName}`);
      try {
        const uploadRes = await axios.post(`${API_BASE}/upload`, {
          batchId,
          ...file,
          fileSize: Math.floor(Math.random() * 5000000),
          fileType: 'image/jpeg',
          filePath: `/uploads/${file.fileName}`,
          uploader: '李上传'
        });

        const failedChecks = uploadRes.data.validationResults.filter(
          (r: any) => r.status === 'failed'
        );
        if (failedChecks.length > 0) {
          console.log(`     ❌ 发现 ${failedChecks.length} 个问题`);
          failedChecks.forEach((check: any) => {
            console.log(`        [${check.riskLevel}] ${check.checkType}: ${check.errorMessage}`);
          });
        } else {
          console.log(`     ✅ 校验通过`);
        }
      } catch (error) {
        console.log(`     ⚠️  处理出错: ${(error as Error).message}`);
      }
      await delay(200);
    }
    console.log();

    console.log('3. 查询所有失败项...');
    const failedRes = await axios.get(`${API_BASE}/failed-items`, {
      params: { batchId, resolved: 'false' }
    });
    console.log(`   共发现 ${failedRes.data.items.length} 个失败项:`);
    failedRes.data.items.forEach((item: any, index: number) => {
      console.log(`   ${index + 1}. ${item.fileName}`);
      console.log(`      风险等级: ${item.riskLevel}`);
      console.log(`      错误: ${item.errorMessage}`);
    });
    console.log();

    console.log('4. 按风险等级查询 (high)...');
    const highRiskRes = await axios.get(`${API_BASE}/risk-level/${batchId}/high`);
    console.log(`   高风险项数量: ${highRiskRes.data.data.summary.failedCount}`);
    console.log();

    console.log('5. 导出校验报告 (Markdown格式)...');
    const exportRes = await axios.get(`${API_BASE}/export/${batchId}?format=markdown`);
    console.log('   报告生成成功! 预览如下:');
    console.log('   ' + '='.repeat(60));
    console.log(exportRes.data.split('\n').slice(0, 30).join('\n   '));
    console.log('   ' + '='.repeat(60));
    console.log();

    console.log('6. 生成清理/回滚候选清单...');
    const rollbackRes = await axios.post(`${API_BASE}/rollback-candidates`, {
      batchId,
      reason: '空值校验失败，需人工确认后再入库',
      approver: '王主管'
    });
    console.log(`   已生成 ${rollbackRes.data.candidates.length} 个回滚候选，需人工审核`);
    console.log();

    console.log('7. 模拟人工修正...');
    if (failedRes.data.items.length > 0) {
      const failedItem = failedRes.data.items[0];
      console.log(`   修正文件: ${failedItem.fileName}`);
      console.log(`   字段: supplier_code`);
      console.log(`   原值: ${failedItem.supplierCode || '(空)'}`);
      console.log(`   新值: SUP002`);
      
      const correctionRes = await axios.post(`${API_BASE}/correct`, {
        fileRecordId: failedItem.fileRecordId,
        batchId,
        fieldName: 'supplier_code',
        oldValue: failedItem.supplierCode || '',
        newValue: 'SUP002',
        correctedBy: '赵修正',
        correctionReason: '经人工核对，正确供应商代码为SUP002',
        riskLevel: 'medium'
      });
      console.log(`   修正成功，记录ID: ${correctionRes.data.correction.id}`);
    }
    console.log();

    console.log('8. 查询修正记录...');
    const correctionsRes = await axios.get(`${API_BASE}/corrections`, {
      params: { batchId }
    });
    console.log(`   共 ${correctionsRes.data.records.length} 条修正记录`);
    correctionsRes.data.records.forEach((record: any) => {
      console.log(`   - ${record.fieldName}: ${record.oldValue} → ${record.newValue}`);
      console.log(`     原因: ${record.correctionReason}`);
      console.log(`     修正人: ${record.correctedBy}`);
    });
    console.log();

    console.log('9. 查询批次最终状态...');
    const batchResFinal = await axios.get(`${API_BASE}/batches/${batchId}`);
    const batch = batchResFinal.data.batch;
    console.log(`   批次: ${batch.batchName}`);
    console.log(`   状态: ${batch.status}`);
    console.log(`   校验通过: ${batch.successCount}`);
    console.log(`   校验失败: ${batch.failedCount}`);
    console.log(`   人工修正: ${batch.manuallyCorrectedCount}`);
    console.log();

    console.log('=== 演示完成 ===');
    console.log('\n提示:');
    console.log('- 失败项已单独保存，方便接手人查看原因');
    console.log('- 清理/回滚操作需要先生成候选清单，避免误伤真实数据');
    console.log('- 所有人工修正都留下了备注，不会直接覆盖系统判断');
    console.log('- 导出报告中包含了供应商目录修正前后的对比');
    console.log('- 支持按风险等级回查，方便进行分级处理');

  } catch (error) {
    console.error('演示过程出错:', (error as Error).message);
    if ((error as any).response) {
      console.error('响应详情:', (error as any).response.data);
    }
  }
}

runDemo();
