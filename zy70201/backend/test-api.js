const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testAPI() {
  console.log('='.repeat(60));
  console.log('滑雪场压雪排程台 API 测试');
  console.log('='.repeat(60));
  
  await delay(500);
  await testHealthCheck();
  
  await delay(500);
  await testGetSlopes();
  
  await delay(500);
  await testGetSlopesNeedingGrooming();
  
  await delay(500);
  await testCreateTaskDuringOpenWindow();
  
  await delay(500);
  await testCreateValidTask();
  
  await delay(500);
  await testAutoSchedule();
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testHealthCheck() {
  try {
    const res = await axios.get('http://localhost:3000/health');
    console.log('\n✅ 健康检查通过');
    console.log('   状态:', res.data);
  } catch (error) {
    console.log('\n❌ 健康检查失败:', error.message);
  }
}

async function testGetSlopes() {
  try {
    const res = await axios.get(`${API_BASE}/slopes`);
    const slopes = res.data.data;
    console.log('\n✅ 获取雪道列表成功');
    console.log(`   共 ${slopes.length} 条雪道：`);
    
    slopes.forEach(s => {
      const needsGrooming = s.currentSnowThickness < s.minSnowThickness;
      console.log(`   - ${s.name}: 当前${s.currentSnowThickness}cm, 最小要求${s.minSnowThickness}cm ${needsGrooming ? '[需要压雪]' : '[达标]'}`);
    });
  } catch (error) {
    console.log('\n❌ 获取雪道列表失败:', error.response?.data?.message || error.message);
  }
}

async function testGetSlopesNeedingGrooming() {
  try {
    const res = await axios.get(`${API_BASE}/slopes/needing-grooming`);
    const slopes = res.data.data;
    console.log('\n✅ 获取需要压雪的雪道');
    console.log(`   共 ${slopes.length} 条雪道需要压雪`);
    
    slopes.forEach(s => {
      console.log(`   - ${s.name}: 当前${s.currentSnowThickness}cm < 最小${s.minSnowThickness}cm`);
    });
  } catch (error) {
    console.log('\n❌ 获取需要压雪的雪道失败:', error.response?.data?.message || error.message);
  }
}

async function testCreateTaskDuringOpenWindow() {
  console.log('\n🔍 测试：创建任务（应该失败 - 在开放窗口内）');
  
  try {
    const slopesRes = await axios.get(`${API_BASE}/slopes`);
    const slope = slopesRes.data.data[0];
    
    const taskDate = new Date();
    taskDate.setHours(10, 0, 0, 0);
    if (taskDate <= new Date()) {
      taskDate.setDate(taskDate.getDate() + 1);
    }
    const endDate = new Date(taskDate.getTime() + 2 * 60 * 60 * 1000);
    
    await axios.post(`${API_BASE}/tasks`, {
      slopeId: slope.id,
      scheduledStartTime: taskDate.toISOString(),
      scheduledEndTime: endDate.toISOString()
    });
    
    console.log('   ❌ 错误：应该失败但成功了');
  } catch (error) {
    if (error.response?.data?.message?.includes('开放时间')) {
      console.log('   ✅ 正确拒绝了在开放窗口内的任务');
      console.log('   错误信息:', error.response.data.message);
    } else {
      console.log('   ❌ 出现其他错误:', error.response?.data?.message || error.message);
    }
  }
}

async function testCreateValidTask() {
  console.log('\n🔍 测试：创建任务（应该成功 - 在夜间作业窗口）');
  
  try {
    const slopesRes = await axios.get(`${API_BASE}/slopes`);
    const slope = slopesRes.data.data[0];
    
    const taskDate = new Date();
    taskDate.setHours(22, 0, 0, 0);
    if (taskDate <= new Date()) {
      taskDate.setDate(taskDate.getDate() + 1);
    }
    const endDate = new Date(taskDate.getTime() + 2 * 60 * 60 * 1000);
    
    const res = await axios.post(`${API_BASE}/tasks`, {
      slopeId: slope.id,
      scheduledStartTime: taskDate.toISOString(),
      scheduledEndTime: endDate.toISOString(),
      notes: 'API测试创建的任务'
    });
    
    console.log('   ✅ 任务创建成功');
    console.log('   任务ID:', res.data.data.id);
    console.log('   状态:', res.data.data.status);
    console.log('   雪道:', res.data.data.slope?.name);
  } catch (error) {
    console.log('   ❌ 创建失败:', error.response?.data?.message || error.message);
  }
}

async function testAutoSchedule() {
  console.log('\n🔍 测试：自动排程');
  
  try {
    const res = await axios.post(`${API_BASE}/tasks/auto-schedule`);
    const results = res.data.data;
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    console.log(`   ✅ 自动排程完成`);
    console.log(`   成功: ${successCount} 条`);
    console.log(`   失败: ${failCount} 条`);
    
    results.forEach((r, i) => {
      if (r.success) {
        console.log(`   [${i+1}] ${r.slopeName} → ${r.vehicleName} (预计${r.estimatedHours}小时)`);
      } else {
        console.log(`   [${i+1}] ${r.slopeName} → 失败: ${r.message}`);
      }
    });
  } catch (error) {
    console.log('   ❌ 自动排程失败:', error.response?.data?.message || error.message);
  }
}

testAPI().catch(console.error);
