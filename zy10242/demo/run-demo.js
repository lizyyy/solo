const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:3000/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  return response.json();
}

async function uploadFile(endpoint, filePath, formData = {}) {
  const form = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  form.append('file', fileBuffer, { filename: path.basename(filePath) });
  Object.entries(formData).forEach(([key, value]) => {
    form.append(key, value);
  });

  return new Promise((resolve, reject) => {
    form.submit(`${BASE_URL}${endpoint}`, (err, res) => {
      if (err) return reject(err);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
  });
}

function printSeparator(title = '') {
  console.log('\n' + '='.repeat(60));
  if (title) console.log(`  ${title}`);
  console.log('='.repeat(60) + '\n');
}

function printResult(message, data) {
  console.log(`${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
  console.log('');
}

async function runDemo() {
  console.log('');
  console.log('============================================================');
  console.log('          保险理赔材料补齐 API 演示脚本                      ');
  console.log('============================================================');
  
  let claimId, idCardMaterialId, accidentProofMaterialId;
  let idCardMaterialCode = 'ID_CARD';
  let idempotencyKey = 'claim_2024_001_test';
  
  try {
    printSeparator('1. 健康检查');
    const health = await request('/health');
    printResult('服务状态:', health);

    printSeparator('2. 创建理赔案件（带幂等键）');
    const claim = await request('/claims', {
      method: 'POST',
      body: JSON.stringify({
        policy_number: 'POL2024001',
        customer_name: '张三',
        customer_id: 'CUST001',
        accident_type: '车辆事故',
        accident_date: '2024-01-15',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        idempotency_key: idempotencyKey,
        operator: '理赔员A'
      })
    });
    claimId = claim.data.claim_id;
    printResult('案件创建成功，案件ID:', claimId);
    printResult('案件详情:', claim.data);

    printSeparator('3. 重复提交创建案件（测试幂等键，应返回已有案件）');
    const claimDuplicate = await request('/claims', {
      method: 'POST',
      body: JSON.stringify({
        policy_number: 'POL2024001',
        customer_name: '张三',
        customer_id: 'CUST001',
        accident_type: '车辆事故',
        accident_date: '2024-01-15',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        idempotency_key: idempotencyKey,
        operator: '理赔员A'
      })
    });
    printResult('重复提交结果（案件ID应相同）:', claimDuplicate.data.claim_id);
    printResult('幂等校验结果:', claimId === claimDuplicate.data.claim_id ? '✅ 幂等校验通过 - 相同案件ID' : '❌ 幂等校验失败');

    printSeparator('4. 添加材料定义 - 身份证（必填）');
    const idCardMaterial = await request(`/claims/${claimId}/materials`, {
      method: 'POST',
      body: JSON.stringify({
        material_code: idCardMaterialCode,
        material_name: '身份证复印件',
        description: '需正反面',
        is_required: true,
        operator: '理赔员A'
      })
    });
    idCardMaterialId = idCardMaterial.data.material_id;
    printResult('身份证材料创建成功:', idCardMaterial.data);

    printSeparator('5. 重复提交材料定义（测试材料幂等，应返回已有材料）');
    const idCardMaterialDuplicate = await request(`/claims/${claimId}/materials`, {
      method: 'POST',
      body: JSON.stringify({
        material_code: idCardMaterialCode,
        material_name: '身份证复印件',
        description: '需正反面',
        is_required: true,
        operator: '理赔员A'
      })
    });
    printResult('重复提交材料结果:', idCardMaterialDuplicate.data.material_id);
    printResult('材料幂等校验结果:', idCardMaterialId === idCardMaterialDuplicate.data.material_id ? '✅ 材料幂等校验通过 - 相同材料ID' : '❌ 材料幂等校验失败');

    printSeparator('6. 添加材料定义 - 事故证明（必填）');
    const accidentProofMaterial = await request(`/claims/${claimId}/materials`, {
      method: 'POST',
      body: JSON.stringify({
        material_code: 'ACCIDENT_PROOF',
        material_name: '事故责任认定书',
        description: '交警出具',
        is_required: true,
        operator: '理赔员A'
      })
    });
    accidentProofMaterialId = accidentProofMaterial.data.material_id;
    printResult('事故证明材料创建成功:', accidentProofMaterial.data);

    printSeparator('7. 查询当前材料列表');
    const materials = await request(`/claims/${claimId}/materials`);
    printResult('当前材料列表:', materials.data);

    printSeparator('8. 查询缺件列表（应为2项）');
    const missingMaterials = await request(`/claims/${claimId}/materials/missing`);
    printResult('缺件列表:', missingMaterials.data);

    const tempFile1 = path.join(__dirname, 'id_card_v1.jpg');
    fs.writeFileSync(tempFile1, Buffer.from('这是身份证照片v1'));
    
    printSeparator('9. 上传身份证材料');
    const uploadResult1 = await uploadFile(
      `/materials/${idCardMaterialId}/upload`,
      tempFile1,
      { operator: '客户' }
    );
    printResult('身份证上传成功:', uploadResult1.data);

    printSeparator('10. 再次查询缺件列表（应为1项，已上传待审核也算缺件）');
    const missingMaterials2 = await request(`/claims/${claimId}/materials/missing`);
    printResult('缺件列表:', missingMaterials2.data);

    const tempFile3 = path.join(__dirname, 'id_card_v2.jpg');
    fs.writeFileSync(tempFile3, Buffer.from('这是身份证照片v2-更新版'));
    
    printSeparator('11. 模拟客户重新上传身份证（测试版本控制，审核前可以重新上传）');
    let reuploadResult;
    try {
      reuploadResult = await uploadFile(
        `/materials/${idCardMaterialId}/reupload`,
        tempFile3,
        { operator: '客户', reason: '身份证照片更新' }
      );
      printResult('身份证重新上传成功（新版本v2）:', reuploadResult.data);
      idCardMaterialId = reuploadResult.data.material_id;
    } catch (e) {
      printResult('重新上传错误:', e.message);
    }

    printSeparator('12. 查询身份证材料版本历史（应显示2个版本）');
    const materialHistory = await request(`/claims/${claimId}/materials/${idCardMaterialCode}/history`);
    printResult('身份证版本历史（2个版本）:', materialHistory.data);

    printSeparator('13. 审核身份证材料 - 通过（v2版本）');
    const auditResult1 = await request(`/materials/${idCardMaterialId}/audit`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'approved',
        operator: '审核员B',
        remark: '身份证清晰有效'
      })
    });
    printResult('身份证审核通过:', auditResult1.data);

    printSeparator('14. 测试边界情况 - 已审核通过材料尝试重新上传（应失败）');
    try {
      const reuploadAfterApproved = await uploadFile(
        `/materials/${idCardMaterialId}/reupload`,
        tempFile3,
        { operator: '客户', reason: '审核后尝试重新上传' }
      );
      printResult('重新上传结果:', reuploadAfterApproved);
    } catch (e) {
      printResult('已审核材料重新上传被正确阻止:', e.message);
    }

    const tempFile2 = path.join(__dirname, 'accident_proof_v1.jpg');
    fs.writeFileSync(tempFile2, Buffer.from('这是事故证明v1'));
    
    printSeparator('15. 上传事故证明材料');
    const uploadResult2 = await uploadFile(
      `/materials/${accidentProofMaterialId}/upload`,
      tempFile2,
      { operator: '客户' }
    );
    printResult('事故证明上传成功:', uploadResult2.data);

    printSeparator('16. 审核事故证明材料 - 通过（所有必填材料审核通过后案件应自动变为completed）');
    const auditResult2 = await request(`/materials/${accidentProofMaterialId}/audit`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'approved',
        operator: '审核员B',
        remark: '事故证明齐全'
      })
    });
    printResult('事故证明审核通过:', auditResult2.data);

    printSeparator('17. 查看案件状态（应自动变为completed）');
    const claimDetail = await request(`/claims/${claimId}`);
    printResult('案件状态:', claimDetail.data);
    printResult('案件完成校验结果:', claimDetail.data.status === 'completed' ? '✅ 案件自动完成 - 所有材料审核通过' : '❌ 案件状态不正确');

    printSeparator('18. 测试边界情况 - 已完成案件重新上传材料（应失败）');
    try {
      const reuploadAfterComplete = await uploadFile(
        `/materials/${idCardMaterialId}/reupload`,
        tempFile3,
        { operator: '客户', reason: '案件完成后尝试重新上传' }
      );
      printResult('重新上传结果:', reuploadAfterComplete);
    } catch (e) {
      printResult('已完成案件重新上传被正确阻止:', e.message);
    }

    printSeparator('19. 创建缺件提醒（测试重复提醒计数累加）');
    const reminder1 = await request(`/claims/${claimId}/reminders/missing`, {
      method: 'POST',
      body: JSON.stringify({ operator: '系统' })
    });
    printResult('第一次提醒:', reminder1.data);

    printSeparator('20. 再次创建相同提醒（测试计数累加）');
    const reminder2 = await request(`/claims/${claimId}/reminders/missing`, {
      method: 'POST',
      body: JSON.stringify({ operator: '系统' })
    });
    printResult('第二次提醒:', reminder2.data);

    printSeparator('21. 查询审核日志（完整操作记录）');
    const auditLogs = await request(`/claims/${claimId}/audit-logs`);
    printResult('审核日志列表:', auditLogs.data);

    printSeparator('22. 测试边界情况 - 必填材料删除（应失败）');
    try {
      const deleteResult = await request(`/materials/${idCardMaterialId}`, {
        method: 'DELETE',
        body: JSON.stringify({ operator: '理赔员A', reason: '测试删除' })
      });
      printResult('删除结果:', deleteResult);
    } catch (e) {
      printResult('必填材料删除被正确阻止:', e.message);
    }

    printSeparator('✅ 演示完成');
    console.log('所有核心功能演示完毕！');
    console.log('');
    console.log('案件ID:', claimId);
    console.log('接口文档请查看: API_DOCUMENTATION.md');
    console.log('启动服务: npm start');
    console.log('');

    [tempFile1, tempFile2, tempFile3].forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });

  } catch (error) {
    console.error('❌ 演示过程出错:', error);
    process.exit(1);
  }
}

runDemo();
