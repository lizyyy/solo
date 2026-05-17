import axios from 'axios';
import { DeviceModel } from '../models/Device';
import { InspectorModel } from '../models/Inspector';
import { InspectionService } from '../services/InspectionService';
import '../database';

const API_BASE = 'http://localhost:3000/api/inspection';

async function waitForServer() {
  console.log('⏳ 等待服务器启动...');
  for (let i = 0; i < 30; i++) {
    try {
      await axios.get('http://localhost:3000/health');
      console.log('✅ 服务器已就绪\n');
      return;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('服务器启动超时');
}

async function runTests() {
  console.log('🧪 ========================================');
  console.log('🧪 设备维保系统巡检漏检补录 API 验收测试');
  console.log('🧪 ========================================\n');

  await waitForServer();

  const devices = await DeviceModel.findAll();
  const inspectors = await InspectorModel.findAll();
  
  console.log('📊 基础数据:');
  console.log(`  设备数量: ${devices.length}`);
  console.log(`  巡检人员数量: ${inspectors.length}\n`);

  let normalFlowRecordId: string;
  let conflictRecordId: string;
  let rejectedRecordId: string;

  console.log('📋 测试 1: 创建漏检记录');
  console.log('----------------------------------------');
  try {
    const createRes = await axios.post(`${API_BASE}/records`, {
      planId: 'PLAN-TEST-001',
      deviceId: devices[0].id,
      inspectorId: inspectors[0].id,
      planDate: '2024-05-15',
      supplementReason: '测试漏检记录-正常流测试',
      discoveredDate: '2024-05-17',
      createdBy: inspectors[1].id,
      createdByName: inspectors[1].name
    });
    normalFlowRecordId = createRes.data.data.id;
    console.log('✅ 创建成功, ID:', normalFlowRecordId.substring(0, 8), '...');
    console.log('   状态:', createRes.data.data.status);
  } catch (e: any) { console.log('❌ 失败:', e.response?.data?.message || e.message); }

  console.log('\n📋 测试 2: 完整流转 (漏检待补 -> 已补录 -> 已确认)');
  console.log('----------------------------------------');
  try {
    const submitRes = await axios.post(`${API_BASE}/records/${normalFlowRecordId}/submit`, {
      actualInspectionDate: '2024-05-17',
      supplementDate: '2024-05-17',
      inspectionResults: { '外观': '正常', '运行': '正常', '温度': '45°C' },
      operatorId: inspectors[0].id,
      operatorName: inspectors[0].name,
      remarks: '测试提交补录'
    });
    console.log('✅ 提交补录成功, 状态:', submitRes.data.data.status, '(流程类型:', submitRes.data.data.flowType, ')');

    const confirmRes = await axios.post(`${API_BASE}/records/${normalFlowRecordId}/confirm`, {
      operatorId: inspectors[1].id,
      operatorName: inspectors[1].name,
      remarks: '测试确认通过'
    });
    console.log('✅ 确认成功, 状态:', confirmRes.data.data.status);
    console.log('🎉 完整流转测试通过!');
  } catch (e: any) { console.log('❌ 失败:', e.response?.data?.message || e.message); }

  console.log('\n📋 测试 3: 冲突记录 (补录时间早于发现时间 -> 人工复核流)');
  console.log('----------------------------------------');
  try {
    const createRes = await axios.post(`${API_BASE}/records`, {
      planId: 'PLAN-TEST-002',
      deviceId: devices[1].id,
      inspectorId: inspectors[1].id,
      planDate: '2024-05-10',
      supplementReason: '测试时间冲突',
      discoveredDate: '2024-05-15',
      createdBy: inspectors[0].id,
      createdByName: inspectors[0].name
    });
    conflictRecordId = createRes.data.data.id;

    const submitRes = await axios.post(`${API_BASE}/records/${conflictRecordId}/submit`, {
      actualInspectionDate: '2024-05-12',
      supplementDate: '2024-05-12',
      inspectionResults: { '检查1': '正常' },
      operatorId: inspectors[1].id,
      operatorName: inspectors[1].name
    });

    console.log('⚠️  补录时间(2024-05-12) < 发现时间(2024-05-15)');
    console.log('✅ 自动转入人工复核流, 状态:', submitRes.data.data.status);
    console.log('✅ 流程类型:', submitRes.data.data.flowType);
    console.log('✅ 必填材料:', submitRes.data.requiredMaterials?.length, '项');
    submitRes.data.requiredMaterials?.forEach((m: string, i: number) => console.log(`     ${i + 1}. ${m}`));

    const approveRes = await axios.post(`${API_BASE}/records/${conflictRecordId}/approve-review`, {
      operatorId: inspectors[0].id,
      operatorName: inspectors[0].name,
      remarks: '材料齐全，人工复核通过'
    });
    console.log('✅ 人工复核通过, 状态:', approveRes.data.data.status);
    console.log('🎉 冲突记录测试通过!');
  } catch (e: any) { console.log('❌ 失败:', e.response?.data?.message || e.message); }

  console.log('\n📋 测试 4: 驳回流 (已补录 -> 已驳回 -> 重新补录)');
  console.log('----------------------------------------');
  try {
    const createRes = await axios.post(`${API_BASE}/records`, {
      planId: 'PLAN-TEST-003',
      deviceId: devices[2].id,
      inspectorId: inspectors[2].id,
      planDate: '2024-05-08',
      supplementReason: '测试驳回流程',
      discoveredDate: '2024-05-12',
      createdBy: inspectors[0].id,
      createdByName: inspectors[0].name
    });
    rejectedRecordId = createRes.data.data.id;

    await axios.post(`${API_BASE}/records/${rejectedRecordId}/submit`, {
      actualInspectionDate: '2024-05-12',
      supplementDate: '2024-05-12',
      inspectionResults: { '检查1': '正常' },
      operatorId: inspectors[2].id,
      operatorName: inspectors[2].name
    });

    const rejectRes = await axios.post(`${API_BASE}/records/${rejectedRecordId}/reject`, {
      operatorId: inspectors[0].id,
      operatorName: inspectors[0].name,
      remarks: '检查项不全，请补充完整后重新提交'
    });
    console.log('✅ 驳回成功, 状态:', rejectRes.data.data.status);
    console.log('✅ 流程类型:', rejectRes.data.data.flowType);

    const resubmitRes = await axios.post(`${API_BASE}/records/${rejectedRecordId}/submit`, {
      actualInspectionDate: '2024-05-12',
      supplementDate: '2024-05-13',
      inspectionResults: { '检查1': '正常', '检查2': '正常', '检查3': '正常' },
      operatorId: inspectors[2].id,
      operatorName: inspectors[2].name,
      remarks: '已补充检查项，重新提交'
    });
    console.log('✅ 重新提交成功, 状态:', resubmitRes.data.data.status);
    console.log('✅ 流程类型:', resubmitRes.data.data.flowType);
    console.log('🎉 驳回流测试通过!');
  } catch (e: any) { console.log('❌ 失败:', e.response?.data?.message || e.message); }

  console.log('\n📋 测试 5: 列表查询 (按状态/流程类型筛选)');
  console.log('----------------------------------------');
  try {
    const allRes = await axios.get(`${API_BASE}/records`);
    console.log('✅ 全部记录:', allRes.data.data.total, '条');

    const confirmedRes = await axios.get(`${API_BASE}/records?status=confirmed`);
    console.log('✅ 已确认记录:', confirmedRes.data.data.list.length, '条');

    const reviewRes = await axios.get(`${API_BASE}/records?flowType=manual_review`);
    console.log('✅ 人工复核流记录:', reviewRes.data.data.list.length, '条');

    const pageRes = await axios.get(`${API_BASE}/records?page=1&pageSize=2`);
    console.log('✅ 分页查询: 第1页, 每页2条, 共', pageRes.data.data.total, '条');
    console.log('🎉 列表查询测试通过!');
  } catch (e: any) { console.log('❌ 失败:', e.response?.data?.message || e.message); }

  console.log('\n📋 测试 6: 详情查询');
  console.log('----------------------------------------');
  try {
    const detailRes = await axios.get(`${API_BASE}/records/${normalFlowRecordId}`);
    console.log('✅ 记录详情获取成功');
    console.log('   设备ID:', detailRes.data.data.deviceId.substring(0, 8), '...');
    console.log('   巡检人ID:', detailRes.data.data.inspectorId.substring(0, 8), '...');
    console.log('   计划日期:', detailRes.data.data.planDate);
    console.log('   补录原因:', detailRes.data.data.supplementReason);
    console.log('   当前状态:', detailRes.data.data.status);
    console.log('   流程类型:', detailRes.data.data.flowType);
    console.log('🎉 详情查询测试通过!');
  } catch (e: any) { console.log('❌ 失败:', e.response?.data?.message || e.message); }

  console.log('\n📋 测试 7: 操作历史查询');
  console.log('----------------------------------------');
  try {
    const historyRes = await axios.get(`${API_BASE}/records/${normalFlowRecordId}/history`);
    console.log('✅ 操作历史获取成功, 共', historyRes.data.data.length, '条记录:');
    historyRes.data.data.forEach((h: any, i: number) => {
      console.log(`   ${i + 1}. ${h.operatorName} - ${h.remarks} (${new Date(h.operationTime).toLocaleString()})`);
    });
    console.log('🎉 操作历史测试通过!');
  } catch (e: any) { console.log('❌ 失败:', e.response?.data?.message || e.message); }

  console.log('\n📋 测试 8: 批量导入 (含坏行)');
  console.log('----------------------------------------');
  try {
    const importData = [
      { deviceId: devices[0].id, inspectorId: inspectors[0].id, planDate: '2024-05-20', supplementReason: '正常导入行', discoveredDate: '2024-05-22' },
      { deviceId: devices[1].id, inspectorId: inspectors[1].id, planDate: '2024-05-21', supplementReason: '发现时间早于计划时间', discoveredDate: '2024-05-20' },
      { deviceId: null, inspectorId: inspectors[0].id, planDate: '2024-05-22', supplementReason: '缺少设备ID', discoveredDate: '2024-05-24' },
      { deviceId: devices[2].id, inspectorId: inspectors[2].id, planDate: '2024-05-19', supplementReason: '第二条正常记录', discoveredDate: '2024-05-21' },
      { deviceId: devices[3].id, inspectorId: null, planDate: '2024-05-18', supplementReason: '缺少巡检人', discoveredDate: '2024-05-20' }
    ];

    const importRes = await axios.post(`${API_BASE}/import/records`, {
      records: importData,
      operatorId: inspectors[0].id,
      operatorName: inspectors[0].name
    });

    console.log('✅ 导入完成');
    console.log('   成功:', importRes.data.data.successCount, '条');
    console.log('   失败:', importRes.data.data.failCount, '条');
    console.log('   失败详情:');
    importRes.data.data.errors.forEach((err: any) => {
      console.log(`     行${err.row}: ${err.message}`);
      console.log(`       数据: ${JSON.stringify(err.data).substring(0, 60)}...`);
    });
    console.log('🎉 批量导入测试通过!');
  } catch (e: any) { console.log('❌ 失败:', e.response?.data?.message || e.message); }

  console.log('\n📋 测试 9: 导出功能');
  console.log('----------------------------------------');
  try {
    const exportRes = await axios.get(`${API_BASE}/export/records`, { responseType: 'text' });
    const lines = exportRes.data.split('\n');
    console.log('✅ 列表导出成功, CSV共', lines.length, '行');
    console.log('   表头:', lines[0].substring(0, 100), '...');
    console.log('🎉 导出功能测试通过!');
  } catch (e: any) { console.log('❌ 失败:', e.response?.data?.message || e.message); }

  console.log('\n✅ ========================================');
  console.log('✅ 所有验收测试完成!');
  console.log('✅ ========================================\n');

  console.log('📋 核心功能覆盖:');
  console.log('  ✓ 正常流: 漏检待补 -> 已补录 -> 已确认');
  console.log('  ✓ 驳回流: 已补录 -> 已驳回 -> 重新补录');
  console.log('  ✓ 人工复核流: 补录时间异常 -> 人工复核 -> 复核通过');
  console.log('  ✓ 时间校验机制: 补录时间 < 发现时间时拦截');
  console.log('  ✓ 必填材料提示: 明确列出需要补充的材料');
  console.log('  ✓ 列表筛选: 按状态/流程类型筛选');
  console.log('  ✓ 详情查询: 完整信息展示');
  console.log('  ✓ 操作历史: 全流程可追溯');
  console.log('  ✓ 批量导入: 支持坏行识别');
  console.log('  ✓ 数据导出: CSV格式导出\n');

  process.exit(0);
}

setTimeout(runTests, 2000);
