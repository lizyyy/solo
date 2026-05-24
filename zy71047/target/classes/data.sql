INSERT INTO farm (farm_code, farm_name, address, contact_person, contact_phone) VALUES
('F001', '内蒙古呼伦贝尔牧场', '内蒙古呼伦贝尔市新巴尔虎左旗', '巴特尔', '13800138001'),
('F002', '锡林郭勒盟牧', '内蒙古锡林郭勒盟东乌珠穆沁旗', '斯琴', '13800138002'),
('F003', '河北承德牧场', '河北省承德市围场满族蒙古族自治县', '张建国', '13800138003');

INSERT INTO ear_tag (tag_no, cattle_type, breed, gender, origin_farm_id, current_farm_id, status) VALUES
('E0001', '肉牛', '西门塔尔', '公牛', 1, 1, 'NORMAL'),
('E0002', '肉牛', '西门塔尔', '母牛', 1, 1, 'NORMAL'),
('E0003', '肉牛', '夏洛莱', '公牛', 1, 1, 'NORMAL'),
('E0004', '肉牛', '夏洛莱', '母牛', 1, 1, 'NORMAL'),
('E0005', '肉牛', '利木赞', '公牛', 1, 1, 'NORMAL'),
('E0006', '奶牛', '荷斯坦', '母牛', 2, 2, 'NORMAL'),
('E0007', '奶牛', '荷斯坦', '母牛', 2, 2, 'NORMAL'),
('E0008', '奶牛', '娟姗牛', '母牛', 2, 2, 'NORMAL'),
('E0009', '肉牛', '安格斯', '公牛', 3, 3, 'NORMAL'),
('E0010', '肉牛', '安格斯', '母牛', 3, 3, 'NORMAL');

INSERT INTO quarantine_certificate (certificate_no, issuing_authority, issue_date, expire_date, farm_id, cattle_count, status) VALUES
('Q20240501001', '内蒙古动物卫生监督所', '2024-05-01', '2026-12-31', 1, 50, 'VALID'),
('Q20240501002', '锡林郭勒盟动物卫生监督所', '2024-05-01', '2024-05-30', 2, 30, 'VALID'),
('Q20240301001', '承德市动物卫生监督所', '2024-03-01', '2024-03-31', 3, 20, 'EXPIRED');

INSERT INTO transport_vehicle (plate_no, driver_name, driver_phone, vehicle_type, capacity, status) VALUES
('蒙A12345', '王师傅', '13900139001', '大型牲畜运输车', 50, 'AVAILABLE'),
('蒙B67890', '李师傅', '13900139002', '中型牲畜运输车', 30, 'AVAILABLE'),
('冀C11111', '张师傅', '13900139003', '大型牲畜运输车', 60, 'MAINTENANCE');
