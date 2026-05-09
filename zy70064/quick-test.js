const db = require('./db');
const service = require('./service');

async function quickTest() {
  console.log('═══════════════════════════════════════════════');
  console.log('🧪 快速测试：实习岗位名额锁定服务');
  console.log('（跳过超时测试，如需完整测试请运行 npm test）');
  console.log('═══════════════════════════════════════════════\n');

  await db.initDB();

  try {
    try {
      await db.runQuery('DELETE FROM audit_logs');
      await db.runQuery('DELETE FROM interviews');
      await db.runQuery('DELETE FROM locks');
      await db.runQuery('DELETE FROM positions');
      console.log('✅ 数据库已清空\n');
    } catch (e) {
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 测试1：岗位管理');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await testStep('创建岗位「字节跳动-前端开发」，名额 2 个', async () => {
      return await service.createPosition('字节跳动-前端开发', 2);
    });

    await testStep('创建岗位「阿里巴巴-后端开发」，名额 3 个', async () => {
      return await service.createPosition('阿里巴巴-后端开发', 3);
    });

    await testStep('查看所有岗位', async () => {
      const positions = await service.listPositions();
      console.log('岗位列表：');
      positions.forEach(p => {
        console.log(`  - ${p.name}: 总名额${p.total_quota}，可用${p.available_quota}`);
      });
      return { success: true, message: `共 ${positions.length} 个岗位` };
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔒 测试2：推荐锁定 - 主流程');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await testStep('计算机学院 - 张三 锁定「字节跳动-前端开发」', async () => {
      return await service.createLock('字节跳动-前端开发', '计算机学院', '张三');
    });

    await testStep('软件工程学院 - 李四 锁定「字节跳动-前端开发」', async () => {
      return await service.createLock('字节跳动-前端开发', '软件工程学院', '李四');
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚡ 测试3：名额冲突 - 边界场景');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await testStep('尝试锁定已满的「字节跳动-前端开发」（应失败）', async () => {
      try {
        await service.createLock('字节跳动-前端开发', '计算机学院', '王五');
        throw new Error('应该抛出名额已满的错误');
      } catch (err) {
        if (err.message.includes('名额已满')) {
          return { success: true, message: `✓ 正确拦截：${err.message}` };
        }
        throw err;
      }
    });

    await testStep('尝试重复锁定同一学生（应失败）', async () => {
      try {
        await service.createLock('字节跳动-前端开发', '计算机学院', '张三');
        throw new Error('应该抛出重复锁定的错误');
      } catch (err) {
        if (err.message.includes('已存在有效的推荐锁定')) {
          return { success: true, message: `✓ 正确拦截：${err.message}` };
        }
        throw err;
      }
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎤 测试4：面试流程');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await testStep('张三 - 第1轮面试通过', async () => {
      return await service.updateInterview('字节跳动-前端开发', '计算机学院', '张三', 1, 'PASSED', '基础扎实');
    });

    await testStep('李四 - 第1轮面试未通过', async () => {
      return await service.updateInterview('字节跳动-前端开发', '软件工程学院', '李四', 1, 'FAILED', '基础薄弱');
    });

    await testStep('查看岗位状态（李四被拒后名额应释放）', async () => {
      const positions = await service.listPositions();
      const bd = positions.find(p => p.name === '字节跳动-前端开发');
      console.log('「字节跳动-前端开发」状态：');
      console.log(`  总名额: ${bd.total_quota}`);
      console.log(`  可用名额: ${bd.available_quota}`);
      
      if (bd.available_quota === 1) {
        return { success: true, message: '✓ 名额正确释放（可用名额恢复为1）' };
      }
      throw new Error(`名额未正确释放，预期可用1，实际${bd.available_quota}`);
    });

    await testStep('张三 - 第2轮面试通过', async () => {
      return await service.updateInterview('字节跳动-前端开发', '计算机学院', '张三', 2, 'PASSED', '项目经验丰富');
    });

    await testStep('张三 - 第3轮面试通过', async () => {
      return await service.updateInterview('字节跳动-前端开发', '计算机学院', '张三', 3, 'PASSED', '综合表现优秀');
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 测试5：录用确认');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await testStep('确认录用张三', async () => {
      return await service.confirmAcceptance('字节跳动-前端开发', '计算机学院', '张三');
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('↩️ 测试6：撤回释放 - 撤销场景');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await testStep('计算机学院 - 王五 锁定「字节跳动-前端开发」（名额已释放）', async () => {
      return await service.createLock('字节跳动-前端开发', '计算机学院', '王五');
    });

    await testStep('查看岗位状态（锁定后）', async () => {
      const positions = await service.listPositions();
      const bd = positions.find(p => p.name === '字节跳动-前端开发');
      return { success: true, message: `可用名额: ${bd.available_quota}` };
    });

    await testStep('王五撤回推荐', async () => {
      return await service.withdrawLock('字节跳动-前端开发', '计算机学院', '王五', '学生放弃');
    });

    await testStep('查看岗位状态（撤回后，名额应释放）', async () => {
      const positions = await service.listPositions();
      const bd = positions.find(p => p.name === '字节跳动-前端开发');
      console.log('「字节跳动-前端开发」可用名额:', bd.available_quota);
      
      if (bd.available_quota === 1) {
        return { success: true, message: '✓ 撤回后名额正确释放' };
      }
      throw new Error(`名额未正确释放`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 测试7：学院统计');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await testStep('查看学院统计', async () => {
      const stats = await service.getCollegeStats();
      console.log('学院统计：');
      stats.forEach(s => {
        console.log(`\n${s.college}:`);
        console.log(`  总计: ${s.total}`);
        console.log(`  待面试: ${s.pending}`);
        console.log(`  面试中: ${s.interviewing}`);
        console.log(`  已录用: ${s.accepted}`);
        console.log(`  已拒绝: ${s.rejected}`);
        console.log(`  已撤回: ${s.withdrawn}`);
      });
      return { success: true, message: `共 ${stats.length} 个学院` };
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 测试8：审计日志');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await testStep('查看最近的审计日志', async () => {
      const logs = await service.listAuditLogs(10);
      console.log('最近的审计日志：');
      logs.forEach(l => {
        console.log(`\n[${l.created_at}] ${l.action}`);
        console.log(`  ${l.college} - ${l.student_name} -> ${l.position_name}`);
        console.log(`  ${l.details}`);
      });
      return { success: true, message: `共 ${logs.length} 条日志` };
    });

    console.log('\n═══════════════════════════════════════════════');
    console.log('🎉 快速测试通过！');
    console.log('═══════════════════════════════════════════════');

  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await db.closeDB();
  }
}

async function testStep(description, testFn) {
  console.log(`📍 ${description}`);
  try {
    const result = await testFn();
    console.log(`   ${result.message}\n`);
  } catch (err) {
    console.error(`   ❌ 失败: ${err.message}`);
    throw err;
  }
}

quickTest();
