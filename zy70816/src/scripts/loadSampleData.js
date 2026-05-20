const db = require('../config/database');

const loadSampleData = () => {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        console.log('开始加载样例数据...');

        await new Promise((resolve, reject) => {
          db.run('BEGIN TRANSACTION', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        await new Promise((resolve, reject) => {
          db.run(`DELETE FROM approvals`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        await new Promise((resolve, reject) => {
          db.run(`DELETE FROM inventory`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        await new Promise((resolve, reject) => {
          db.run(`DELETE FROM batches`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        await new Promise((resolve, reject) => {
          db.run(`DELETE FROM products`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        await new Promise((resolve, reject) => {
          db.run(`DELETE FROM suppliers`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        await new Promise((resolve, reject) => {
          db.run(`DELETE FROM stores`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        await new Promise((resolve, reject) => {
          db.run(`DELETE FROM transfers`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        await new Promise((resolve, reject) => {
          db.run(`DELETE FROM recalls`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        await new Promise((resolve, reject) => {
          db.run(`DELETE FROM store_confirmations`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        await new Promise((resolve, reject) => {
          db.run(`DELETE FROM substitute_products`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        await new Promise((resolve, reject) => {
          db.run(`DELETE FROM consumption`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        await new Promise((resolve, reject) => {
          db.run(`DELETE FROM audit_logs`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        console.log('插入门店数据...');
        const stores = [
          { code: 'STORE001', name: '北京朝阳门店', address: '北京市朝阳区XX路XX号', contact: '张经理', phone: '13800138001' },
          { code: 'STORE002', name: '上海浦东门店', address: '上海市浦东新区XX路XX号', contact: '李经理', phone: '13800138002' },
          { code: 'STORE003', name: '广州天河门店', address: '广州市天河区XX路XX号', contact: '王经理', phone: '13800138003' }
        ];

        for (const store of stores) {
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO stores (store_code, store_name, address, contact_person, phone) VALUES (?, ?, ?, ?, ?)`,
              [store.code, store.name, store.address, store.contact, store.phone],
              function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
              }
            );
          });
        }

        console.log('插入供应商数据...');
        const suppliers = [
          { code: 'SUP001', name: '北京牙科耗材有限公司', contact: '赵总', phone: '13900139001' },
          { code: 'SUP002', name: '上海医疗器械公司', contact: '钱总', phone: '13900139002' }
        ];

        for (const supplier of suppliers) {
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO suppliers (supplier_code, supplier_name, contact_person, phone) VALUES (?, ?, ?, ?)`,
              [supplier.code, supplier.name, supplier.contact, supplier.phone],
              function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
              }
            );
          });
        }

        console.log('插入产品数据...');
        const products = [
          { code: 'PROD001', name: '牙科种植体', category: '种植类', specification: '直径4.0mm', unit: '颗', price: 1500 },
          { code: 'PROD002', name: '正畸托槽', category: '正畸类', specification: '标准型', unit: '盒', price: 800 },
          { code: 'PROD003', name: '牙科高速手机', category: '设备类', specification: '标准头', unit: '把', price: 1200 },
          { code: 'PROD004', name: '一次性口腔器械盒', category: '耗材类', specification: '200mm', unit: '盒', price: 15 },
          { code: 'PROD005', name: '光固化树脂', category: '修复类', specification: 'A2色', unit: '支', price: 280 }
        ];

        for (const product of products) {
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO products (product_code, product_name, category, specification, unit, price) VALUES (?, ?, ?, ?, ?, ?)`,
              [product.code, product.name, product.category, product.specification, product.unit, product.price],
              function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
              }
            );
          });
        }

        console.log('插入批次数据...');
        const batches = [
          { no: 'BATCH202401001', product_id: 1, supplier_id: 1, production_date: '2024-01-15', expiry_date: '2026-01-15', quantity: 100, status: 'approved', is_frozen: 0 },
          { no: 'BATCH202402001', product_id: 2, supplier_id: 1, production_date: '2024-02-20', expiry_date: '2026-02-20', quantity: 200, status: 'approved', is_frozen: 0 },
          { no: 'BATCH202403001', product_id: 3, supplier_id: 2, production_date: '2024-03-10', expiry_date: '2025-03-10', quantity: 50, status: 'pending', is_frozen: 0 },
          { no: 'BATCH202403002', product_id: 4, supplier_id: 2, production_date: '2024-03-15', expiry_date: '2025-09-15', quantity: 1000, status: 'pending', is_frozen: 0 },
          { no: 'BATCH202404001-FROZEN', product_id: 1, supplier_id: 1, production_date: '2024-04-01', expiry_date: '2026-04-01', quantity: 50, status: 'pending', is_frozen: 1, frozen_reason: '质量抽检不合格，等待供应商复核', frozen_by: '质量管理员-王芳', frozen_at: '2024-05-10 10:30:00' },
          { no: 'BATCH202404002-CORRECT', product_id: 5, supplier_id: 2, production_date: '2024-04-15', expiry_date: '2026-04-15', quantity: 200, status: 'rejected', is_frozen: 0 }
        ];

        for (const batch of batches) {
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO batches (batch_no, product_id, supplier_id, production_date, expiry_date, quantity, status, is_frozen, frozen_reason, frozen_by, frozen_at, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [batch.no, batch.product_id, batch.supplier_id, batch.production_date, batch.expiry_date, batch.quantity, batch.status, batch.is_frozen, batch.frozen_reason, batch.frozen_by, batch.frozen_at, '系统管理员'],
              function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
              }
            );
          });
        }

        console.log('插入库存数据...');
        const inventory = [
          { batch_id: 1, store_id: 1, quantity: 50, location: 'A-01-01' },
          { batch_id: 1, store_id: 2, quantity: 30, location: 'B-01-01' },
          { batch_id: 1, store_id: 3, quantity: 20, location: 'C-01-01' },
          { batch_id: 2, store_id: 1, quantity: 80, location: 'A-01-02' },
          { batch_id: 2, store_id: 2, quantity: 70, location: 'B-01-02' },
          { batch_id: 2, store_id: 3, quantity: 50, location: 'C-01-02' },
          { batch_id: 3, store_id: 1, quantity: 20, location: 'A-02-01' },
          { batch_id: 3, store_id: 2, quantity: 15, location: 'B-02-01' },
          { batch_id: 3, store_id: 3, quantity: 15, location: 'C-02-01' },
          { batch_id: 4, store_id: 1, quantity: 400, location: 'A-03-01' },
          { batch_id: 4, store_id: 2, quantity: 300, location: 'B-03-01' },
          { batch_id: 4, store_id: 3, quantity: 300, location: 'C-03-01' },
          { batch_id: 5, store_id: 1, quantity: 50, location: '隔离区-QA' },
          { batch_id: 6, store_id: 2, quantity: 100, location: '待处理区' }
        ];

        for (const item of inventory) {
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO inventory (batch_id, store_id, quantity, warehouse_location) VALUES (?, ?, ?, ?)`,
              [item.batch_id, item.store_id, item.quantity, item.location],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }

        console.log('插入审批记录（人工修正流程）...');
        const approvals = [
          { batch_id: 6, action: '提交审核', status: 'pending', reason: null, handler: '采购专员-李明', notes: '首次提交，产品资料完整', previous_status: null },
          { batch_id: 6, action: '退回修改', status: 'rejected', reason: '质检报告缺少生产厂家盖章', handler: '质量审核员-张静', notes: '请补充完整的质检报告', previous_status: 'pending' },
          { batch_id: 6, action: '重新提交', status: 'pending', reason: null, handler: '采购专员-李明', notes: '已补充质检报告盖章扫描件', previous_status: 'rejected' }
        ];

        for (const approval of approvals) {
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO approvals (batch_id, action, status, reason, handler, notes, previous_status)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [approval.batch_id, approval.action, approval.status, approval.reason, approval.handler, approval.notes, approval.previous_status],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }

        console.log('插入召回公告数据...');
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO recalls (recall_no, title, content, batch_nos, reason, level, published_date, publisher, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              'RC202405001',
              '关于部分牙科种植体产品的召回通知',
              '# 产品召回公告\n\n## 召回原因\n近期收到临床反馈，部分批次产品在使用过程中出现表面涂层脱落现象。\n\n## 涉及批次\n- BATCH202401001\n\n## 处理要求\n1. 立即停止使用涉及批次产品\n2. 清点库存并登记\n3. 联系供应商办理退换货',
              'BATCH202401001',
              '产品涂层质量问题',
              'warning',
              '2024-05-15',
              '国家医疗器械质量监督检验中心',
              'active'
            ],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        console.log('插入调拨记录...');
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO transfers (transfer_no, batch_id, from_store_id, to_store_id, quantity, reason, status, confirmed_by, confirmed_at, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              'TF202405001',
              4,
              1,
              3,
              100,
              '广州门店库存不足，紧急调拨',
              'confirmed',
              '库管主管-刘强',
              '2024-05-12 09:15:00',
              '调度员-陈晨'
            ],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        console.log('插入替代耗材记录...');
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO substitute_products (original_batch_id, substitute_batch_id, reason, handled_by, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
              5,
              1,
              '原批次质量抽检不合格，使用替代批次供货',
              '采购主管-张伟',
              '2024-05-11 14:20:00'
            ],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        console.log('插入门店确认记录...');
        const confirmations = [
          { batch_id: 5, store_id: 1, type: 'freeze', status: 'pending', notes: '请北京门店确认该批次冻结处理情况', created_by: '质量部' },
          { batch_id: 1, store_id: 2, type: 'recall', status: 'confirmed', notes: '已收到召回通知，库存已隔离', confirmed_by: '上海门店-库管', confirmed_at: '2024-05-16 10:00:00', created_by: '质量部' },
          { batch_id: 6, store_id: 2, type: 'other', status: 'pending', notes: '请确认补充资料是否齐全', created_by: '审核员' }
        ];

        for (const conf of confirmations) {
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO store_confirmations (batch_id, store_id, confirmation_type, status, notes, confirmed_by, confirmed_at, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [conf.batch_id, conf.store_id, conf.type, conf.status, conf.notes, conf.confirmed_by, conf.confirmed_at, conf.created_by],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }

        console.log('插入消耗记录...');
        const consumptions = [
          { store_id: 1, batch_id: 1, date: '2024-05-15', quantity: 5, used_by: '李医生', patient: '张某某-种植牙', notes: '常规种植手术' },
          { store_id: 1, batch_id: 2, date: '2024-05-16', quantity: 10, used_by: '王医生', patient: '刘某某-正畸', notes: '托槽更换' },
          { store_id: 2, batch_id: 1, date: '2024-05-17', quantity: 3, used_by: '陈医生', patient: '赵某某-种植牙', notes: '前牙种植' },
          { store_id: 3, batch_id: 4, date: '2024-05-18', quantity: 50, used_by: '周护士', patient: '日常诊疗', notes: '器械盒消耗' }
        ];

        for (const cons of consumptions) {
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO consumption (store_id, batch_id, consumption_date, quantity, used_by, patient_info, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [cons.store_id, cons.batch_id, cons.date, cons.quantity, cons.used_by, cons.patient, cons.notes],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }

        await new Promise((resolve, reject) => {
          db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        console.log('');
        console.log('========================================');
        console.log('样例数据加载完成！');
        console.log('========================================');
        console.log('');
        console.log('【核心追踪闭环样例说明】');
        console.log('');
        console.log('1. 批号冻结 + 门店确认:');
        console.log('   批号: BATCH202404001-FROZEN');
        console.log('   产品: 牙科种植体');
        console.log('   冻结原因: 质量抽检不合格，等待供应商复核');
        console.log('   冻结人: 质量管理员-王芳');
        console.log('   门店确认: 已发送北京门店确认通知（待处理）');
        console.log('   替代耗材: 已设置替代批次 BATCH202401001');
        console.log('');
        console.log('2. 人工修正审批样例:');
        console.log('   批号: BATCH202404002-CORRECT');
        console.log('   产品: 光固化树脂');
        console.log('   当前状态: 已退回，等待修正');
        console.log('   退回原因: 质检报告缺少生产厂家盖章');
        console.log('   审批流程: 提交审核 → 退回修改 → 重新提交');
        console.log('   门店确认: 已发送上海门店资料确认（待处理）');
        console.log('');
        console.log('3. 召回处理 + 门店确认:');
        console.log('   批号: BATCH202401001');
        console.log('   召回公告: RC202405001');
        console.log('   召回原因: 产品涂层质量问题');
        console.log('   门店确认: 上海门店已确认收到并隔离');
        console.log('');
        console.log('4. 近效期预警:');
        console.log('   批号 BATCH202403001 (牙科高速手机) 将于2025年3月到期');
        console.log('   批号 BATCH202403002 (一次性口腔器械盒) 将于2025年9月到期');
        console.log('');
        console.log('5. 跨门店调拨:');
        console.log('   单号: TF202405001');
        console.log('   内容: 从北京门店调拨100盒一次性器械盒至广州门店');
        console.log('   状态: 已确认');
        console.log('');
        console.log('6. 消耗记录追踪:');
        console.log('   已录入4条消耗记录，包含使用人、患者信息');
        console.log('   支持按门店、批号、日期范围查询汇总');
        console.log('');
        console.log('========================================');
        resolve();
      } catch (err) {
        await new Promise((resolve) => {
          db.run('ROLLBACK', () => resolve());
        });
        reject(err);
      }
    });
  });
};

loadSampleData()
  .then(() => {
    console.log('样例数据加载成功！');
    db.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error('样例数据加载失败:', err);
    db.close();
    process.exit(1);
  });
