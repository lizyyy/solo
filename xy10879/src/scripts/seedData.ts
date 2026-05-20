import { v4 as uuidv4 } from 'uuid';
import { runQuery, initPromise } from '../database';
import { PromoCodeStatus, RuleType, EventStatus, RiskLevel } from '../types';

async function seedData() {
  console.log('开始初始化数据...');
  
  await initPromise;
  
  const now = new Date();
  const validFrom = now.toISOString();
  const validTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const promoCodes = [
    { id: uuidv4(), code: 'SAVE20', discountType: 'percentage', discountValue: 20, maxUsage: 100 },
    { id: uuidv4(), code: 'FIXED50', discountType: 'fixed', discountValue: 50, maxUsage: 50 },
    { id: uuidv4(), code: 'NEWUSER10', discountType: 'percentage', discountValue: 10, maxUsage: 500 },
    { id: uuidv4(), code: 'SUMMER30', discountType: 'percentage', discountValue: 30, maxUsage: 200 },
    { id: uuidv4(), code: 'VIP100', discountType: 'fixed', discountValue: 100, maxUsage: 10 }
  ];

  for (const pc of promoCodes) {
    try {
      await runQuery(
        `INSERT OR IGNORE INTO promo_codes (id, code, discount_type, discount_value, max_usage, current_usage, status, valid_from, valid_to, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pc.id, pc.code, pc.discountType, pc.discountValue, pc.maxUsage, Math.floor(Math.random() * 20), PromoCodeStatus.ACTIVE, validFrom, validTo, validFrom, validFrom]
      );
      console.log(`✓ 已创建优惠码: ${pc.code}`);
    } catch (err: any) {
      if (!err.message.includes('UNIQUE constraint failed')) {
        throw err;
      }
    }
  }
  console.log('优惠码数据初始化完成\n');

  const rules = [
    {
      name: '频率限制规则',
      type: RuleType.FREQUENCY_LIMIT,
      description: '限制短时间内多次尝试使用优惠码',
      config: JSON.stringify({
        timeWindowMinutes: 5,
        maxAttempts: 3,
        penaltyPoints: 30
      })
    },
    {
      name: '重复使用检测',
      type: RuleType.DUPLICATE_USAGE,
      description: '检测同一设备重复使用同一优惠码',
      config: JSON.stringify({
        maxUsagePerDevice: 1,
        penaltyPoints: 40
      })
    },
    {
      name: '设备指纹识别',
      type: RuleType.DEVICE_FINGERPRINT,
      description: '检测可疑设备的频繁尝试行为',
      config: JSON.stringify({
        suspiciousAttemptThreshold: 10,
        penaltyPoints: 50
      })
    },
    {
      name: '风险评分规则',
      type: RuleType.RISK_SCORE,
      description: '根据累积风险评分决定是否拦截',
      config: JSON.stringify({
        blockThreshold: 60,
        warnThreshold: 30
      })
    }
  ];

  for (const rule of rules) {
    try {
      await runQuery(
        `INSERT OR IGNORE INTO risk_rules (id, name, type, description, enabled, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
        [uuidv4(), rule.name, rule.type, rule.description, rule.config, validFrom, validFrom]
      );
      console.log(`✓ 已创建规则: ${rule.name}`);
    } catch (err: any) {
      if (!err.message.includes('UNIQUE constraint failed')) {
        throw err;
      }
    }
  }
  console.log('风控规则初始化完成\n');

  const devices = [
    { deviceId: 'device-normal-001', userId: 'user-001', ip: '192.168.1.101', attempts: 2, riskScore: 0 },
    { deviceId: 'device-normal-002', userId: 'user-002', ip: '192.168.1.102', attempts: 5, riskScore: 10 },
    { deviceId: 'device-susp-001', userId: 'user-003', ip: '10.0.0.50', attempts: 15, riskScore: 45 },
    { deviceId: 'device-susp-002', userId: null, ip: '10.0.0.51', attempts: 25, riskScore: 70 },
    { deviceId: 'device-bot-001', userId: null, ip: '172.16.0.100', attempts: 50, riskScore: 95 },
  ];

  for (const dev of devices) {
    try {
      await runQuery(
        `INSERT OR IGNORE INTO user_devices (id, device_id, user_id, ip_address, user_agent, risk_score, attempt_count, last_attempt_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), dev.deviceId, dev.userId, dev.ip, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', dev.riskScore, dev.attempts, validFrom, validFrom, validFrom]
      );
      console.log(`✓ 已创建设备: ${dev.deviceId}`);
    } catch (err: any) {
      if (!err.message.includes('UNIQUE constraint failed')) {
        throw err;
      }
    }
  }
  console.log('用户设备数据初始化完成\n');

  const allowRecords = [
    { promoCode: 'SAVE20', promoCodeId: promoCodes[0].id, deviceId: 'device-normal-001', userId: 'user-001', ip: '192.168.1.101', riskScore: 0, isManual: 0, minsAgo: 120 },
    { promoCode: 'NEWUSER10', promoCodeId: promoCodes[2].id, deviceId: 'device-normal-002', userId: 'user-002', ip: '192.168.1.102', riskScore: 5, isManual: 0, minsAgo: 90 },
    { promoCode: 'FIXED50', promoCodeId: promoCodes[1].id, deviceId: 'device-susp-001', userId: 'user-003', ip: '10.0.0.50', riskScore: 45, isManual: 1, approvedBy: 'admin-zhang', minsAgo: 60 },
    { promoCode: 'SUMMER30', promoCodeId: promoCodes[3].id, deviceId: 'device-normal-001', userId: 'user-001', ip: '192.168.1.101', riskScore: 0, isManual: 0, minsAgo: 30 },
  ];

  for (const rec of allowRecords) {
    const createdAt = new Date(now.getTime() - rec.minsAgo * 60 * 1000).toISOString();
    await runQuery(
      `INSERT INTO allow_records (id, promo_code_id, promo_code, device_id, user_id, ip_address, risk_score, is_manual, approved_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), rec.promoCodeId, rec.promoCode, rec.deviceId, rec.userId, rec.ip, rec.riskScore, rec.isManual, rec.approvedBy || null, createdAt]
    );
    console.log(`✓ 已创建放行记录: ${rec.promoCode} - ${rec.deviceId}`);
  }
  console.log('放行记录初始化完成\n');

  const blockEvents = [
    { 
      promoCode: 'SAVE20', promoCodeId: promoCodes[0].id, 
      deviceId: 'device-susp-001', userId: 'user-003', ip: '10.0.0.50',
      riskScore: 75, riskLevel: RiskLevel.HIGH,
      rules: ['频率限制规则', '风险评分规则'],
      reason: '5分钟内尝试次数超过3次; 风险评分75超过拦截阈值60',
      status: EventStatus.BLOCKED,
      hoursAgo: 2
    },
    { 
      promoCode: 'SAVE20', promoCodeId: promoCodes[0].id, 
      deviceId: 'device-susp-001', userId: 'user-003', ip: '10.0.0.50',
      riskScore: 80, riskLevel: RiskLevel.HIGH,
      rules: ['频率限制规则', '风险评分规则'],
      reason: '5分钟内尝试次数超过3次; 风险评分80超过拦截阈值60',
      status: EventStatus.MANUAL_ALLOWED,
      compensatedBy: 'admin-li',
      compensatedNote: '核实为正常用户误触发，人工放行',
      hoursAgo: 4
    },
    { 
      promoCode: 'NEWUSER10', promoCodeId: promoCodes[2].id, 
      deviceId: 'device-bot-001', userId: null, ip: '172.16.0.100',
      riskScore: 95, riskLevel: RiskLevel.CRITICAL,
      rules: ['设备指纹识别', '风险评分规则'],
      reason: '该设备累计尝试50次，行为可疑; 风险评分95超过拦截阈值60',
      status: EventStatus.BLOCKED,
      hoursAgo: 1
    },
    { 
      promoCode: 'FIXED50', promoCodeId: promoCodes[1].id, 
      deviceId: 'device-susp-002', userId: null, ip: '10.0.0.51',
      riskScore: 85, riskLevel: RiskLevel.HIGH,
      rules: ['频率限制规则', '设备指纹识别', '风险评分规则'],
      reason: '5分钟内尝试次数超过3次; 该设备累计尝试25次，行为可疑; 风险评分85超过拦截阈值60',
      status: EventStatus.COMPENSATED,
      compensatedBy: 'operation-team',
      compensatedNote: '已联系用户并发放新优惠码作为补偿',
      hoursAgo: 6
    },
    { 
      promoCode: 'VIP100', promoCodeId: promoCodes[4].id, 
      deviceId: 'device-bot-001', userId: null, ip: '172.16.0.100',
      riskScore: 100, riskLevel: RiskLevel.CRITICAL,
      rules: ['频率限制规则', '设备指纹识别', '风险评分规则'],
      reason: '5分钟内尝试次数超过3次; 该设备累计尝试50次，行为可疑; 风险评分100超过拦截阈值60',
      status: EventStatus.BLOCKED,
      hoursAgo: 0.5
    },
    { 
      promoCode: 'SUMMER30', promoCodeId: promoCodes[3].id, 
      deviceId: 'device-susp-002', userId: null, ip: '10.0.0.51',
      riskScore: 70, riskLevel: RiskLevel.HIGH,
      rules: ['频率限制规则', '风险评分规则'],
      reason: '5分钟内尝试次数超过3次; 风险评分70超过拦截阈值60',
      status: EventStatus.BLOCKED,
      hoursAgo: 3
    },
  ];

  for (const evt of blockEvents) {
    const createdAt = new Date(now.getTime() - evt.hoursAgo * 60 * 60 * 1000).toISOString();
    const compensatedAt = evt.status !== EventStatus.BLOCKED ? new Date(now.getTime() - (evt.hoursAgo - 0.5) * 60 * 60 * 1000).toISOString() : null;
    
    await runQuery(
      `INSERT INTO block_events (id, promo_code_id, promo_code, device_id, user_id, ip_address, risk_score, risk_level, triggered_rules, status, reason, compensated_at, compensated_by, compensated_note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), evt.promoCodeId, evt.promoCode, evt.deviceId, evt.userId, evt.ip, 
        evt.riskScore, evt.riskLevel, JSON.stringify(evt.rules), evt.status, evt.reason,
        compensatedAt, evt.compensatedBy || null, evt.compensatedNote || null,
        createdAt, createdAt
      ]
    );
    console.log(`✓ 已创建拦截事件: ${evt.promoCode} - ${evt.deviceId} - ${evt.status}`);
  }
  console.log('拦截事件初始化完成\n');

  const attemptLogs = [];
  for (let i = 0; i < 20; i++) {
    const isSuccess = Math.random() > 0.4;
    const device = devices[Math.floor(Math.random() * devices.length)];
    const promo = promoCodes[Math.floor(Math.random() * promoCodes.length)];
    const minsAgo = Math.random() * 120;
    
    attemptLogs.push({
      id: uuidv4(),
      promoCodeId: promo.id,
      promoCode: promo.code,
      deviceId: device.deviceId,
      userId: device.userId,
      ip: device.ip,
      success: isSuccess ? 1 : 0,
      errorCode: isSuccess ? null : 'RISK_BLOCKED',
      errorMessage: isSuccess ? null : '风险拦截：触发风控规则',
      createdAt: new Date(now.getTime() - minsAgo * 60 * 1000).toISOString()
    });
  }

  for (const log of attemptLogs) {
    await runQuery(
      `INSERT INTO attempt_logs (id, promo_code_id, promo_code, device_id, user_id, ip_address, success, error_code, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [log.id, log.promoCodeId, log.promoCode, log.deviceId, log.userId, log.ip, log.success, log.errorCode, log.errorMessage, log.createdAt]
    );
  }
  console.log(`✓ 已创建 ${attemptLogs.length} 条尝试日志记录`);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ 数据初始化完成！样本数据覆盖：');
  console.log('  - 优惠码: 5 个 (不同类型和使用限制)');
  console.log('  - 风控规则: 4 条 (频率限制、重复使用、设备指纹、风险评分)');
  console.log('  - 用户设备: 5 个 (正常设备、可疑设备、机器人设备)');
  console.log('  - 放行记录: 4 条 (自动放行 + 人工放行)');
  console.log('  - 拦截事件: 6 条 (已拦截、人工放行、已补偿)');
  console.log('  - 尝试日志: 20 条 (成功 + 失败)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n📊 报表和状态链路验证点：');
  console.log('  1. 拦截事件：查看详情可看到触发的规则和拦截原因');
  console.log('  2. 状态流转：已拦截 → 人工放行/已补偿');
  console.log('  3. 导出功能：每条记录包含完整的状态解释');
  console.log('  4. 风险评分：从 LOW 到 CRITICAL 的完整覆盖');
  console.log('  5. 操作审计：记录操作人和处理备注');
  
  process.exit(0);
}

seedData().catch(err => {
  console.error('❌ 数据初始化失败:', err);
  process.exit(1);
});
