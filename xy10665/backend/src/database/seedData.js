const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../../data/complaints.db');
const db = new sqlite3.Database(dbPath);

const contentItems = [
  { id: uuidv4(), title: '如何学习编程 - 完整指南', creator_id: 'creator_001', creator_name: '张三', status: 'active' },
  { id: uuidv4(), title: '美食探店：北京最好吃的火锅', creator_id: 'creator_002', creator_name: '李四', status: 'taken_down' },
  { id: uuidv4(), title: '2024年科技趋势预测', creator_id: 'creator_003', creator_name: '王五', status: 'active' },
  { id: uuidv4(), title: '旅行Vlog：云南大理三日游', creator_id: 'creator_004', creator_name: '赵六', status: 'active' },
  { id: uuidv4(), title: '健身教程：30天练出马甲线', creator_id: 'creator_005', creator_name: '钱七', status: 'taken_down' },
];

const rightsHolders = [
  { id: uuidv4(), name: '某科技出版社', contact_person: '王经理', phone: '13800138001', email: 'rights@techpub.com', id_card: null, company_name: '某科技出版社', business_license: 'license_001.jpg', verification_status: 'verified' },
  { id: uuidv4(), name: '影视传媒有限公司', contact_person: '李主任', phone: '13800138002', email: 'copyright@mediacompany.com', id_card: null, company_name: '影视传媒有限公司', business_license: 'license_002.jpg', verification_status: 'verified' },
  { id: uuidv4(), name: '个人创作者 - 陈某某', contact_person: '陈某', phone: '13800138003', email: 'chen@example.com', id_card: 'id_card_003.jpg', company_name: null, business_license: null, verification_status: 'pending' },
];

const complaints = [
  { 
    id: uuidv4(), 
    content_id: contentItems[0].id, 
    holder_id: rightsHolders[0].id,
    complaint_reason: '版权侵权',
    complaint_details: '该文章大量抄袭我社出版的《编程入门指南》一书，未经授权使用',
    current_status: 'takedown',
    handler: '审核员A',
    handled_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: uuidv4(),
    content_id: contentItems[1].id,
    holder_id: rightsHolders[1].id,
    complaint_reason: '肖像权侵权',
    complaint_details: '该视频中未经授权使用了我公司艺人的肖像，用于商业宣传',
    current_status: 'appealed',
    handler: '审核员B',
    handled_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: uuidv4(),
    content_id: contentItems[4].id,
    holder_id: rightsHolders[0].id,
    complaint_reason: '版权侵权',
    complaint_details: '该健身教程抄袭了我们的独家课程内容',
    current_status: 'takedown',
    handler: '审核员A',
    handled_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: uuidv4(),
    content_id: contentItems[2].id,
    holder_id: rightsHolders[1].id,
    complaint_reason: '商标侵权',
    complaint_details: '文章中错误使用我公司注册商标',
    current_status: 'rejected',
    handler: '审核员C',
    handled_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: uuidv4(),
    content_id: contentItems[3].id,
    holder_id: rightsHolders[2].id,
    complaint_reason: '版权侵权',
    complaint_details: '该视频使用了我的原创音乐作为背景音乐',
    current_status: 'pending',
    handler: null,
    handled_at: null
  },
];

const complaintEvidences = [
  { id: uuidv4(), complaint_id: complaints[0].id, evidence_type: '对比图', evidence_url: 'evidence_001.jpg', description: '原文与侵权文章对比图', uploaded_by: '王经理' },
  { id: uuidv4(), complaint_id: complaints[0].id, evidence_type: '版权证明', evidence_url: 'copyright_001.pdf', description: '出版社版权证明文件', uploaded_by: '王经理' },
  { id: uuidv4(), complaint_id: complaints[1].id, evidence_type: '截图', evidence_url: 'evidence_002.jpg', description: '视频侵权部分截图', uploaded_by: '李主任' },
  { id: uuidv4(), complaint_id: complaints[2].id, evidence_type: '对比视频', evidence_url: 'evidence_003.mp4', description: '课程内容对比视频', uploaded_by: '王经理' },
];

const takedownStatus = [
  { id: uuidv4(), complaint_id: complaints[0].id, status: 'pending', handler: null, notes: null, created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { id: uuidv4(), complaint_id: complaints[0].id, status: 'reviewing', handler: '审核员A', notes: '开始审核', created_at: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000).toISOString() },
  { id: uuidv4(), complaint_id: complaints[0].id, status: 'takedown', handler: '审核员A', notes: '侵权事实清楚，已下架', created_at: complaints[0].handled_at },
  { id: uuidv4(), complaint_id: complaints[1].id, status: 'pending', handler: null, notes: null, created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: uuidv4(), complaint_id: complaints[1].id, status: 'takedown', handler: '审核员B', notes: '已下架', created_at: complaints[1].handled_at },
  { id: uuidv4(), complaint_id: complaints[1].id, status: 'appealed', handler: '审核员B', notes: '创作者已申诉', created_at: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000).toISOString() },
  { id: uuidv4(), complaint_id: complaints[2].id, status: 'takedown', handler: '审核员A', notes: '侵权成立', created_at: complaints[2].handled_at },
  { id: uuidv4(), complaint_id: complaints[3].id, status: 'rejected', handler: '审核员C', notes: '证据不足，驳回投诉', created_at: complaints[3].handled_at },
];

const creatorAppeals = [
  {
    id: uuidv4(),
    complaint_id: complaints[1].id,
    creator_id: 'creator_002',
    appeal_reason: '合理使用',
    appeal_details: '视频中仅使用了3秒钟的镜头，属于合理使用范围，已获得口头授权',
    status: 'pending',
    reviewer: null,
    review_notes: null,
    reviewed_at: null
  },
];

const complianceMaterials = [
  { id: uuidv4(), appeal_id: creatorAppeals[0].id, material_type: '授权证明', material_url: 'auth_001.pdf', description: '与艺人经纪人的聊天记录截图', uploaded_by: '李四' },
  { id: uuidv4(), appeal_id: creatorAppeals[0].id, material_type: '其他证明', material_url: 'proof_001.jpg', description: '视频使用范围说明', uploaded_by: '李四' },
];

db.serialize(() => {
  const insertContent = db.prepare('INSERT INTO content_items (id, title, content_url, creator_id, creator_name, status) VALUES (?, ?, ?, ?, ?, ?)');
  contentItems.forEach(item => {
    insertContent.run(item.id, item.title, null, item.creator_id, item.creator_name, item.status);
  });
  insertContent.finalize();

  const insertHolder = db.prepare('INSERT INTO rights_holders (id, name, contact_person, phone, email, id_card, company_name, business_license, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  rightsHolders.forEach(holder => {
    insertHolder.run(holder.id, holder.name, holder.contact_person, holder.phone, holder.email, holder.id_card, holder.company_name, holder.business_license, holder.verification_status);
  });
  insertHolder.finalize();

  const insertComplaint = db.prepare('INSERT INTO complaints (id, content_id, holder_id, complaint_reason, complaint_details, current_status, handler, handled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  complaints.forEach(complaint => {
    insertComplaint.run(complaint.id, complaint.content_id, complaint.holder_id, complaint.complaint_reason, complaint.complaint_details, complaint.current_status, complaint.handler, complaint.handled_at);
  });
  insertComplaint.finalize();

  const insertEvidence = db.prepare('INSERT INTO complaint_evidences (id, complaint_id, evidence_type, evidence_url, description, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)');
  complaintEvidences.forEach(evidence => {
    insertEvidence.run(evidence.id, evidence.complaint_id, evidence.evidence_type, evidence.evidence_url, evidence.description, evidence.uploaded_by);
  });
  insertEvidence.finalize();

  const insertStatus = db.prepare('INSERT INTO takedown_status (id, complaint_id, status, handler, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  takedownStatus.forEach(status => {
    insertStatus.run(status.id, status.complaint_id, status.status, status.handler, status.notes, status.created_at);
  });
  insertStatus.finalize();

  const insertAppeal = db.prepare('INSERT INTO creator_appeals (id, complaint_id, creator_id, appeal_reason, appeal_details, status, reviewer, review_notes, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  creatorAppeals.forEach(appeal => {
    insertAppeal.run(appeal.id, appeal.complaint_id, appeal.creator_id, appeal.appeal_reason, appeal.appeal_details, appeal.status, appeal.reviewer, appeal.review_notes, appeal.reviewed_at);
  });
  insertAppeal.finalize();

  const insertMaterial = db.prepare('INSERT INTO compliance_materials (id, appeal_id, material_type, material_url, description, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)');
  complianceMaterials.forEach(material => {
    insertMaterial.run(material.id, material.appeal_id, material.material_type, material.material_url, material.description, material.uploaded_by);
  });
  insertMaterial.finalize();

  console.log('样例数据插入完成！');
  console.log(`- 内容条目: ${contentItems.length} 条`);
  console.log(`- 权利人: ${rightsHolders.length} 个`);
  console.log(`- 投诉: ${complaints.length} 条（覆盖成功、异常、复核场景）`);
  console.log(`- 投诉证据: ${complaintEvidences.length} 条`);
  console.log(`- 状态变更记录: ${takedownStatus.length} 条`);
  console.log(`- 创作者申诉: ${creatorAppeals.length} 条`);
  console.log(`- 合规材料: ${complianceMaterials.length} 条`);
});

db.close();
