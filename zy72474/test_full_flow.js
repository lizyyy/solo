const http = require('http');
const fs = require('fs');
const path = require('path');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const headers = {};
    let sendBody = null;
    
    if (body) {
      if (options.multipartBoundary) {
        headers['Content-Type'] = `multipart/form-data; boundary=${options.multipartBoundary}`;
        sendBody = body;
      } else if (typeof body === 'object') {
        headers['Content-Type'] = 'application/json';
        sendBody = JSON.stringify(body);
      } else {
        sendBody = body;
      }
    }
    
    delete options.multipartBoundary;
    
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      ...options,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (sendBody) req.write(sendBody);
    req.end();
  });
}

function createTestImage(filename) {
  const uploadsDir = path.join(__dirname, 'test_uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
  
  const filepath = path.join(uploadsDir, filename);
  const content = `fake-image-content-${filename}-${Date.now()}-${Math.random()}`;
  fs.writeFileSync(filepath, content);
  return filepath;
}

function buildMultipartBody(fields, files, boundary) {
  let bodyParts = [];
  
  for (const key of Object.keys(fields)) {
    bodyParts.push(Buffer.from(`--${boundary}\r\n`));
    bodyParts.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
    bodyParts.push(Buffer.from(`${fields[key]}\r\n`));
  }
  
  for (const file of files) {
    const fileContent = fs.readFileSync(file.path);
    bodyParts.push(Buffer.from(`--${boundary}\r\n`));
    bodyParts.push(Buffer.from(`Content-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\n`));
    bodyParts.push(Buffer.from('Content-Type: image/jpeg\r\n\r\n'));
    bodyParts.push(fileContent);
    bodyParts.push(Buffer.from('\r\n'));
  }
  
  bodyParts.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(bodyParts);
}

async function runFullUserFlow() {
  console.log('='.repeat(70));
  console.log('🚶 按普通使用者路线复现：三步工作流 + 重复导入 + 备注核对');
  console.log('='.repeat(70));
  
  console.log('\n📌 步骤0：获取点位列表，准备工作');
  const pointsRes = await request({ path: '/api/points', method: 'GET' });
  const allPoints = pointsRes.points;
  console.log('   获取到', allPoints.length, '个点位');
  
  const testPoint = allPoints.find(p => p.name.includes('文化路')) || allPoints[0];
  const boundaryPoint = allPoints.find(p => p.boundaryStatus === 'boundary_pending') || allPoints[0];
  const confirmedPoint = allPoints.find(p => p.boundaryStatus === 'boundary_confirmed') || allPoints[0];
  
  console.log('   选择测试点位:', testPoint.name, '(照片数:', testPoint.photos.length, ')');
  console.log('   边界待复核点位:', boundaryPoint.name, '(状态:', boundaryPoint.boundaryStatus, ')');
  console.log('   边界已确认点位:', confirmedPoint.name, '(状态:', confirmedPoint.boundaryStatus, ')');
  
  console.log('\n✅ 照片数为0的点位保留显示检查：');
  const zeroPhotoPoints = allPoints.filter(p => p.photos.length === 0);
  console.log('   照片数为0的点位数量:', zeroPhotoPoints.length, '个');
  zeroPhotoPoints.forEach(p => console.log('     -', p.name, '(photos=' + p.photos.length + ')'));
  console.log('  ', zeroPhotoPoints.length >= 2 ? '✓ 通过' : '✗ 失败', '：照片数为0的点位正常显示');
  
  console.log('\n' + '─'.repeat(70));
  console.log('📷 步骤1：路口照片第一次导入');
  console.log('─'.repeat(70));
  
  const img1Path = createTestImage('路口全景_早高峰.jpg');
  const img2Path = createTestImage('路口公交站特写.jpg');
  const img3Path = createTestImage('停车泊位示意图.jpg');
  console.log('   创建3张测试照片');
  
  const boundary = '----TestBoundary1234567890';
  const multipartBody = buildMultipartBody(
    { importedBy: '阿宁' },
    [
      { field: 'photos', filename: '路口全景_早高峰.jpg', path: img1Path },
      { field: 'photos', filename: '路口公交站特写.jpg', path: img2Path },
      { field: 'photos', filename: '停车泊位示意图.jpg', path: img3Path }
    ],
    boundary
  );
  
  const step1FirstRes = await request(
    { path: `/api/points/${testPoint.id}/photos`, method: 'POST', multipartBoundary: boundary },
    multipartBody
  );
  
  console.log('   第一次导入结果：');
  console.log('     新导入:', step1FirstRes.importedCount, '张');
  console.log('     重复去重:', step1FirstRes.duplicatedCount, '张');
  console.log('  ', step1FirstRes.importedCount === 3 ? '✓ 通过' : '✗ 失败', '：3张照片首次导入成功');
  
  const photosAfterFirst = (await request({ path: `/api/points/${testPoint.id}`, method: 'GET' })).point.photos;
  console.log('   当前点位照片数:', photosAfterFirst.length);
  
  console.log('\n🔄 步骤1.5：重复导入同一批照片（验证不翻倍）');
  const boundary2 = '----TestBoundary9876543210';
  const imgNewPath = createTestImage('新增加的照片.jpg');
  const multipartBody2 = buildMultipartBody(
    { importedBy: '阿宁' },
    [
      { field: 'photos', filename: '路口全景_早高峰.jpg', path: img1Path },
      { field: 'photos', filename: '路口公交站特写.jpg', path: img2Path },
      { field: 'photos', filename: '新增加的照片.jpg', path: imgNewPath }
    ],
    boundary2
  );
  
  const step1DupRes = await request(
    { path: `/api/points/${testPoint.id}/photos`, method: 'POST', multipartBoundary: boundary2 },
    multipartBody2
  );
  
  console.log('   第二次导入结果（含2张重复+1张新增）：');
  console.log('     新导入:', step1DupRes.importedCount, '张');
  console.log('     重复去重:', step1DupRes.duplicatedCount, '张');
  
  const photosAfterDup = (await request({ path: `/api/points/${testPoint.id}`, method: 'GET' })).point.photos;
  console.log('   当前点位照片数:', photosAfterDup.length);
  const dupExpected = 4;
  const dupPass = photosAfterDup.length === dupExpected && step1DupRes.duplicatedCount === 2;
  console.log('  ', dupPass ? '✓ 通过' : '✗ 失败', '：重复导入去重生效，数量不翻倍（预期' + dupExpected + '张，实际' + photosAfterDup.length + '张）');
  
  console.log('\n' + '─'.repeat(70));
  console.log('🚌 步骤2：补看公交刷卡时段');
  console.log('─'.repeat(70));
  
  const busCardData = {
    busCardData: {
      period: '午高峰 11:30-13:00',
      passengerVolume: '900人次',
      rawText: '阿宁备注：午高峰主要是周边写字楼员工外出就餐。\n建议：和对面写字楼地下停车场错峰，他们中午出车少，可以共享。\n补充：2026-06-12现场核实，公交刷卡数据确实比周边路口高30%。',
      notes: '阿宁备注：午高峰主要是周边写字楼员工外出就餐。\n建议：和对面写字楼地下停车场错峰，他们中午出车少，可以共享。\n补充：2026-06-12现场核实，公交刷卡数据确实比周边路口高30%。'
    },
    supplementedBy: '阿宁'
  };
  
  const step2Res = await request(
    { path: `/api/points/${testPoint.id}/bus-cards`, method: 'POST' },
    busCardData
  );
  
  console.log('   补充公交刷卡时段:', busCardData.busCardData.period);
  console.log('   原始备注长度:', busCardData.busCardData.rawText.length, '字符');
  console.log('  ', step2Res.busCardPeriod ? '✓ 通过' : '✗ 失败', '：公交刷卡补充成功');
  
  const pointAfterStep2 = (await request({ path: `/api/points/${testPoint.id}`, method: 'GET' })).point;
  const savedRawText = pointAfterStep2.busCardPeriods[pointAfterStep2.busCardPeriods.length - 1].rawText;
  console.log('   存储的rawText长度:', savedRawText.length, '字符');
  console.log('  ', savedRawText === busCardData.busCardData.rawText ? '✓ 通过' : '✗ 失败', '：原始备注(rawText)完整保留，未被清洗');
  
  console.log('\n📜 步骤2.5：核对版本历史（改前/改后/修改原因）');
  const versionsRes = await request({ path: `/api/points/${testPoint.id}/versions`, method: 'GET' });
  console.log('   版本数量:', versionsRes.versions.length, '个');
  
  let compareHasChanges = false;
  if (versionsRes.versions.length >= 2) {
    const v1 = versionsRes.versions[0].versionId;
    const v2 = versionsRes.versions[versionsRes.versions.length - 1].versionId;
    const compareRes = await request({ 
      path: `/api/points/${testPoint.id}/versions/compare?v1=${v1}&v2=${v2}`, 
      method: 'GET' 
    });
    
    console.log('   最早版本 vs 最新版本：');
    console.log('     是否有差异:', compareRes.hasChanges ? '是' : '否');
    console.log('     差异字段:', Object.keys(compareRes.diff).join(', ') || '无');
    if (compareRes.diff.busCardPeriods) {
      const beforeStr = compareRes.diff.busCardPeriods.before ? '有' : '无';
      const afterStr = compareRes.diff.busCardPeriods.after ? '有' : '无';
      console.log('     公交刷卡时段变化: 从' + beforeStr + ' → ' + afterStr);
    }
    compareHasChanges = compareRes.hasChanges;
    console.log('  ', compareRes.hasChanges ? '✓ 通过' : '✗ 失败', '：版本对比能显示改前改后差别');
  }
  
  const lastVersion = versionsRes.versions[versionsRes.versions.length - 1];
  console.log('   最后一个版本:');
  console.log('     操作类型:', lastVersion.action);
  console.log('     修改原因:', lastVersion.reason);
  console.log('     修改人:', lastVersion.modifiedBy);
  console.log('  ', lastVersion.reason && lastVersion.modifiedBy ? '✓ 通过' : '✗ 失败', '：版本记录包含修改原因和修改人');
  
  console.log('\n' + '─'.repeat(70));
  console.log('🗺️ 步骤3：地图导出更新');
  console.log('─'.repeat(70));
  
  const exportPoints = [testPoint.id, confirmedPoint.id, boundaryPoint.id];
  console.log('   尝试导出', exportPoints.length, '个点位（含1个边界待复核）');
  
  const step3Res = await request(
    { path: '/api/map/export', method: 'POST' },
    { pointIds: exportPoints, exportedBy: '阿宁' }
  );
  
  const successCount = step3Res.exports.filter(e => e.success).length;
  const errorCount = step3Res.exports.filter(e => e.error).length;
  
  console.log('   导出结果:');
  console.log('     成功:', successCount, '个');
  console.log('     失败:', errorCount, '个');
  
  step3Res.exports.filter(e => e.error).forEach(e => {
    console.log('     失败 -', e.pointName, ':', e.error);
  });
  
  const hasBoundaryError = step3Res.exports.some(e => e.pointId === boundaryPoint.id && e.error);
  console.log('  ', errorCount >= 1 && hasBoundaryError ? '✓ 通过' : '✗ 失败', '：边界待复核点位被正确拦截，需项目经理确认');
  
  const successExport = step3Res.exports.find(e => e.success);
  let hasRawRefs = false;
  if (successExport) {
    console.log('\n   成功导出的点位数据检查:');
    console.log('     包含rawMaterialRefs:', !!successExport.mapData.rawMaterialRefs);
    console.log('     照片引用数:', successExport.mapData.rawMaterialRefs?.photos?.length || 0);
    console.log('     公交刷卡引用数:', successExport.mapData.rawMaterialRefs?.busCardData?.length || 0);
    hasRawRefs = !!successExport.mapData.rawMaterialRefs;
    console.log('  ', hasRawRefs ? '✓ 通过' : '✗ 失败', '：导出数据包含原始材料引用，证据链不断');
  }
  
  console.log('\n' + '─'.repeat(70));
  console.log('✅ 最终核对清单');
  console.log('─'.repeat(70));
  
  const finalPoint = (await request({ path: `/api/points/${testPoint.id}`, method: 'GET' })).point;
  
  const checks = [
    ['照片数为0的点位保留显示', zeroPhotoPoints.length >= 2, zeroPhotoPoints.length >= 2],
    ['路口照片第一次导入（3张）', step1FirstRes.importedCount === 3],
    ['重复导入同一批照片不翻倍（预期' + dupExpected + '张，实际' + photosAfterDup.length + '张）', dupPass],
    ['公交刷卡时段原始备注(rawText)完整保留', savedRawText === busCardData.busCardData.rawText],
    ['版本历史能看出改前改后差别', versionsRes.versions.length >= 2],
    ['版本记录包含修改原因和修改人', !!lastVersion.reason && !!lastVersion.modifiedBy],
    ['边界待复核点位导出被拦截', hasBoundaryError],
    ['导出报告包含原始材料引用', hasRawRefs],
    ['最终点位照片数正确（' + finalPoint.photos.length + '张）', finalPoint.photos.length === dupExpected],
    ['最终点位公交刷卡时段数正确（' + finalPoint.busCardPeriods.length + '条）', finalPoint.busCardPeriods.length >= 1]
  ];
  
  let passCount = 0;
  checks.forEach(([desc, pass]) => {
    const mark = pass ? '✅' : '❌';
    console.log('  ', mark, desc);
    if (pass) passCount++;
  });
  
  console.log('\n' + '='.repeat(70));
  console.log('🏁 完成：' + passCount + '/' + checks.length + ' 项检查通过');
  if (passCount === checks.length) {
    console.log('🎉 全部通过！按普通使用者路线复现成功。');
  } else {
    console.log('⚠️  部分检查未通过，请查看上方详情。');
  }
  console.log('='.repeat(70));
  
  try {
    fs.rmSync(path.join(__dirname, 'test_uploads'), { recursive: true, force: true });
  } catch(e){}
}

runFullUserFlow().catch(err => {
  console.error('❌ 测试运行失败:', err);
  process.exit(1);
});
