-- ============================================
-- 叉车充电排班系统 - 演示数据
-- ============================================

USE forklift_charging;

-- 清空现有数据
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE operation_logs;
TRUNCATE TABLE change_history;
TRUNCATE TABLE import_batches;
TRUNCATE TABLE anomaly_records;
TRUNCATE TABLE charging_tasks;
TRUNCATE TABLE work_waves;
TRUNCATE TABLE batteries;
TRUNCATE TABLE charging_stations;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- 1. 充电桩数据
-- ============================================
INSERT INTO charging_stations (station_code, station_name, location, max_power, status, current_task_id, health_score, last_maintenance_time) VALUES
('STN-001', 'A区-1号充电桩', 'A区入库口左侧', 60, 'AVAILABLE', NULL, 98, '2025-06-01 10:00:00'),
('STN-002', 'A区-2号充电桩', 'A区入库口右侧', 60, 'OCCUPIED', 2, 95, '2025-06-01 10:00:00'),
('STN-003', 'A区-3号充电桩', 'A区货梯旁', 60, 'AVAILABLE', NULL, 92, '2025-05-15 09:00:00'),
('STN-004', 'B区-1号充电桩', 'B区立库区入口', 60, 'OCCUPIED', 3, 88, '2025-05-20 14:00:00'),
('STN-005', 'B区-2号充电桩', 'B区立库区出口', 60, 'AVAILABLE', NULL, 96, '2025-06-05 11:00:00'),
('STN-006', 'C区-1号充电桩', 'C区分拣区', 60, 'FAULTY', NULL, 65, '2025-04-30 08:00:00'),
('STN-007', 'C区-2号充电桩', 'C区打包区', 60, 'AVAILABLE', NULL, 94, '2025-06-03 15:00:00'),
('STN-008', 'D区-1号充电桩', 'D区出库区', 60, 'AVAILABLE', NULL, 90, '2025-05-28 16:00:00');

-- ============================================
-- 2. 电池数据
-- ============================================
INSERT INTO batteries (battery_code, forklift_code, battery_type, capacity_kwh, current_soc, min_soc, health_status, health_score, cycle_count, last_charge_time) VALUES
('BAT-001', 'FKL-A01', 'LITHIUM', 80.00, 35, 20, 'GOOD', 95, 1250, '2025-06-05 08:00:00'),
('BAT-002', 'FKL-A02', 'LITHIUM', 80.00, 55, 20, 'GOOD', 92, 980, '2025-06-05 10:00:00'),
('BAT-003', 'FKL-A03', 'LITHIUM', 80.00, 25, 20, 'WARNING', 78, 2100, '2025-06-04 20:00:00'),
('BAT-004', 'FKL-B01', 'LITHIUM', 80.00, 15, 20, 'WARNING', 72, 2450, '2025-06-04 18:00:00'),
('BAT-005', 'FKL-B02', 'LITHIUM', 80.00, 70, 20, 'GOOD', 96, 560, '2025-06-05 12:00:00'),
('BAT-006', 'FKL-B03', 'LITHIUM', 80.00, 45, 20, 'GOOD', 93, 1100, '2025-06-05 09:00:00'),
('BAT-007', 'FKL-C01', 'LITHIUM', 80.00, 10, 20, 'REPLACE', 45, 3200, '2025-06-03 22:00:00'),
('BAT-008', 'FKL-C02', 'LITHIUM', 80.00, 60, 20, 'GOOD', 94, 780, '2025-06-05 11:00:00'),
('BAT-009', 'FKL-D01', 'LEAD_ACID', 60.00, 40, 25, 'WARNING', 68, 1800, '2025-06-05 07:00:00'),
('BAT-010', 'FKL-D02', 'LEAD_ACID', 60.00, 50, 25, 'GOOD', 85, 950, '2025-06-05 08:30:00');

-- ============================================
-- 3. 作业波次数据
-- ============================================
INSERT INTO work_waves (wave_code, wave_name, start_time, end_time, priority, status, required_forklifts, actual_forklifts) VALUES
('WAVE-001', '早班入库波次', '2025-06-06 08:00:00', '2025-06-06 12:00:00', 1, 'PLANNED', 5, 0),
('WAVE-002', '早班出库波次', '2025-06-06 09:00:00', '2025-06-06 11:30:00', 2, 'PLANNED', 4, 0),
('WAVE-003', '中班分拣波次', '2025-06-06 13:00:00', '2025-06-06 17:00:00', 1, 'PLANNED', 6, 0),
('WAVE-004', '晚班盘点波次', '2025-06-06 18:00:00', '2025-06-06 22:00:00', 3, 'PLANNED', 3, 0),
('WAVE-005', '618大促-批次1', '2025-06-06 07:00:00', '2025-06-06 10:00:00', 1, 'ACTIVE', 8, 6),
('WAVE-006', '618大促-批次2', '2025-06-06 10:00:00', '2025-06-06 14:00:00', 1, 'PLANNED', 10, 0),
('WAVE-007', '历史完成波次', '2025-06-05 08:00:00', '2025-06-05 12:00:00', 2, 'FINISHED', 5, 5),
('WAVE-008', '历史取消波次', '2025-06-04 08:00:00', '2025-06-04 12:00:00', 3, 'CANCELLED', 4, 0);

-- ============================================
-- 4. 充电任务数据
-- ============================================
INSERT INTO charging_tasks (task_code, battery_id, station_id, wave_id, priority, is_urgent, target_soc, current_soc, estimated_start_time, actual_start_time, estimated_end_time, actual_end_time, status, assigned_operator, remarks, created_by) VALUES
-- 待分配任务
('TASK-20250606-001', 1, NULL, 1, 2, FALSE, 100, 35, '2025-06-06 08:00:00', NULL, '2025-06-06 10:30:00', NULL, 'PENDING', '张三', '早班入库前充电', '管理员'),
('TASK-20250606-002', 3, NULL, 1, 1, TRUE, 100, 25, '2025-06-06 08:30:00', NULL, '2025-06-06 11:00:00', NULL, 'PENDING', '李四', '电池电量低，需要紧急充电', '管理员'),
('TASK-20250606-003', 7, NULL, 5, 1, TRUE, 80, 10, '2025-06-06 07:30:00', NULL, '2025-06-06 09:30:00', NULL, 'PENDING', '王五', '618大促紧急需求', '调度员'),
-- 已分配任务
('TASK-20250606-004', 9, 1, 2, 3, FALSE, 100, 40, '2025-06-06 09:00:00', NULL, '2025-06-06 11:00:00', NULL, 'ASSIGNED', '赵六', '出库波次补充充电', '调度员'),
-- 充电中任务
('TASK-20250606-005', 2, 2, 5, 2, FALSE, 100, 55, '2025-06-06 07:00:00', '2025-06-06 07:05:00', '2025-06-06 09:30:00', NULL, 'CHARGING', '钱七', '大促批次1充电', '调度员'),
('TASK-20250606-006', 4, 4, 5, 1, TRUE, 100, 15, '2025-06-06 07:15:00', '2025-06-06 07:20:00', '2025-06-06 10:30:00', NULL, 'CHARGING', '孙八', '电池低电量警告', '管理员'),
-- 已完成任务（历史数据）
('TASK-20250605-001', 5, 5, 7, 2, FALSE, 100, 30, '2025-06-05 08:00:00', '2025-06-05 08:10:00', '2025-06-05 11:00:00', '2025-06-05 10:50:00', 'COMPLETED', '张三', '历史完成任务1', '管理员'),
('TASK-20250605-002', 6, 7, 7, 3, FALSE, 100, 45, '2025-06-05 09:00:00', '2025-06-05 09:15:00', '2025-06-05 11:30:00', '2025-06-05 11:20:00', 'COMPLETED', '李四', '历史完成任务2', '调度员'),
('TASK-20250605-003', 8, 8, 7, 2, FALSE, 100, 28, '2025-06-05 10:00:00', '2025-06-05 10:05:00', '2025-06-05 12:30:00', '2025-06-05 12:15:00', 'COMPLETED', '王五', '历史完成任务3', '调度员'),
-- 已取消任务
('TASK-20250604-001', 10, 3, 8, 4, FALSE, 100, 60, '2025-06-04 08:00:00', NULL, '2025-06-04 10:00:00', NULL, 'CANCELLED', '赵六', '波次取消，任务取消', '管理员');

-- ============================================
-- 5. 异常记录数据
-- ============================================
INSERT INTO anomaly_records (anomaly_type, anomaly_code, title, description, source, source_id, severity, status, assigned_to, handled_at, handled_by, handling_notes) VALUES
-- 待处理异常
('STATION_FAULT', 'ANOM-STN-001', 'C区1号充电桩故障', 'STN-006充电桩无法启动，显示屏黑屏，疑似电源模块故障', 'ChargingStation', 6, 'HIGH', 'PENDING', '电工班长', NULL, NULL, NULL),
('BATTERY_HEALTH', 'ANOM-BAT-001', '电池健康度严重下降', 'BAT-007电池健康分数降至45分，建议立即更换', 'Battery', 7, 'HIGH', 'PENDING', '设备管理员', NULL, NULL, NULL),
('LOW_BATTERY', 'ANOM-BAT-002', '电池电量低于警戒值', 'BAT-004当前电量15%，低于最低警戒值20%，需要紧急充电', 'Battery', 4, 'MEDIUM', 'PENDING', '调度员', NULL, NULL, NULL),
('LOW_BATTERY', 'ANOM-BAT-003', '电池电量不足', 'BAT-003当前电量25%，接近最低警戒值20%', 'Battery', 3, 'LOW', 'PENDING', '调度员', NULL, NULL, NULL),
-- 已处理异常（历史数据）
('STATION_FAULT', 'ANOM-STN-002', 'B区1号充电桩通信异常', 'STN-004充电桩与系统通信中断，无法监控充电状态', 'ChargingStation', 4, 'MEDIUM', 'HANDLED', '电工班长', '2025-06-05 15:30:00', '电工A', '重启通信模块后恢复正常，已记录维护日志'),
('BATTERY_HEALTH', 'ANOM-BAT-004', '电池健康预警', 'BAT-003电池健康分数降至78分，需要关注', 'Battery', 3, 'MEDIUM', 'HANDLED', '设备管理员', '2025-06-04 10:00:00', '设备管理员', '已安排下周检测，继续观察使用情况'),
('WAVE_CONFLICT', 'ANOM-WAVE-001', '作业波次时间冲突', 'WAVE-007与另一波次时间重叠，可能导致资源冲突', 'WorkWave', 7, 'LOW', 'HANDLED', '调度主管', '2025-06-05 08:30:00', '调度主管', '调整了资源分配，增加了临时叉车，波次已顺利完成');

-- ============================================
-- 6. 变更历史数据（记录修改前后值）
-- ============================================
-- 充电桩变更历史
INSERT INTO change_history (entity_type, entity_id, field_name, old_value, new_value, operation, operator, remarks) VALUES
('ChargingStation', 6, 'status', 'AVAILABLE', 'FAULTY', 'UPDATE', '电工A', '检查发现故障'),
('ChargingStation', 6, 'health_score', '90', '65', 'UPDATE', '电工A', '故障检测后健康分数下调'),
('ChargingStation', 4, 'status', 'AVAILABLE', 'OCCUPIED', 'UPDATE', '系统', '分配任务TASK-20250606-006'),
('ChargingStation', 2, 'status', 'AVAILABLE', 'OCCUPIED', 'UPDATE', '系统', '分配任务TASK-20250606-005'),
('ChargingStation', 4, 'health_score', '90', '88', 'UPDATE', '设备管理员', '定期维护评分调整'),
-- 电池变更历史
('Battery', 4, 'soc', '45', '15', 'UPDATE', '系统', '作业消耗电量'),
('Battery', 4, 'health_status', 'GOOD', 'WARNING', 'UPDATE', '设备管理员', '健康检查发现容量衰减'),
('Battery', 7, 'health_score', '55', '45', 'UPDATE', '设备管理员', '月度检测评分下调'),
('Battery', 7, 'health_status', 'WARNING', 'REPLACE', 'UPDATE', '设备管理员', '建议更换电池'),
('Battery', 3, 'health_score', '82', '78', 'UPDATE', '设备管理员', '检测发现性能下降'),
-- 作业波次变更历史
('WorkWave', 5, 'status', 'PLANNED', 'ACTIVE', 'UPDATE', '调度员', '开始执行618大促批次1'),
('WorkWave', 5, 'actual_forklifts', '0', '4', 'UPDATE', '调度员', '分配4台叉车'),
('WorkWave', 5, 'actual_forklifts', '4', '6', 'MANUAL', '调度主管', '人工增加2台叉车应对大促'),
('WorkWave', 7, 'status', 'ACTIVE', 'FINISHED', 'UPDATE', '系统', '波次完成'),
('WorkWave', 8, 'status', 'PLANNED', 'CANCELLED', 'CANCEL', '调度主管', '业务调整，波次取消'),
-- 充电任务变更历史
('ChargingTask', 2, 'priority', '3', '1', 'MANUAL', '调度主管', '人工调整优先级，紧急充电'),
('ChargingTask', 2, 'is_urgent', 'false', 'true', 'MANUAL', '调度主管', '标记为紧急任务'),
('ChargingTask', 3, 'priority', '2', '1', 'MANUAL', '调度员', '大促期间紧急充电'),
('ChargingTask', 3, 'is_urgent', 'false', 'true', 'MANUAL', '调度员', '618大促紧急需求'),
('ChargingTask', 6, 'status', 'PENDING', 'ASSIGNED', 'ASSIGN', '管理员', '分配到STN-004充电桩'),
('ChargingTask', 6, 'status', 'ASSIGNED', 'CHARGING', 'UPDATE', '系统', '开始充电'),
('ChargingTask', 10, 'status', 'PENDING', 'CANCELLED', 'CANCEL', '管理员', '关联波次取消'),
('ChargingTask', 7, 'status', 'CHARGING', 'COMPLETED', 'COMPLETE', '系统', '充电完成');

-- ============================================
-- 7. 导入批次数据
-- ============================================
INSERT INTO import_batches (batch_code, file_name, file_type, total_records, success_count, fail_count, status, error_log, created_by) VALUES
('IB-20250601-001', '电池清单_20250601.xlsx', 'batteries', 10, 10, 0, 'COMPLETED', NULL, '管理员'),
('IB-20250602-001', '作业波次_6月第一周.xlsx', 'waves', 8, 7, 1, 'PARTIAL', '第8行: 波次编号WAVE-008已存在', '调度员'),
('IB-20250603-001', '新增电池批量导入.xlsx', 'batteries', 5, 5, 0, 'COMPLETED', NULL, '设备管理员'),
('IB-20250605-001', '618大促波次.xlsx', 'waves', 6, 6, 0, 'COMPLETED', NULL, '调度主管');

-- ============================================
-- 8. 操作日志数据
-- ============================================
INSERT INTO operation_logs (operation_type, module, description, operator, ip_address, request_params) VALUES
('LOGIN', '系统', '用户登录系统', '管理员', '192.168.1.100', NULL),
('CREATE', '充电任务', '创建充电任务 TASK-20250606-001', '管理员', '192.168.1.100', '{"batteryId":1,"targetSoc":100}'),
('CREATE', '充电任务', '创建充电任务 TASK-20250606-002', '管理员', '192.168.1.100', '{"batteryId":3,"targetSoc":100,"isUrgent":true}'),
('ASSIGN', '充电任务', '分配任务 TASK-20250606-004 到 STN-001', '调度员', '192.168.1.101', '{"taskId":4,"stationId":1}'),
('UPDATE', '充电任务', '开始充电 TASK-20250606-005', '系统', '127.0.0.1', '{"taskId":5}'),
('UPDATE', '充电任务', '开始充电 TASK-20250606-006', '系统', '127.0.0.1', '{"taskId":6}'),
('MANUAL', '充电任务', '调整任务优先级 TASK-20250606-002', '调度主管', '192.168.1.102', '{"taskId":2,"priority":1}'),
('CREATE', '异常记录', '创建异常记录 ANOM-STN-001', '电工A', '192.168.1.103', '{"type":"STATION_FAULT","stationId":6}'),
('CREATE', '异常记录', '创建异常记录 ANOM-BAT-001', '设备管理员', '192.168.1.104', '{"type":"BATTERY_HEALTH","batteryId":7}'),
('HANDLE', '异常记录', '处理异常 ANOM-STN-002', '电工A', '192.168.1.103', '{"anomalyId":5,"notes":"重启通信模块"}'),
('IMPORT', '批量导入', '导入电池数据 10条', '管理员', '192.168.1.100', '{"fileType":"batteries","total":10}'),
('IMPORT', '批量导入', '导入波次数据 8条(7成功1失败)', '调度员', '192.168.1.101', '{"fileType":"waves","total":8}'),
('EXPORT', '报表', '导出充电报告', '调度主管', '192.168.1.102', '{"startTime":"2025-06-01","endTime":"2025-06-05"}'),
('UPDATE', '作业波次', '开始波次 WAVE-005', '调度员', '192.168.1.101', '{"waveId":5}'),
('UPDATE', '作业波次', '完成波次 WAVE-007', '系统', '127.0.0.1', '{"waveId":7}');

-- ============================================
-- 数据初始化完成
-- ============================================
SELECT '演示数据初始化完成！' AS message;
SELECT '充电桩: ' || COUNT(*) FROM charging_stations;
SELECT '电池: ' || COUNT(*) FROM batteries;
SELECT '作业波次: ' || COUNT(*) FROM work_waves;
SELECT '充电任务: ' || COUNT(*) FROM charging_tasks;
SELECT '异常记录: ' || COUNT(*) FROM anomaly_records;
SELECT '变更历史: ' || COUNT(*) FROM change_history;
