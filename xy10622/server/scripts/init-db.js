const { initDatabase, runQuery, allQuery } = require('../database/db');

async function seedData() {
  try {
    await initDatabase();
    
    console.log('开始插入样例数据...');

    const volunteers = [
      { name: '张三', phone: '13800138001', total_hours: 45.5 },
      { name: '李四', phone: '13800138002', total_hours: 32.0 },
      { name: '王五', phone: '13800138003', total_hours: 28.5 },
      { name: '赵六', phone: '13800138004', total_hours: 52.0 },
      { name: '王队长', phone: '13800138005', total_hours: 120.0 }
    ];

    for (const v of volunteers) {
      await runQuery(
        'INSERT INTO volunteers (name, phone, total_hours) VALUES (?, ?, ?)',
        [v.name, v.phone, v.total_hours]
      );
    }
    console.log('✓ 志愿者数据插入完成');

    const activities = [
      { name: '社区环保活动', date: '2024-01-15', location: '阳光社区', standard_hours: 4 },
      { name: '敬老院慰问', date: '2024-01-20', location: '幸福敬老院', standard_hours: 3 },
      { name: '图书馆志愿服务', date: '2024-01-25', location: '市图书馆', standard_hours: 5 },
      { name: '马拉松志愿者', date: '2024-02-01', location: '体育中心', standard_hours: 8 }
    ];

    for (const a of activities) {
      await runQuery(
        'INSERT INTO activities (name, date, location, standard_hours) VALUES (?, ?, ?, ?)',
        [a.name, a.date, a.location, a.standard_hours]
      );
    }
    console.log('✓ 活动数据插入完成');

    const checkins = [
      { activity_id: 1, volunteer_id: 1, checkin_time: '2024-01-15 08:00:00', checkout_time: '2024-01-15 12:00:00', hours: 4, status: 'confirmed' },
      { activity_id: 1, volunteer_id: 2, checkin_time: '2024-01-15 08:30:00', checkout_time: null, hours: 0, status: 'missing_checkout' },
      { activity_id: 2, volunteer_id: 1, checkin_time: '2024-01-20 09:00:00', checkout_time: '2024-01-20 12:00:00', hours: 3, status: 'confirmed' },
      { activity_id: 2, volunteer_id: 3, checkin_time: '2024-01-20 09:00:00', checkout_time: '2024-01-20 11:00:00', hours: 2, status: 'pending_audit' },
      { activity_id: 3, volunteer_id: 4, checkin_time: '2024-01-25 09:00:00', checkout_time: '2024-01-25 14:00:00', hours: 5, status: 'confirmed' },
      { activity_id: 3, volunteer_id: 2, checkin_time: '2024-01-25 10:00:00', checkout_time: null, hours: 0, status: 'missing_checkout' },
      { activity_id: 4, volunteer_id: 1, checkin_time: '2024-02-01 06:00:00', checkout_time: '2024-02-01 14:00:00', hours: 8, status: 'confirmed' },
      { activity_id: 4, volunteer_id: 3, checkin_time: '2024-02-01 06:00:00', checkout_time: '2024-02-01 12:00:00', hours: 6, status: 'pending_audit' }
    ];

    for (const c of checkins) {
      await runQuery(
        'INSERT INTO activity_checkins (activity_id, volunteer_id, checkin_time, checkout_time, hours, status) VALUES (?, ?, ?, ?, ?, ?)',
        [c.activity_id, c.volunteer_id, c.checkin_time, c.checkout_time, c.hours, c.status]
      );
    }
    console.log('✓ 活动签到数据插入完成');

    const confirmations = [
      { checkin_id: 1, captain_id: 5, confirmed_hours: 4, status: 'confirmed', notes: '正常签到签退', confirmed_at: '2024-01-15 18:00:00' },
      { checkin_id: 3, captain_id: 5, confirmed_hours: 3, status: 'confirmed', notes: '表现优秀', confirmed_at: '2024-01-20 18:00:00' },
      { checkin_id: 4, captain_id: 5, confirmed_hours: 3, status: 'pending', notes: '提前离开，需核实', confirmed_at: null },
      { checkin_id: 5, captain_id: 5, confirmed_hours: 5, status: 'confirmed', notes: '全天在岗', confirmed_at: '2024-01-25 18:00:00' },
      { checkin_id: 7, captain_id: 5, confirmed_hours: 8, status: 'confirmed', notes: '全程参与', confirmed_at: '2024-02-01 20:00:00' },
      { checkin_id: 8, captain_id: 5, confirmed_hours: 8, status: 'pending', notes: '签退时间异常', confirmed_at: null }
    ];

    for (const c of confirmations) {
      await runQuery(
        'INSERT INTO captain_confirmations (checkin_id, captain_id, confirmed_hours, status, notes, confirmed_at) VALUES (?, ?, ?, ?, ?, ?)',
        [c.checkin_id, c.captain_id, c.confirmed_hours, c.status, c.notes, c.confirmed_at]
      );
    }
    console.log('✓ 队长确认数据插入完成');

    const missingCheckouts = [
      { checkin_id: 2, status: 'pending', handled_by: null, handled_at: null, notes: '未签退' },
      { checkin_id: 6, status: 'handled', handled_by: '管理员', handled_at: '2024-01-26 10:00:00', notes: '核实后补录3小时' }
    ];

    for (const m of missingCheckouts) {
      await runQuery(
        'INSERT INTO missing_checkouts (checkin_id, status, handled_by, handled_at, notes) VALUES (?, ?, ?, ?, ?)',
        [m.checkin_id, m.status, m.handled_by, m.handled_at, m.notes]
      );
    }
    console.log('✓ 缺签退数据插入完成');

    const audits = [
      { checkin_id: 4, auditor_id: 5, original_hours: 2, approved_hours: 3, status: 'pending', reason: '提前离开但实际工作满3小时', handled_by: null, handled_at: null },
      { checkin_id: 8, auditor_id: 5, original_hours: 6, approved_hours: 6, status: 'approved', reason: '签到签退时间有误，但时长属实', handled_by: '审核员A', handled_at: '2024-02-03 15:00:00' }
    ];

    for (const a of audits) {
      await runQuery(
        'INSERT INTO supplemental_audits (checkin_id, auditor_id, original_hours, approved_hours, status, reason, handled_by, handled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [a.checkin_id, a.auditor_id, a.original_hours, a.approved_hours, a.status, a.reason, a.handled_by, a.handled_at]
      );
    }
    console.log('✓ 补录审核数据插入完成');

    const redemptions = [
      { volunteer_id: 1, honor_name: '一星志愿者', required_hours: 30, status: 'redeemed', redeemed_at: '2024-01-25 10:00:00' },
      { volunteer_id: 4, honor_name: '二星志愿者', required_hours: 50, status: 'redeemed', redeemed_at: '2024-02-01 16:00:00' },
      { volunteer_id: 2, honor_name: '一星志愿者', required_hours: 30, status: 'pending', redeemed_at: null }
    ];

    for (const r of redemptions) {
      await runQuery(
        'INSERT INTO honor_redemptions (volunteer_id, honor_name, required_hours, status, redeemed_at) VALUES (?, ?, ?, ?, ?)',
        [r.volunteer_id, r.honor_name, r.required_hours, r.status, r.redeemed_at]
      );
    }
    console.log('✓ 荣誉兑换数据插入完成');

    console.log('\n✅ 所有样例数据初始化完成！');

  } catch (error) {
    console.error('数据初始化失败:', error);
    process.exit(1);
  }
}

seedData();
