const { db, initDatabase, closeDatabase } = require('./database');

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function seed() {
  await initDatabase();
  console.log('开始插入种子数据...');

  await runAsync('DELETE FROM review_records');
  await runAsync('DELETE FROM scan_results');
  await runAsync('DELETE FROM vulnerability_rules');
  await runAsync('DELETE FROM repositories');

  const repo1 = await runAsync(
    'INSERT INTO repositories (name, url) VALUES (?, ?)',
    ['frontend-webapp', 'https://github.com/example/frontend-webapp']
  );
  const repo2 = await runAsync(
    'INSERT INTO repositories (name, url) VALUES (?, ?)',
    ['backend-api', 'https://github.com/example/backend-api']
  );

  await runAsync(
    'INSERT INTO vulnerability_rules (rule_id, name, description, severity, version) VALUES (?, ?, ?, ?, ?)',
    ['SQLI-001', 'SQL注入漏洞', '用户输入未经过滤直接拼接SQL语句', 'CRITICAL', '1.0']
  );
  await runAsync(
    'INSERT INTO vulnerability_rules (rule_id, name, description, severity, version) VALUES (?, ?, ?, ?, ?)',
    ['XSS-002', '跨站脚本漏洞', '输出内容未进行HTML编码', 'HIGH', '1.2']
  );
  await runAsync(
    'INSERT INTO vulnerability_rules (rule_id, name, description, severity, version) VALUES (?, ?, ?, ?, ?)',
    ['AUTH-003', '硬编码凭证', '代码中包含硬编码的密码或密钥', 'HIGH', '2.0']
  );

  const scan1 = await runAsync(
    'INSERT INTO scan_results (repository_id, rule_id, file_path, line_number, commit_hash, status) VALUES (?, ?, ?, ?, ?, ?)',
    [repo1.lastID, 'SQLI-001', 'src/db/connection.js', 42, 'abc123def456', 'OPEN']
  );

  const scan2 = await runAsync(
    'INSERT INTO scan_results (repository_id, rule_id, file_path, line_number, commit_hash, status) VALUES (?, ?, ?, ?, ?, ?)',
    [repo1.lastID, 'XSS-002', 'src/components/UserProfile.js', 128, 'abc123def456', 'REVIEWING']
  );

  const scan3 = await runAsync(
    'INSERT INTO scan_results (repository_id, rule_id, file_path, line_number, commit_hash, status) VALUES (?, ?, ?, ?, ?, ?)',
    [repo2.lastID, 'AUTH-003', 'config/database.js', 15, 'xyz789abc123', 'FALSE_POSITIVE']
  );

  const scan4 = await runAsync(
    'INSERT INTO scan_results (repository_id, rule_id, file_path, line_number, commit_hash, status) VALUES (?, ?, ?, ?, ?, ?)',
    [repo2.lastID, 'SQLI-001', 'src/api/users.js', 89, 'xyz789abc123', 'OPEN']
  );

  await runAsync(
    `INSERT INTO review_records 
    (scan_result_id, reviewer, review_type, comment, previous_status, new_status, rule_version_at_review, file_path_at_review)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [scan3.lastID, 'zhang.san', 'SUBMIT', '提交复核，请确认是否为误报', 'OPEN', 'REVIEWING', '2.0', 'config/database.js']
  );

  await runAsync(
    `INSERT INTO review_records 
    (scan_result_id, reviewer, review_type, comment, previous_status, new_status, rule_version_at_review, file_path_at_review)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [scan3.lastID, 'li.si', 'CLOSE', '经核实，此处密码为环境变量占位符，确认为误报', 'REVIEWING', 'FALSE_POSITIVE', '2.0', 'config/database.js']
  );

  await runAsync(
    `INSERT INTO review_records 
    (scan_result_id, reviewer, review_type, comment, previous_status, new_status, rule_version_at_review, file_path_at_review)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [scan2.lastID, 'wang.wu', 'SUBMIT', '需要复核此XSS告警', 'OPEN', 'REVIEWING', '1.2', 'src/components/UserProfile.js']
  );

  const scan5 = await runAsync(
    'INSERT INTO scan_results (repository_id, rule_id, file_path, line_number, commit_hash, status) VALUES (?, ?, ?, ?, ?, ?)',
    [repo2.lastID, 'AUTH-003', 'src/config/db.js', 15, 'newcommit456', 'OPEN']
  );

  await runAsync(
    `INSERT INTO review_records 
    (scan_result_id, reviewer, review_type, comment, previous_status, new_status, rule_version_at_review, file_path_at_review)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [scan5.lastID, 'zhao.liu', 'SUBMIT', '相同规则但文件路径变动，需要重新复核', 'OPEN', 'REVIEWING', '2.0', 'src/config/db.js']
  );

  const scan6 = await runAsync(
    'INSERT INTO scan_results (repository_id, rule_id, file_path, line_number, commit_hash, status) VALUES (?, ?, ?, ?, ?, ?)',
    [repo2.lastID, 'AUTH-003', 'config/database.js', 15, 'updatedcommit789', 'OPEN']
  );

  await runAsync(
    'INSERT INTO vulnerability_rules (rule_id, name, description, severity, version) VALUES (?, ?, ?, ?, ?)',
    ['AUTH-003-v2', '硬编码凭证检测增强', '增强检测逻辑，支持更多场景', 'HIGH', '2.1']
  );

  const scan7 = await runAsync(
    'INSERT INTO scan_results (repository_id, rule_id, file_path, line_number, commit_hash, status) VALUES (?, ?, ?, ?, ?, ?)',
    [repo2.lastID, 'AUTH-003-v2', 'config/database.js', 15, 'updatedcommit789', 'OPEN']
  );

  await runAsync(
    `INSERT INTO review_records 
    (scan_result_id, reviewer, review_type, comment, previous_status, new_status, rule_version_at_review, file_path_at_review)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [scan7.lastID, 'qian.qi', 'SUBMIT', '规则升级后重新触发，需要重新复核', 'OPEN', 'REVIEWING', '2.1', 'config/database.js']
  );

  console.log('种子数据插入完成！');
  await closeDatabase();
}

seed().catch(console.error);
