const { getDatabase, closeDatabase } = require('../config/database');

const db = getDatabase();

db.transaction(() => {
  db.exec(`
    INSERT OR REPLACE INTO departments (id, name, code) VALUES
      (1, '口腔内科', 'DEN-INT'),
      (2, '口腔外科', 'DEN-SUR'),
      (3, '口腔修复科', 'DEN-PRO'),
      (4, '口腔正畸科', 'DEN-ORT');

    INSERT OR REPLACE INTO materials (id, name, code, unit, category, current_stock, min_stock, max_stock, price, description) VALUES
      (1, '高速车针', 'MAT-001', '支', '钻针类', 8, 10, 50, 15.5, '高速涡轮手机用车针'),
      (2, '低速车针', 'MAT-002', '支', '钻针类', 25, 10, 50, 12.0, '低速手机用车针'),
      (3, '一次性口腔检查盘', 'MAT-003', '套', '检查类', 150, 30, 200, 5.0, '一次性口腔检查套装'),
      (4, '光固化复合树脂', 'MAT-004', '支', '充填材料', 3, 10, 30, 85.0, '3M 光固化复合树脂'),
      (5, '酸蚀剂', 'MAT-005', '瓶', '充填材料', 12, 10, 30, 45.0, '37%磷酸酸蚀剂'),
      (6, '粘接剂', 'MAT-006', '瓶', '充填材料', 5, 10, 30, 120.0, '牙科粘接剂'),
      (7, '一次性手套', 'MAT-007', '盒', '防护类', 8, 10, 50, 25.0, '医用检查手套'),
      (8, '一次性口罩', 'MAT-008', '盒', '防护类', 45, 20, 100, 18.0, '医用外科口罩'),
      (9, '根管锉', 'MAT-009', '盒', '根管治疗', 6, 10, 30, 95.0, '镍钛根管锉'),
      (10, '冲洗针', 'MAT-010', '盒', '根管治疗', 20, 10, 50, 35.0, '根管冲洗针头');

    INSERT OR REPLACE INTO treatments (id, name, code, description, duration_minutes, is_active) VALUES
      (1, '常规补牙', 'TRT-001', '龋齿充填治疗', 45, 1),
      (2, '根管治疗', 'TRT-002', '牙髓病治疗', 90, 1),
      (3, '拔牙术', 'TRT-003', '牙齿拔除术', 30, 1),
      (4, '洗牙', 'TRT-004', '超声波洁牙', 30, 1),
      (5, '牙齿美白', 'TRT-005', '冷光美白', 60, 1);

    INSERT OR REPLACE INTO treatment_materials (id, treatment_id, material_id, quantity, notes) VALUES
      (1, 1, 1, 1, '去腐用车针'),
      (2, 1, 3, 1, '检查盘'),
      (3, 1, 4, 1, '充填树脂'),
      (4, 1, 5, 1, '酸蚀剂'),
      (5, 1, 6, 1, '粘接剂'),
      (6, 2, 9, 2, '根管预备'),
      (7, 2, 10, 1, '根管冲洗'),
      (8, 2, 3, 1, '检查盘'),
      (9, 3, 3, 1, '检查盘'),
      (10, 3, 2, 1, '拔牙备洞'),
      (11, 4, 3, 1, '检查盘'),
      (12, 5, 3, 1, '检查盘');
  `);
})();

console.log('✓ 样例数据导入完成');
closeDatabase();
