const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const PermissionService = require('../services/permissionService');

const dbPath = path.join(__dirname, '../../data/database.db');
const db = new sqlite3.Database(dbPath);

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function demo() {
  console.log('='.repeat(60));
  console.log('🎬 课程直播回放授权系统 - 功能演示');
  console.log('='.repeat(60));
  
  const permissionService = new PermissionService(db);
  
  try {
    const firstClass = await getAsync(`SELECT * FROM classes LIMIT 1`);
    const firstStudent = await getAsync(`SELECT * FROM students LIMIT 1`);
    const firstSession = await getAsync(`SELECT * FROM live_sessions WHERE class_id = ? LIMIT 1`, [firstClass.id]);
    
    console.log('\n📊 初始数据概览:');
    console.log(`  班级: ${firstClass.name}`);
    console.log(`  学员: ${firstStudent.name}`);
    console.log(`  直播场次: ${firstSession.title}`);
    
    const enrollment = await getAsync(
      `SELECT * FROM class_enrollments WHERE class_id = ? AND student_id = ?`,
      [firstClass.id, firstStudent.id]
    );
    console.log(`  报名状态: ${enrollment ? '已报名' : '未报名'}`);
    
    console.log('\n' + '-'.repeat(60));
    console.log('🔐 演示1: 访问权限检查');
    console.log('-'.repeat(60));
    
    const accessResult = await permissionService.checkAccess(
      firstStudent.id,
      firstStudent.phone,
      firstSession.id
    );
    console.log(`  访问结果: ${accessResult.allowed ? '✅ 允许访问' : '❌ 拒绝访问'}`);
    if (!accessResult.allowed) {
      console.log(`  拒绝原因: ${accessResult.reason}`);
    }
    
    console.log('\n' + '-'.repeat(60));
    console.log('🔄 演示2: 学员转班流程');
    console.log('-'.repeat(60));
    
    const targetClass = await getAsync(`SELECT * FROM classes WHERE id != ? LIMIT 1`, [firstClass.id]);
    console.log(`  原班级: ${firstClass.name}`);
    console.log(`  目标班级: ${targetClass.name}`);
    
    const oldPermissions = await allAsync(
      `SELECT * FROM replay_permissions WHERE student_id = ? AND class_id = ?`,
      [firstStudent.id, firstClass.id]
    );
    console.log(`  转班前权限数量: ${oldPermissions.length}`);
    
    const transferResult = await permissionService.transferStudent(
      enrollment.id,
      targetClass.id,
      '教务管理员'
    );
    
    console.log(`  ✅ 转班完成！`);
    console.log(`  旧班级权限回收: ${transferResult.oldPermissionsRevoked} 个`);
    console.log(`  新班级权限授予: ${transferResult.newPermissionsGranted} 个`);
    
    const newPermissions = await allAsync(
      `SELECT * FROM replay_permissions WHERE student_id = ? AND class_id = ? AND status = 'active'`,
      [firstStudent.id, targetClass.id]
    );
    console.log(`  转班后新班级权限数量: ${newPermissions.length}`);
    
    console.log('\n' + '-'.repeat(60));
    console.log('💰 演示3: 学员退费权限回收');
    console.log('-'.repeat(60));
    
    const refundStudent = await getAsync(`SELECT * FROM students WHERE id != ? LIMIT 1`, [firstStudent.id]);
    const refundEnrollment = await getAsync(
      `SELECT * FROM class_enrollments WHERE student_id = ? AND status = 'active' LIMIT 1`,
      [refundStudent.id]
    );
    
    if (refundEnrollment) {
      const beforeRefundPerms = await allAsync(
        `SELECT * FROM replay_permissions WHERE enrollment_id = ? AND status = 'active'`,
        [refundEnrollment.id]
      );
      console.log(`  退费学员: ${refundStudent.name}`);
      console.log(`  退费前活跃权限: ${beforeRefundPerms.length} 个`);
      
      const refundResult = await permissionService.processRefund(
        refundEnrollment.id,
        '教务管理员'
      );
      
      console.log(`  ✅ 退费完成！`);
      console.log(`  回收权限数量: ${refundResult.permissionsRevoked} 个`);
      console.log(`  报名状态更新为: ${refundResult.enrollment.status}`);
      
      const afterRefundAccess = await permissionService.checkAccess(
        refundStudent.id,
        refundStudent.phone,
        firstSession.id
      );
      console.log(`  退费后访问尝试: ${afterRefundAccess.allowed ? '允许' : '拒绝'}`);
    }
    
    console.log('\n' + '-'.repeat(60));
    console.log('⚠️  演示4: 异常检测功能');
    console.log('-'.repeat(60));
    
    const anomalies = await permissionService.detectAnomalies();
    console.log(`  检测到异常数量: ${anomalies.length}`);
    
    const anomalyTypes = {};
    anomalies.forEach(a => {
      anomalyTypes[a.type] = (anomalyTypes[a.type] || 0) + 1;
    });
    
    Object.entries(anomalyTypes).forEach(([type, count]) => {
      console.log(`    - ${type}: ${count} 个`);
    });
    
    console.log('\n' + '-'.repeat(60));
    console.log('📝 演示5: 操作历史记录');
    console.log('-'.repeat(60));
    
    const events = await allAsync(
      `SELECT * FROM business_events ORDER BY created_at DESC LIMIT 10`
    );
    console.log(`  最近操作记录 (共${events.length}条):`);
    events.forEach((e, i) => {
      console.log(`    ${i + 1}. [${e.event_type}] ${e.description}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有功能演示完成！');
    console.log('='.repeat(60));
    console.log('\n📋 关键功能总结:');
    console.log('  ✅ 权限自动授予与回收');
    console.log('  ✅ 转班时权限无缝迁移');
    console.log('  ✅ 退费后立即回收权限');
    console.log('  ✅ 多维度异常检测');
    console.log('  ✅ 完整操作审计日志');
    console.log('  ✅ 重复操作幂等性保护');
    
  } catch (error) {
    console.error('演示过程出错:', error);
  } finally {
    db.close();
  }
}

demo();
