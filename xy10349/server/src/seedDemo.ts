import db, { initDatabase } from './database';

export function seedDemoData() {
  initDatabase();

  const leaveExists = db.prepare(`
    SELECT COUNT(*) as count FROM leave_requests WHERE studentId = 's-002' AND meetingPointId = 'mp-002'
  `).get() as { count: number };

  if (leaveExists.count > 0) {
    console.log('Demo data already exists, skipping seeding.');
    return;
  }

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO leave_requests (id, studentId, meetingPointId, reason, status, requestedBy, approvedBy, requestTime, approvalTime, rawInput)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'leave-demo-001',
      's-002',
      'mp-002',
      '身体不适，需要休息',
      'approved',
      '张老师',
      '系统管理员',
      '2026-05-10 08:30:00',
      '2026-05-10 08:35:00',
      '{"studentId":"s-002","meetingPointId":"mp-002","reason":"身体不适"}'
    );

    db.prepare(`
      INSERT INTO leave_requests (id, studentId, meetingPointId, reason, status, requestedBy, requestTime, rawInput)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'leave-demo-002',
      's-006',
      'mp-003',
      '家中有急事需要处理',
      'pending',
      '李老师',
      '2026-05-10 10:00:00',
      '{"studentId":"s-006","meetingPointId":"mp-003","reason":"家中有事"}'
    );

    const normalAttendances = [
      { studentId: 's-001', status: 'present' },
      { studentId: 's-003', status: 'present' },
      { studentId: 's-010', status: 'present' },
    ];
    const insertAtt = db.prepare(`
      INSERT INTO attendance_records (id, studentId, meetingPointId, status, timestamp, operatorId, rawInput, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    normalAttendances.forEach((a, i) => {
      insertAtt.run(
        `att-demo-1-${i + 1}`,
        a.studentId,
        'mp-001',
        a.status,
        '2026-05-10 08:00:00',
        '张老师',
        `{"studentId":"${a.studentId}","meetingPointId":"mp-001","status":"${a.status}"}`,
        ''
      );
    });

    insertAtt.run(
      'att-demo-2-1',
      's-002',
      'mp-002',
      'leave',
      '2026-05-10 09:30:00',
      '李老师',
      '{"studentId":"s-002","meetingPointId":"mp-002","status":"leave"}',
      '请假已批准'
    );

    insertAtt.run(
      'att-demo-2-2',
      's-004',
      'mp-002',
      'late',
      '2026-05-10 09:45:00',
      '李老师',
      '{"studentId":"s-004","meetingPointId":"mp-002","status":"late"}',
      '堵车迟到15分钟'
    );

    insertAtt.run(
      'att-demo-2-3',
      's-005',
      'mp-002',
      'absent',
      '2026-05-10 09:30:00',
      '李老师',
      '{"studentId":"s-005","meetingPointId":"mp-002","status":"absent"}',
      '缺勤未处理 - 需要联系家长'
    );

    db.prepare(`
      INSERT INTO group_changes (id, studentId, oldGroupId, newGroupId, reason, operatorId, timestamp, rawInput)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'gc-demo-001',
      's-008',
      'g-003',
      'g-002',
      '身体不适，需要调整到李老师组便于照顾',
      '张老师',
      '2026-05-10 09:15:00',
      '{"studentId":"s-008","newGroupId":"g-002","reason":"身体不适调整"}'
    );

    db.prepare(`
      INSERT INTO group_changes (id, studentId, oldGroupId, newGroupId, reason, operatorId, timestamp, rawInput)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'gc-demo-002',
      's-009',
      'g-003',
      'g-001',
      '与原小组同学有冲突，需要换组',
      '李老师',
      '2026-05-10 10:30:00',
      '{"studentId":"s-009","newGroupId":"g-001","reason":"同学冲突"}'
    );

    db.prepare('UPDATE students SET groupId = ? WHERE id = ?').run('g-002', 's-008');
    db.prepare('UPDATE students SET groupId = ? WHERE id = ?').run('g-001', 's-009');

    console.log('Demo data seeded successfully!');
    console.log('');
    console.log('📌 样例数据说明：');
    console.log('');
    console.log('1. 正常集合（学校大门集合 mp-001）：');
    console.log('   - 陈小明(s-001): 到岗 ✓');
    console.log('   - 王小强(s-003): 到岗 ✓');
    console.log('   - 冯小雪(s-010): 到岗 ✓');
    console.log('');
    console.log('2. 学生请假（博物馆入口 mp-002）：');
    console.log('   - 李小红(s-002): 请假申请已批准 ✓，已标记为请假状态');
    console.log('   - 刘小芳(s-004): 迟到（堵车15分钟）');
    console.log('   - 赵小华(s-005): 缺勤 ⚠️（未处理，需要联系家长）');
    console.log('');
    console.log('3. 待审批请假（科技馆大厅 mp-003）：');
    console.log('   - 孙小美(s-006): 请假待审批');
    console.log('   （如果在请假审批前尝试标记请假，会被系统规则拦截）');
    console.log('');
    console.log('4. 临时换组：');
    console.log('   - 吴小丽(s-008): 第三小组 → 第二小组（身体不适调整）');
    console.log('   - 郑小龙(s-009): 第三小组 → 第一小组（同学冲突）');
    console.log('');
    console.log('5. 业务规则测试：');
    console.log('   - 未批准请假拦截：尝试直接标记孙小美(s-006)为请假会被拦截');
    console.log('   - 缺勤恢复拦截：赵小华(s-005)已在mp-002标记缺勤，不能直接改为到岗');
    console.log('   - 所有操作都会保留原始输入片段');
  });

  tx();
}
