const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runWorkflowTest() {
  try {
    console.log('=== 医院床旁设备巡检 API 完整流程测试 ===\n');
    let bedId, deviceId, backupDeviceId, faultId;

    // 1. 创建床位
    console.log('1. 创建床位...');
    const bedRes = await axios.post(`${API_BASE}/beds`, {
      bed_number: 'ICU-001',
      ward: 'ICU',
      floor: 5,
      status: 'active'
    });
    bedId = bedRes.data.data.id;
    console.log('   床位创建成功:', bedRes.data.data);

    // 2. 创建设备
    console.log('\n2. 创建在用设备...');
    const deviceRes = await axios.post(`${API_BASE}/devices`, {
      device_code: 'MON-001',
      device_name: '监护仪',
      device_type: 'monitor',
      model: 'PM-8000',
      manufacturer: '迈瑞',
      purchase_date: '2023-01-15',
      status: 'in_use',
      current_bed_id: bedId,
      is_backup: false
    });
    deviceId = deviceRes.data.data.id;
    console.log('   设备创建成功:', deviceRes.data.data);

    // 3. 创建备用机
    console.log('\n3. 创建备用机...');
    const backupRes = await axios.post(`${API_BASE}/devices`, {
      device_code: 'MON-BACKUP-001',
      device_name: '监护仪(备用)',
      device_type: 'monitor',
      model: 'PM-8000',
      manufacturer: '迈瑞',
      purchase_date: '2023-02-20',
      status: 'in_storage',
      current_bed_id: null,
      is_backup: true
    });
    backupDeviceId = backupRes.data.data.id;
    console.log('   备用机创建成功:', backupRes.data.data);

    await sleep(500);

    // 4. 巡检发现故障
    console.log('\n4. 巡检设备...');
    const inspectionRes = await axios.post(`${API_BASE}/inspections`, {
      request_id: `inspect-${Date.now()}`,
      bed_id: bedId,
      device_id: deviceId,
      inspector_id: 'nurse-001',
      inspector_name: '张护士',
      inspection_time: new Date().toISOString(),
      status: 'faulty',
      remarks: '屏幕显示异常，需要维修'
    });
    console.log('   巡检记录创建成功:', inspectionRes.data.data);

    // 5. 上报故障
    console.log('\n5. 上报设备故障...');
    const faultRes = await axios.post(`${API_BASE}/faults`, {
      request_id: `fault-${Date.now()}`,
      device_id: deviceId,
      bed_id: bedId,
      reporter_id: 'nurse-001',
      reporter_name: '张护士',
      report_time: new Date().toISOString(),
      fault_type: 'display',
      description: '屏幕闪烁，无法正常显示数据',
      severity: 'high'
    });
    faultId = faultRes.data.data.id;
    console.log('   故障上报成功:', faultRes.data.data);

    await sleep(500);

    // 6. 验证设备状态已变更为故障
    console.log('\n6. 验证故障设备状态...');
    const deviceCheckRes = await axios.get(`${API_BASE}/devices/${deviceId}`);
    console.log('   设备当前状态:', deviceCheckRes.data.data.status);

    // 7. 更换备用机
    console.log('\n7. 更换备用机...');
    const replaceRes = await axios.post(`${API_BASE}/faults/${faultId}/replace-device`, {
      request_id: `replace-${Date.now()}`,
      replacement_device_id: backupDeviceId,
      operator_id: 'tech-001',
      operator_name: '王工程师',
      operation_time: new Date().toISOString(),
      original_device_destination: '设备科维修'
    });
    console.log('   设备更换成功:', replaceRes.data.data);

    await sleep(500);

    // 8. 验证原设备状态（消毒中）
    console.log('\n8. 验证原设备状态（消毒中）...');
    const originalDeviceRes = await axios.get(`${API_BASE}/devices/${deviceId}`);
    console.log('   原设备状态:', originalDeviceRes.data.data.status);
    console.log('   原设备床位:', originalDeviceRes.data.data.current_bed_id);

    // 9. 验证新设备状态（在用）
    console.log('\n9. 验证新设备状态（在用）...');
    const newDeviceRes = await axios.get(`${API_BASE}/devices/${backupDeviceId}`);
    console.log('   新设备状态:', newDeviceRes.data.data.status);
    console.log('   新设备床位:', newDeviceRes.data.data.current_bed_id);
    console.log('   新设备是否备用:', newDeviceRes.data.data.is_backup ? '是' : '否');

    await sleep(500);

    // 10. 消毒原设备
    console.log('\n10. 消毒原设备...');
    const disinfectionRes = await axios.post(`${API_BASE}/disinfection`, {
      request_id: `disinf-${Date.now()}`,
      device_id: deviceId,
      operator_id: 'tech-001',
      operator_name: '王工程师',
      disinfection_time: new Date().toISOString(),
      disinfection_method: '紫外线消毒'
    });
    console.log('   消毒记录创建成功:', disinfectionRes.data.data);

    await sleep(500);

    // 11. 验证消毒后设备状态
    console.log('\n11. 验证消毒后设备状态...');
    const disinfectedDeviceRes = await axios.get(`${API_BASE}/devices/${deviceId}`);
    console.log('   消毒后设备状态:', disinfectedDeviceRes.data.data.status);

    // 12. 恢复设备入库为备用机
    console.log('\n12. 恢复设备入库为备用机...');
    const recoveryRes = await axios.post(`${API_BASE}/recoveries`, {
      request_id: `recov-${Date.now()}`,
      device_id: deviceId,
      operator_id: 'tech-001',
      operator_name: '王工程师',
      recovery_time: new Date().toISOString(),
      remarks: '维修完成，恢复为备用机'
    });
    console.log('   恢复入库成功:', recoveryRes.data.data);

    await sleep(500);

    // 13. 验证恢复后设备状态
    console.log('\n13. 验证恢复后设备状态...');
    const recoveredDeviceRes = await axios.get(`${API_BASE}/devices/${deviceId}`);
    console.log('   恢复后设备状态:', recoveredDeviceRes.data.data.status);
    console.log('   恢复后是否备用:', recoveredDeviceRes.data.data.is_backup ? '是' : '否');

    // 14. 测试防重复提交
    console.log('\n14. 测试防重复提交...');
    const inspectionRequestId = JSON.parse(inspectionRes.config.data).request_id;
    try {
      await axios.post(`${API_BASE}/inspections`, {
        request_id: inspectionRequestId,
        bed_id: bedId,
        device_id: deviceId,
        inspector_id: 'nurse-001',
        inspector_name: '张护士',
        inspection_time: new Date().toISOString(),
        status: 'normal'
      });
      console.log('   错误: 重复提交未被拦截');
    } catch (err) {
      console.log('   正确拦截了重复提交:', err.response.data.message);
    }

    // 15. 查看操作历史
    console.log('\n15. 查看设备操作历史...');
    const historyRes = await axios.get(`${API_BASE}/history?device_id=${deviceId}`);
    console.log('   操作历史记录数:', historyRes.data.data.length);
    historyRes.data.data.forEach((h, i) => {
      console.log(`     ${i+1}. ${h.operation_type} - ${h.operator_name}`);
    });

    console.log('\n=== 测试完成！');

  } catch (err) {
    console.error('测试失败:', err.response?.data || err.message);
    if (err.response?.data) {
      console.error('错误详情:', err.response.data);
    }
  }
}

runWorkflowTest();
