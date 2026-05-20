const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'consent.db');
const db = new sqlite3.Database(dbPath);

const templates = [
  {
    version: 'v1.0',
    title: '手术知情同意书',
    content: '本人已知晓手术风险，同意接受手术治疗。',
    applicable_scope: '所有手术患者',
    published_by: 'admin'
  },
  {
    version: 'v2.0',
    title: '手术知情同意书(修订版)',
    content: '本人已知晓手术风险及术后注意事项，同意接受手术治疗。已更新新增风险说明。',
    applicable_scope: '所有手术患者',
    published_by: 'admin'
  }
];

const signatures = [
  {
    patient_id: 'P001',
    patient_name: '张三',
    template_version: 'v1.0',
    signature_data: 'signature_p001_v1_abc123'
  },
  {
    patient_id: 'P002',
    patient_name: '李四',
    template_version: 'v2.0',
    signature_data: 'signature_p002_v2_def456'
  },
  {
    patient_id: 'P003',
    patient_name: '王五',
    template_version: 'v1.0',
    signature_data: 'signature_p003_v1_ghi789'
  }
];

const withdrawnSignature = {
  patient_id: 'P003',
  patient_name: '王五',
  template_version: 'v2.0',
  signature_data: 'signature_p003_v2_jkl012',
  status: 'withdrawn',
  withdrawn_reason: '信息有误撤回重签'
};

const resignTask = {
  patient_id: 'P001',
  patient_name: '张三',
  old_template_version: 'v1.0',
  new_template_version: 'v2.0',
  reason: '模板已更新至v2.0，需重新签署'
};

function run() {
  db.serialize(() => {
    console.log('开始初始化测试数据...\n');

    const now = new Date();
    const v1Time = new Date(now.getTime() - 86400000).toISOString();
    const v2Time = now.toISOString();

    const stmtTpl = db.prepare('INSERT OR IGNORE INTO templates (version, title, content, applicable_scope, published_by, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    stmtTpl.run('v1.0', '手术知情同意书', '本人已知晓手术风险，同意接受手术治疗。', '所有手术患者', 'admin', v1Time);
    console.log('✓ 模板 v1.0 已添加');
    stmtTpl.run('v2.0', '手术知情同意书(修订版)', '本人已知晓手术风险及术后注意事项，同意接受手术治疗。已更新新增风险说明。', '所有手术患者', 'admin', v2Time);
    console.log('✓ 模板 v2.0 已添加');
    stmtTpl.finalize();

    db.get('SELECT id FROM templates WHERE version = ?', ['v1.0'], (err, v1) => {
      db.get('SELECT id FROM templates WHERE version = ?', ['v2.0'], (err, v2) => {
        
        const stmtSig = db.prepare('INSERT OR IGNORE INTO signatures (template_id, template_version, patient_id, patient_name, signature_data) VALUES (?, ?, ?, ?, ?)');
        
        stmtSig.run(v1.id, 'v1.0', 'P001', '张三', 'signature_p001_v1_abc123');
        console.log('✓ P001(张三) 签署 v1.0 - 旧版已签');
        
        stmtSig.run(v2.id, 'v2.0', 'P002', '李四', 'signature_p002_v2_def456');
        console.log('✓ P002(李四) 签署 v2.0 - 新版已签(无需补签)');
        
        stmtSig.run(v1.id, 'v1.0', 'P003', '王五', 'signature_p003_v1_old');
        console.log('✓ P003(王五) 签署 v1.0 (历史记录)');

        const stmtWithdraw = db.prepare(`
          INSERT OR IGNORE INTO signatures 
          (template_id, template_version, patient_id, patient_name, signature_data, status, withdrawn_at, withdrawn_reason) 
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        `);
        stmtWithdraw.run(v2.id, 'v2.0', 'P003', '王五', 'signature_p003_v2_withdrawn', 'withdrawn', '信息有误撤回重签');
        console.log('✓ P003(王五) 撤回 v2.0 - 撤回后重签场景');

        stmtSig.run(v1.id, 'v1.0', 'P003', '王五', 'signature_p003_v1_ghi789');
        console.log('✓ P003(王五) 重签 v1.0 - 当前有效版本');
        
        stmtSig.finalize();
        stmtWithdraw.finalize();

        const stmtTask = db.prepare(`
          INSERT OR IGNORE INTO resign_tasks 
          (patient_id, patient_name, old_template_id, old_template_version, new_template_id, new_template_version, reason) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmtTask.run('P001', '张三', v1.id, 'v1.0', v2.id, 'v2.0', '模板已更新至v2.0，需重新签署');
        console.log('✓ P001(张三) 补签任务已创建 - 新版未签场景');
        stmtTask.finalize();

        console.log('\n✅ 测试数据初始化完成！');
        console.log('\n测试患者:');
        console.log('  P001 - 张三: 旧版(v1.0)已签，新版(v2.0)未签，有补签任务');
        console.log('  P002 - 李四: 已签最新版(v2.0)，无需补签');
        console.log('  P003 - 王五: 有撤回记录，当前有效版本v1.0');
        
        db.close();
      });
    });
  });
}

run();