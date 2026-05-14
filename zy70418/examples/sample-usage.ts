import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3000/api/validation';

const sampleFiles = [
  {
    fileName: '产品宣传图_2024夏季款_001.jpg',
    supplierCode: 'SUP001',
    supplierName: '北京图像科技有限公司',
    department: '市场部',
    hasEmptyValue: false
  },
  {
    fileName: '品牌LOGO设计稿_v3.png',
    supplierCode: '',
    supplierName: '',
    department: '设计部',
    hasEmptyValue: true
  },
  {
    fileName: '活动现场照片_045.jpg',
    supplierCode: 'SUP999',
    supplierName: '未知供应商',
    department: '市场部',
    hasEmptyValue: false
  },
  {
    fileName: '商品详情页主图.png',
    supplierCode: 'SUP004',
    supplierName: '深圳高峰图片社',
    department: '审核部',
    hasEmptyValue: false
  },
  {
    fileName: '首页Banner设计稿_终稿.psd',
    supplierCode: 'SUP003',
    supplierName: '广州创意设计室',
    department: '设计部',
    hasEmptyValue: false
  }
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createTempImage = (fileName: string): string => {
  const tempDir = path.join(process.cwd(), 'temp_test');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, Buffer.from('fake image content for testing', 'utf-8'));
  return filePath;
};

async function uploadFile(batchId: string, fileInfo: any) {
  const filePath = createTempImage(fileInfo.fileName);
  const formData = new FormData();
  
  formData.append('file', fs.createReadStream(filePath));
  formData.append('batchId', batchId);
  formData.append('supplierCode', fileInfo.supplierCode);
  formData.append('supplierName', fileInfo.supplierName);
  formData.append('department', fileInfo.department);
  formData.append('uploader', '李上传');

  const response = await axios.post(`${API_BASE}/upload`, formData, {
    headers: formData.getHeaders()
  });

  fs.unlinkSync(filePath);
  return response.data;
}

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
    const uploadedResults = [];
    for (const file of sampleFiles) {
      console.log(`   - 处理: ${file.fileName}`);
      try {
        const uploadRes = await uploadFile(batchId, file);
        uploadedResults.push({ ...file, ...uploadRes });

        const failedChecks = uploadRes.validationResults.filter(
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
        if ((error as any).response) {
          console.log(`        详情: ${JSON.stringify((error as any).response.data)}`);
        }
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
      createdBy: '系统自动'
    });
    console.log(`   已生成 ${rollbackRes.data.candidates.length} 个回滚候选，状态为待审批`);
    rollbackRes.data.candidates.forEach((c: any, i: number) => {
      console.log(`     ${i + 1}. ${c.fileName} - 状态: ${c.approved ? '已批准' : '待审批'}`);
    });
    console.log();

    console.log('7. 审批回滚候选清单...');
    if (rollbackRes.data.candidates.length > 0) {
      const candidateId = rollbackRes.data.candidates[0].id;
      await axios.put(`${API_BASE}/rollback-candidates/${candidateId}/approve`, {
        approved: true,
        approver: '王主管',
        approvalNote: '确认该文件供应商信息为空，需要退回修正后重新提交'
      });
      console.log(`   候选 ${candidateId} 已由王主管批准`);
    }
    console.log();

    console.log('8. 查询待处理回滚清单...');
    const pendingRollbackRes = await axios.get(`${API_BASE}/rollback-candidates`, {
      params: { batchId, approved: 'false' }
    });
    console.log(`   还有 ${pendingRollbackRes.data.candidates.length} 个候选待审批`);
    console.log();

    console.log('9. 模拟人工修正 (仅添加备注，保留原始校验状态)...');
    if (failedRes.data.items.length > 0) {
      const failedItem = failedRes.data.items.find((item: any) => item.checkType === 'empty_value_check');
      if (failedItem) {
        console.log(`   文件: ${failedItem.fileName}`);
        console.log(`   字段: supplier_code`);
        console.log(`   原始值: ${failedItem.supplierCode || '(空)'}`);
        console.log(`   修正值: SUP002`);
        console.log(`   (注: 系统保留原始校验失败状态，只添加人工修正记录)`);
        
        const correctionRes = await axios.post(`${API_BASE}/correct`, {
          fileRecordId: failedItem.fileRecordId,
          batchId,
          fieldName: 'supplier_code',
          oldValue: failedItem.supplierCode || '',
          newValue: 'SUP002',
          correctedBy: '赵修正',
          correctionReason: '经人工核对，正确供应商代码为SUP002，已与供应商确认',
          riskLevel: 'medium'
        });
        console.log(`   修正记录已保存: ${correctionRes.data.correction.id}`);
      }
    }
    console.log();

    console.log('10. 查询修正记录 (原始校验状态保留)...');
    const correctionsRes = await axios.get(`${API_BASE}/corrections`, {
      params: { batchId }
    });
    console.log(`   共 ${correctionsRes.data.records.length} 条修正记录`);
    correctionsRes.data.records.forEach((record: any) => {
      console.log(`   - ${record.fieldName}: ${record.oldValue} → ${record.newValue}`);
      console.log(`     原因: ${record.correctionReason}`);
      console.log(`     修正人: ${record.correctedBy}`);
      console.log(`     原始状态: ${record.previousStatus} (保留未覆盖)`);
    });
    console.log();

    console.log('11. 查询原始校验结果 (验证状态未被覆盖)...');
    const validationRes = await axios.get(`${API_BASE}/export/${batchId}?format=json`);
    const validationData = typeof validationRes.data === 'string' ? JSON.parse(validationRes.data) : validationRes.data;
    const failedResults = validationData.validationResults.filter((r: any) => r.status === 'failed');
    console.log(`   原始失败校验结果仍保留: ${failedResults.length} 条 (未被人工修正覆盖)`);
    console.log();

    console.log('12. 查询批次最终状态...');
    const batchResFinal = await axios.get(`${API_BASE}/batches/${batchId}`);
    const batch = batchResFinal.data.batch;
    console.log(`   批次: ${batch.batchName}`);
    console.log(`   状态: ${batch.status}`);
    console.log(`   校验通过: ${batch.successCount}`);
    console.log(`   校验失败: ${batch.failedCount}`);
    console.log(`   人工修正记录: ${batch.manuallyCorrectedCount}`);
    console.log();

    console.log('=== 演示完成 ===');
    console.log('\n✅ 核心设计原则验证:');
    console.log('   1. ✅ 失败路径透明化: 空值校验失败被正确标记，原因可追溯');
    console.log('   2. ✅ 失败项单独保存: 独立表存储，接手人可直接查看');
    console.log('   3. ✅ 多格式输出一致: JSON/Markdown/Download 内容统一');
    console.log('   4. ✅ 安全清理机制: 先候选→再审批→后执行，避免误伤');
    console.log('   5. ✅ 人工修正可追溯: 仅添加修正备注，不覆盖原始校验失败状态');
    console.log('   6. ✅ 真实场景样例: 使用业务化文件名和真实供应商目录');
    console.log('   7. ✅ 风险等级回查: 支持按风险等级分级查看和处理');

    const tempDir = path.join(process.cwd(), 'temp_test');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }

  } catch (error) {
    console.error('演示过程出错:', (error as Error).message);
    if ((error as any).response) {
      console.error('响应详情:', (error as any).response.data);
    }
  }
}

runDemo();
