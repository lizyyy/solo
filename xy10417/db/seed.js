const now = new Date();
const time1 = new Date(now);
time1.setDate(now.getDate() - 2);
time1.setHours(10, 0, 0, 0);

const time2 = new Date(now);
time2.setDate(now.getDate() + 3);
time2.setHours(14, 0, 0, 0);

const time3 = new Date(now);
time3.setDate(now.getDate() - 1);
time3.setHours(9, 0, 0, 0);

const time4 = new Date(now);
time4.setDate(now.getDate() - 7);
time4.setHours(11, 0, 0, 0);

const seedSQL = `
INSERT INTO positions (name, department, hr_name) VALUES ('前端开发工程师', '技术部', '张经理');
INSERT INTO positions (name, department, hr_name) VALUES ('后端开发工程师', '技术部', '李主管');
INSERT INTO positions (name, department, hr_name) VALUES ('产品经理', '产品部', '王HR');

INSERT INTO candidates (name, phone, email) VALUES ('张三', '13800138001', 'zhangsan@example.com');
INSERT INTO candidates (name, phone, email, no_show_count, risk_level) VALUES ('李四', '13800138002', 'lisi@example.com', 0, 'normal');
INSERT INTO candidates (name, phone, email, no_show_count, risk_level) VALUES ('王五', '13800138003', 'wangwu@example.com', 1, 'medium');
INSERT INTO candidates (name, phone, email, no_show_count, risk_level, is_blacklisted) VALUES ('赵六', '13800138004', 'zhaoliu@example.com', 2, 'blacklisted', 1);

INSERT INTO interviews (position_id, candidate_id, hr_name, scheduled_time, status, checkin_status, actual_signin_time) VALUES (1, 1, '张经理', '${time1.toISOString()}', 'completed', 'attended', '${time1.toISOString()}');
INSERT INTO timelines (interview_id, candidate_id, action, details, actor) VALUES (1, 1, '安排面试', '安排时间: ${time1.toISOString()}', '张经理');
INSERT INTO timelines (interview_id, candidate_id, action, details, actor) VALUES (1, 1, '参加面试', '签到时间: ${time1.toISOString()}', '系统');

INSERT INTO interviews (position_id, candidate_id, hr_name, scheduled_time, status, reschedule_count) VALUES (2, 2, '李主管', '${time2.toISOString()}', 'rescheduled', 1);
INSERT INTO timelines (interview_id, candidate_id, action, details, actor) VALUES (2, 2, '安排面试', '安排时间: 2026-05-06T14:00:00.000Z', '李主管');
INSERT INTO timelines (interview_id, candidate_id, action, details, actor) VALUES (2, 2, '申请改期', '原时间: 2026-05-06T14:00:00.000Z, 申请时间: ${time2.toISOString()}, 原因: 临时有事', '候选人');
INSERT INTO timelines (interview_id, candidate_id, action, details, actor) VALUES (2, 2, '改期通过', '新时间: ${time2.toISOString()}', '李主管');
INSERT INTO reschedule_requests (interview_id, original_time, requested_time, reason, status, reviewer, review_time) VALUES (2, '2026-05-06T14:00:00.000Z', '${time2.toISOString()}', '临时有事', 'approved', '李主管', '${now.toISOString()}');

INSERT INTO interviews (position_id, candidate_id, hr_name, scheduled_time, status, checkin_status) VALUES (3, 3, '王HR', '${time3.toISOString()}', 'completed', 'no_show');
INSERT INTO timelines (interview_id, candidate_id, action, details, actor) VALUES (3, 3, '安排面试', '安排时间: ${time3.toISOString()}', '王HR');
INSERT INTO timelines (interview_id, candidate_id, action, details, actor) VALUES (3, 3, '爽约', '面试爽约', '系统');
INSERT INTO timelines (interview_id, candidate_id, action, details, actor) VALUES (3, 3, '待跟进', '备注: 需要联系候选人确认情况', '王HR');

INSERT INTO interviews (position_id, candidate_id, hr_name, scheduled_time, status, checkin_status) VALUES (1, 4, '张经理', '${time4.toISOString()}', 'completed', 'no_show');
INSERT INTO timelines (interview_id, candidate_id, action, details, actor) VALUES (4, 4, '安排面试', '安排时间: ${time4.toISOString()}', '张经理');
INSERT INTO timelines (interview_id, candidate_id, action, details, actor) VALUES (4, 4, '爽约', '面试爽约', '系统');
INSERT INTO timelines (interview_id, candidate_id, action, details, actor) VALUES (4, 4, '系统提醒', '候选人多次爽约，已进入高风险复核名单', '系统');
INSERT INTO timelines (interview_id, candidate_id, action, details, actor) VALUES (4, 4, '加入黑名单', '原因: 多次爽约且无法联系', '张经理');
INSERT INTO decisions (interview_id, type, decision, notes) VALUES (4, 'blacklist', 'add', '多次爽约且无法联系');
`;

module.exports = seedSQL;
