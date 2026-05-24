INSERT INTO areas (area_code, area_name, description, active, created_at, updated_at)
VALUES ('A001', '东城区', '市中心区域', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO areas (area_code, area_name, description, active, created_at, updated_at)
VALUES ('A002', '西城区', '商业中心', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO areas (area_code, area_name, description, active, created_at, updated_at)
VALUES ('A003', '朝阳区', 'CBD区域', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO forbidden_locations (location_code, location_name, area_code, reason, active, created_at, updated_at)
VALUES ('F001', '政府大门口', 'A001', '禁停区域，影响交通', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO forbidden_locations (location_code, location_name, area_code, reason, active, created_at, updated_at)
VALUES ('F002', '医院急诊入口', 'A001', '急救通道', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO forbidden_locations (location_code, location_name, area_code, reason, active, created_at, updated_at)
VALUES ('F003', '学校正门', 'A002', '学生安全考虑', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO vehicles (vehicle_no, area_code, location, location_code, battery_level, current_battery_no, rider_name, active, created_at, updated_at)
VALUES ('V001', 'A001', '东单路口', 'L001', 15, 'B001', '张三', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO vehicles (vehicle_no, area_code, location, location_code, battery_level, current_battery_no, rider_name, active, created_at, updated_at)
VALUES ('V002', 'A001', '政府大门口', 'F001', 18, 'B002', '李四', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO vehicles (vehicle_no, area_code, location, location_code, battery_level, current_battery_no, rider_name, active, created_at, updated_at)
VALUES ('V003', 'A002', '西单商场', 'L002', 25, 'B003', '王五', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO batteries (battery_no, battery_level, status, area_code, current_vehicle_no, active, created_at, updated_at)
VALUES ('B101', 100, '可用', 'A001', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO batteries (battery_no, battery_level, status, area_code, current_vehicle_no, active, created_at, updated_at)
VALUES ('B102', 100, '可用', 'A001', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO batteries (battery_no, battery_level, status, area_code, current_vehicle_no, active, created_at, updated_at)
VALUES ('B103', 100, '可用', 'A002', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO batteries (battery_no, battery_level, status, area_code, current_vehicle_no, active, created_at, updated_at)
VALUES ('B104', 100, '可用', 'A002', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO dispatchers (dispatcher_no, name, phone, area_code, active, created_at, updated_at)
VALUES ('D001', '张配送', '13800138001', 'A001', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO dispatchers (dispatcher_no, name, phone, area_code, active, created_at, updated_at)
VALUES ('D002', '李配送', '13800138002', 'A001', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO dispatchers (dispatcher_no, name, phone, area_code, active, created_at, updated_at)
VALUES ('D003', '王配送', '13800138003', 'A002', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
