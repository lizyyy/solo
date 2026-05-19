const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'appeal.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  const reviewers = [
    { id: 'r1', name: '张三', email: 'zhangsan@example.com', department: '审核一组' },
    { id: 'r2', name: '李四', email: 'lisi@example.com', department: '审核二组' },
    { id: 'r3', name: '王五', email: 'wangwu@example.com', department: '审核一组' }
  ];

  const reviewerStmt = db.prepare(`INSERT OR IGNORE INTO reviewers (id, name, email, department) VALUES (?, ?, ?, ?)`);
  reviewers.forEach(r => {
    reviewerStmt.run(r.id, r.name, r.email, r.department);
  });
  reviewerStmt.finalize();
  console.log('审核人员数据已插入');

  const contents = [
    {
      id: 'c1',
      contentType: 'post',
      contentText: '这是一条被误拦截的正常帖子，内容是关于科技新闻的分享',
      authorId: 'u1',
      authorName: '科技爱好者',
      blockTime: new Date().toISOString()
    },
    {
      id: 'c2',
      contentType: 'comment',
      contentText: '这条评论只是正常的讨论，没有违规内容',
      authorId: 'u2',
      authorName: '普通用户A',
      blockTime: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'c3',
      contentType: 'image',
      contentText: '一张普通的风景照片，被模型误判了',
      authorId: 'u3',
      authorName: '摄影师小王',
      blockTime: new Date(Date.now() - 7200000).toISOString()
    }
  ];

  const contentStmt = db.prepare(`INSERT OR IGNORE INTO content_items (id, content_type, content_text, author_id, author_name, block_time) VALUES (?, ?, ?, ?, ?, ?)`);
  contents.forEach(c => {
    contentStmt.run(c.id, c.contentType, c.contentText, c.authorId, c.authorName, c.blockTime);
  });
  contentStmt.finalize();
  console.log('内容数据已插入');

  const tags = [
    { contentId: 'c1', code: 'POLITICS', name: '政治敏感', confidence: 0.85 },
    { contentId: 'c1', code: 'AD', name: '广告内容', confidence: 0.72 },
    { contentId: 'c2', code: 'SPAM', name: '垃圾信息', confidence: 0.68 },
    { contentId: 'c3', code: 'PORN', name: '色情内容', confidence: 0.91 }
  ];

  const tagStmt = db.prepare(`INSERT INTO audit_tags (content_id, tag_code, tag_name, confidence) VALUES (?, ?, ?, ?)`);
  tags.forEach(t => {
    tagStmt.run(t.contentId, t.code, t.name, t.confidence);
  });
  tagStmt.finalize();
  console.log('审核标签数据已插入');

  const modelReasons = [
    {
      contentId: 'c1',
      modelVersion: 'v2.3.1',
      reasonCode: 'R001',
      reasonDetail: '模型检测到疑似政治敏感词汇',
      riskLevel: 'high'
    },
    {
      contentId: 'c2',
      modelVersion: 'v2.3.1',
      reasonCode: 'R002',
      reasonDetail: '模型检测到疑似垃圾信息特征',
      riskLevel: 'medium'
    },
    {
      contentId: 'c3',
      modelVersion: 'v2.3.1',
      reasonCode: 'R003',
      reasonDetail: '图像分类模型检测到不适宜内容',
      riskLevel: 'high'
    }
  ];

  const reasonStmt = db.prepare(`INSERT INTO model_reasons (content_id, model_version, reason_code, reason_detail, risk_level) VALUES (?, ?, ?, ?, ?)`);
  modelReasons.forEach(r => {
    reasonStmt.run(r.contentId, r.modelVersion, r.reasonCode, r.reasonDetail, r.riskLevel);
  });
  reasonStmt.finalize();
  console.log('模型原因数据已插入');

  const appeals = [
    {
      id: 'a1',
      contentId: 'c1',
      submitterId: 'u1',
      submitterName: '科技爱好者',
      submitterContact: '13800138000',
      appealReason: '这只是正常的科技新闻分享，不包含任何政治敏感内容，请重新审核。',
      evidenceMaterials: '附上原文链接和相关证明材料',
      status: 'pending'
    },
    {
      id: 'a2',
      contentId: 'c2',
      submitterId: 'u2',
      submitterName: '普通用户A',
      submitterContact: '13900139000',
      appealReason: '我只是在正常讨论，没有发布垃圾信息，请解除拦截。',
      evidenceMaterials: null,
      status: 'reviewing',
      assigneeId: 'r1',
      assigneeName: '张三'
    },
    {
      id: 'a3',
      contentId: 'c3',
      submitterId: 'u3',
      submitterName: '摄影师小王',
      submitterContact: '13700137000',
      appealReason: '这是我拍摄的风景照片，绝对不包含任何违规内容，请尽快恢复。',
      evidenceMaterials: '原图已保存，可供查验',
      status: 'approved',
      assigneeId: 'r2',
      assigneeName: '李四',
      disposalType: 'restore',
      disposalNote: '经审核，确认是误拦截，已恢复内容展示'
    }
  ];

  const appealStmt = db.prepare(`INSERT OR IGNORE INTO appeals (id, content_id, submitter_id, submitter_name, submitter_contact, appeal_reason, evidence_materials, status, assignee_id, assignee_name, disposal_type, disposal_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  appeals.forEach(a => {
    appealStmt.run(a.id, a.contentId, a.submitterId, a.submitterName, a.submitterContact, a.appealReason, a.evidenceMaterials, a.status, a.assigneeId, a.assigneeName, a.disposalType, a.disposalNote);
  });
  appealStmt.finalize();
  console.log('申诉数据已插入');

  const auditTrails = [
    {
      appealId: 'a1',
      action: 'create',
      operatorId: 'u1',
      operatorName: '科技爱好者',
      remark: '提交申诉申请',
      oldStatus: null,
      newStatus: 'pending'
    },
    {
      appealId: 'a2',
      action: 'create',
      operatorId: 'u2',
      operatorName: '普通用户A',
      remark: '提交申诉申请',
      oldStatus: null,
      newStatus: 'pending'
    },
    {
      appealId: 'a2',
      action: 'assign',
      operatorId: 'admin',
      operatorName: '系统管理员',
      remark: '分派给审核员: 张三',
      oldStatus: 'pending',
      newStatus: 'reviewing'
    },
    {
      appealId: 'a3',
      action: 'create',
      operatorId: 'u3',
      operatorName: '摄影师小王',
      remark: '提交申诉申请',
      oldStatus: null,
      newStatus: 'pending'
    },
    {
      appealId: 'a3',
      action: 'assign',
      operatorId: 'admin',
      operatorName: '系统管理员',
      remark: '分派给审核员: 李四',
      oldStatus: 'pending',
      newStatus: 'reviewing'
    },
    {
      appealId: 'a3',
      action: 'approve',
      operatorId: 'r2',
      operatorName: '李四',
      remark: '经审核，确认是误拦截，已恢复内容展示',
      oldStatus: 'reviewing',
      newStatus: 'approved'
    }
  ];

  const trailStmt = db.prepare(`INSERT INTO audit_trail (appeal_id, action, operator_id, operator_name, remark, old_status, new_status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  auditTrails.forEach(t => {
    trailStmt.run(t.appealId, t.action, t.operatorId, t.operatorName, t.remark, t.oldStatus, t.newStatus);
  });
  trailStmt.finalize();
  console.log('审核轨迹数据已插入');

  db.run(`UPDATE content_items SET content_status = 'appealed' WHERE id IN ('c1', 'c2')`);
  db.run(`UPDATE content_items SET content_status = 'restored' WHERE id = 'c3'`);
  console.log('内容状态已更新');
});

db.close(() => {
  console.log('演示数据初始化完成！');
});
