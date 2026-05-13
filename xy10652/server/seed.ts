import db from './database';
import { v4 as uuidv4 } from 'uuid';

export const seedData = () => {
  const hasData = db.prepare('SELECT COUNT(*) as count FROM suppliers').get() as any;
  if (hasData.count > 0) return;

  const supplierId1 = uuidv4();
  const supplierId2 = uuidv4();
  const supplierId3 = uuidv4();

  db.prepare(`
    INSERT INTO suppliers (id, code, name, contact_person, phone, email, address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(supplierId1, 'SUP001', '深圳电子科技有限公司', '张三', '13800138001', 'zhangsan@szdz.com', '深圳市南山区科技园');

  db.prepare(`
    INSERT INTO suppliers (id, code, name, contact_person, phone, email, address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(supplierId2, 'SUP002', '东莞五金制品厂', '李四', '13800138002', 'lisi@dgwj.com', '东莞市长安镇工业区');

  db.prepare(`
    INSERT INTO suppliers (id, code, name, contact_person, phone, email, address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(supplierId3, 'SUP003', '广州塑胶材料公司', '王五', '13800138003', 'wangwu@gzsj.com', '广州市黄埔区开发区');

  const batchId1 = uuidv4();
  const batchId2 = uuidv4();
  const batchId3 = uuidv4();
  const batchId4 = uuidv4();

  db.prepare(`
    INSERT INTO sample_batches (id, batch_no, supplier_id, product_name, sample_type, quantity, receive_date, status, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(batchId1, 'BATCH202401001', supplierId1, '智能手机壳', '首样', 50, '2024-01-15', 'reviewing', '1.2');

  db.prepare(`
    INSERT INTO sample_batches (id, batch_no, supplier_id, product_name, sample_type, quantity, receive_date, status, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(batchId2, 'BATCH202401002', supplierId2, '金属支架', '确认样', 30, '2024-01-18', 'finalized', '2.0');

  db.prepare(`
    INSERT INTO sample_batches (id, batch_no, supplier_id, product_name, sample_type, quantity, receive_date, status, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(batchId3, 'BATCH202401003', supplierId3, '塑胶外壳', '首样', 100, '2024-01-20', 'pending', '1.0');

  db.prepare(`
    INSERT INTO sample_batches (id, batch_no, supplier_id, product_name, sample_type, quantity, receive_date, status, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(batchId4, 'BATCH202401004', supplierId1, '充电器', '确认样', 20, '2024-01-22', 'reviewing', '1.1');

  db.prepare(`
    INSERT INTO review_scores (id, batch_id, reviewer, review_date, appearance_score, quality_score, function_score, packaging_score, total_score, comments, result, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), batchId1, '赵六', '2024-01-16', 18, 17, 19, 16, 70, '颜色略有偏差，建议调整', 'pending', '1.0');

  db.prepare(`
    INSERT INTO review_scores (id, batch_id, reviewer, review_date, appearance_score, quality_score, function_score, packaging_score, total_score, comments, result, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), batchId1, '赵六', '2024-01-19', 20, 19, 20, 18, 77, '颜色已修正，符合要求', 'pass', '1.2');

  db.prepare(`
    INSERT INTO review_scores (id, batch_id, reviewer, review_date, appearance_score, quality_score, function_score, packaging_score, total_score, comments, result, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), batchId2, '钱七', '2024-01-19', 20, 20, 20, 20, 80, '完美符合要求', 'pass', '2.0');

  db.prepare(`
    INSERT INTO review_scores (id, batch_id, reviewer, review_date, appearance_score, quality_score, function_score, packaging_score, total_score, comments, result, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), batchId4, '赵六', '2024-01-23', 19, 18, 17, 18, 72, '充电效率需提升', 'pending', '1.0');

  db.prepare(`
    INSERT INTO review_scores (id, batch_id, reviewer, review_date, appearance_score, quality_score, function_score, packaging_score, total_score, comments, result, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), batchId4, '赵六', '2024-01-25', 19, 19, 19, 18, 75, '效率已达标', 'pending', '1.1');

  db.prepare(`
    INSERT INTO rectification_opinions (id, batch_id, item, description, requirement, deadline, responsible_person, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), batchId1, '颜色偏差', '产品颜色与设计稿存在明显偏差', '按照Pantone 186C色号调整', '2024-01-20', '张三', 'completed');

  db.prepare(`
    INSERT INTO rectification_opinions (id, batch_id, item, description, requirement, deadline, responsible_person, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), batchId4, '充电效率', '充电效率低于标准要求', '提升效率至90%以上', '2024-01-28', '张三', 'in_progress');

  db.prepare(`
    INSERT INTO reship_logistics (id, batch_id, tracking_no, courier_company, ship_date, receive_date, status, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), batchId1, 'SF1234567890', '顺丰速运', '2024-01-17', '2024-01-18', 'received', '二次寄样，颜色已修正');

  db.prepare(`
    INSERT INTO reship_logistics (id, batch_id, tracking_no, courier_company, ship_date, receive_date, status, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), batchId4, 'SF0987654321', '顺丰速运', '2024-01-24', '2024-01-25', 'received', '改进版样品');

  db.prepare(`
    INSERT INTO version_finalizations (id, batch_id, final_version, finalizer, finalize_date, remarks)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), batchId2, '2.0', '孙八', '2024-01-20', '所有指标达标，正式定版');

  console.log('测试数据初始化完成');
};
