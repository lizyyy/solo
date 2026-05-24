INSERT INTO charging_stations (station_code, name, location, status, power_level, created_at, updated_at)
SELECT 'STATION-001', 'A区充电位1', 'A区东北角', 'AVAILABLE', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM charging_stations WHERE station_code = 'STATION-001');

INSERT INTO charging_stations (station_code, name, location, status, power_level, created_at, updated_at)
SELECT 'STATION-002', 'A区充电位2', 'A区东南角', 'AVAILABLE', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM charging_stations WHERE station_code = 'STATION-002');

INSERT INTO charging_stations (station_code, name, location, status, power_level, created_at, updated_at)
SELECT 'STATION-003', 'B区充电位1', 'B区西北角', 'AVAILABLE', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM charging_stations WHERE station_code = 'STATION-003');

INSERT INTO charging_stations (station_code, name, location, status, power_level, created_at, updated_at)
SELECT 'STATION-004', 'B区充电位2', 'B区西南角', 'AVAILABLE', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM charging_stations WHERE station_code = 'STATION-004');

INSERT INTO charging_stations (station_code, name, location, status, power_level, created_at, updated_at)
SELECT 'STATION-005', 'C区充电位1', 'C区中央', 'MAINTENANCE', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM charging_stations WHERE station_code = 'STATION-005');

INSERT INTO robots (robot_code, name, current_battery, battery_capacity, current_task, location, is_online, last_heartbeat, created_at, updated_at)
SELECT 'ROBOT-001', '拣货机器人1号', 85, 100, '拣货任务A-123', 'A区货架3', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM robots WHERE robot_code = 'ROBOT-001');

INSERT INTO robots (robot_code, name, current_battery, battery_capacity, current_task, location, is_online, last_heartbeat, created_at, updated_at)
SELECT 'ROBOT-002', '拣货机器人2号', 45, 100, '拣货任务B-456', 'B区货架7', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM robots WHERE robot_code = 'ROBOT-002');

INSERT INTO robots (robot_code, name, current_battery, battery_capacity, current_task, location, is_online, last_heartbeat, created_at, updated_at)
SELECT 'ROBOT-003', '搬运机器人1号', 15, 100, '搬运任务C-789', 'C区过道', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM robots WHERE robot_code = 'ROBOT-003');

INSERT INTO robots (robot_code, name, current_battery, battery_capacity, current_task, location, is_online, last_heartbeat, created_at, updated_at)
SELECT 'ROBOT-004', '夜间巡逻机器人', 8, 100, '夜间巡逻', '仓库外围', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM robots WHERE robot_code = 'ROBOT-004');
