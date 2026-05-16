const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/anonymization.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  const datasetId1 = uuidv4();
  const datasetId2 = uuidv4();
  const ruleId1 = uuidv4();
  const sampleId1 = uuidv4();
  const sampleId2 = uuidv4();

  db.run(`
    INSERT INTO datasets (id, name, description, data_source, record_count, fields, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [datasetId1, '用户信息数据集-2024Q1', '包含用户基本信息的数据集', 'CRM系统', 10000, JSON.stringify(['name', 'phone', 'email', 'id_card']), 'pending']);

  db.run(`
    INSERT INTO datasets (id, name, description, data_source, record_count, fields, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [datasetId2, '交易记录数据集-2024Q1', '用户交易流水数据', '交易系统', 50000, JSON.stringify(['user_id', 'amount', 'time', 'merchant']), 'processing']);

  db.run(`
    INSERT INTO anonymization_rules (id, version, name, description, rule_type, config, is_active, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [ruleId1, 1, '手机号脱敏规则', '对手机号中间4位进行脱敏处理', 'masking', JSON.stringify({ pattern: '****', start: 3, length: 4 }), 1, 'admin']);

  db.run(`
    INSERT INTO risk_samples (id, dataset_id, sample_data, risk_level, risk_type, identified_fields, confidence_score, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [sampleId1, datasetId1, '{"name":"张三","phone":"13812345678","id_card":"110101199001011234"}', 'high', 'personal_identity', JSON.stringify(['phone', 'id_card']), 0.95, 'pending']);

  db.run(`
    INSERT INTO risk_samples (id, dataset_id, sample_data, risk_level, risk_type, identified_fields, confidence_score, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [sampleId2, datasetId1, '{"name":"李四","email":"lisi@example.com"}', 'medium', 'personal_contact', JSON.stringify(['email']), 0.75, 'reviewing']);

  console.log('示例数据初始化完成');
  console.log('数据集ID:', datasetId1, datasetId2);
  console.log('规则ID:', ruleId1);
  console.log('风险样本ID:', sampleId1, sampleId2);
  
  db.close();
});