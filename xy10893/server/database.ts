import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { Dispute, Evidence, ExportBatch, AccessRecord } from '../shared/types';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

let db: Database | null = null;

const downloadsDir = path.join(__dirname, '../downloads');

export async function initDB(): Promise<Database> {
  if (db) return db;
  
  db = await open({
    filename: './evidence.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS disputes (
      id TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      customerName TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evidences (
      id TEXT PRIMARY KEY,
      disputeId TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      source TEXT NOT NULL,
      hash TEXT NOT NULL,
      fileSize INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (disputeId) REFERENCES disputes(id)
    );

    CREATE TABLE IF NOT EXISTS exportBatches (
      id TEXT PRIMARY KEY,
      disputeId TEXT NOT NULL,
      evidenceIds TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      downloadUrl TEXT,
      FOREIGN KEY (disputeId) REFERENCES disputes(id)
    );

    CREATE TABLE IF NOT EXISTS accessRecords (
      id TEXT PRIMARY KEY,
      batchId TEXT NOT NULL,
      operator TEXT NOT NULL,
      accessedAt TEXT NOT NULL,
      action TEXT NOT NULL,
      FOREIGN KEY (batchId) REFERENCES exportBatches(id)
    );
  `);

  return db;
}

export function generateHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function createDispute(orderId: string, customerName: string): Promise<Dispute> {
  const db = await initDB();
  const now = new Date().toISOString();
  const id = uuidv4();
  
  await db.run(
    'INSERT INTO disputes (id, orderId, customerName, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
    [id, orderId, customerName, 'pending', now, now]
  );

  return { id, orderId, customerName, status: 'pending', createdAt: now, updatedAt: now };
}

export async function addEvidence(
  disputeId: string,
  type: Evidence['type'],
  name: string,
  source: string,
  content: string
): Promise<Evidence> {
  const db = await initDB();
  const now = new Date().toISOString();
  const id = uuidv4();
  const hash = generateHash(content);
  const fileSize = Buffer.byteLength(content, 'utf8');

  await db.run(
    'INSERT INTO evidences (id, disputeId, type, name, source, hash, fileSize, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, disputeId, type, name, source, hash, fileSize, now]
  );

  return { id, disputeId, type, name, source, hash, fileSize, createdAt: now };
}

export async function getDisputes(): Promise<Dispute[]> {
  const db = await initDB();
  return db.all('SELECT * FROM disputes ORDER BY createdAt DESC');
}

export async function getDispute(id: string): Promise<Dispute | undefined> {
  const db = await initDB();
  return db.get('SELECT * FROM disputes WHERE id = ?', [id]);
}

export async function getEvidences(disputeId: string): Promise<Evidence[]> {
  const db = await initDB();
  return db.all('SELECT * FROM evidences WHERE disputeId = ? ORDER BY createdAt DESC', [disputeId]);
}

export async function getEvidence(id: string): Promise<Evidence | undefined> {
  const db = await initDB();
  return db.get('SELECT * FROM evidences WHERE id = ?', [id]);
}

export async function getBatches(disputeId: string): Promise<ExportBatch[]> {
  const db = await initDB();
  const rows = await db.all('SELECT * FROM exportBatches WHERE disputeId = ? ORDER BY createdAt DESC', [disputeId]);
  return rows.map(row => ({
    ...row,
    evidenceIds: JSON.parse(row.evidenceIds)
  }));
}

export async function getBatch(id: string): Promise<ExportBatch | undefined> {
  const db = await initDB();
  const row = await db.get('SELECT * FROM exportBatches WHERE id = ?', [id]);
  if (!row) return undefined;
  return {
    ...row,
    evidenceIds: JSON.parse(row.evidenceIds)
  };
}

export async function createBatch(disputeId: string, evidenceIds: string[]): Promise<ExportBatch> {
  const db = await initDB();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const id = uuidv4();

  await db.run(
    'INSERT INTO exportBatches (id, disputeId, evidenceIds, status, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?)',
    [id, disputeId, JSON.stringify(evidenceIds), 'pending', now.toISOString(), expiresAt.toISOString()]
  );

  return {
    id,
    disputeId,
    evidenceIds,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };
}

export async function updateBatchStatus(batchId: string, status: ExportBatch['status'], downloadUrl?: string): Promise<void> {
  const db = await initDB();
  const now = new Date().toISOString();
  
  if (downloadUrl !== undefined) {
    await db.run(
      'UPDATE exportBatches SET status = ?, downloadUrl = ? WHERE id = ?',
      [status, downloadUrl, batchId]
    );
  } else {
    await db.run(
      'UPDATE exportBatches SET status = ? WHERE id = ?',
      [status, batchId]
    );
  }

  await db.run(
    'UPDATE disputes SET status = ?, updatedAt = ? WHERE id = (SELECT disputeId FROM exportBatches WHERE id = ?)',
    [status === 'ready' ? 'ready' : status === 'expired' ? 'expired' : 'processing', now, batchId]
  );
}

export async function addAccessRecord(batchId: string, operator: string, action: AccessRecord['action']): Promise<AccessRecord> {
  const db = await initDB();
  const now = new Date().toISOString();
  const id = uuidv4();

  await db.run(
    'INSERT INTO accessRecords (id, batchId, operator, accessedAt, action) VALUES (?, ?, ?, ?, ?)',
    [id, batchId, operator, now, action]
  );

  return { id, batchId, operator, accessedAt: now, action };
}

export async function getAccessRecords(batchId: string): Promise<AccessRecord[]> {
  const db = await initDB();
  return db.all('SELECT * FROM accessRecords WHERE batchId = ? ORDER BY accessedAt DESC', [batchId]);
}

function generateReportContent(evidences: Evidence[], batch: ExportBatch): string {
  let report = '='.repeat(60) + '\n';
  report += '                    证据清单报告\n';
  report += '='.repeat(60) + '\n\n';
  report += `批次编号: ${batch.id}\n`;
  report += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
  report += `证据数量: ${evidences.length}\n\n`;
  report += '-'.repeat(60) + '\n\n';

  const typeMap: Record<string, string> = {
    order_screenshot: '订单截图',
    chat_history: '聊天记录',
    operation_log: '操作日志',
    contract: '合同附件',
    other: '其他材料'
  };

  evidences.forEach((ev, idx) => {
    report += `证据 ${idx + 1}:\n`;
    report += `  名称: ${ev.name}\n`;
    report += `  类型: ${typeMap[ev.type] || ev.type}\n`;
    report += `  来源: ${ev.source}\n`;
    report += `  大小: ${ev.fileSize} bytes\n`;
    report += `  SHA256: ${ev.hash}\n`;
    report += `  创建时间: ${new Date(ev.createdAt).toLocaleString('zh-CN')}\n\n`;
  });

  report += '='.repeat(60) + '\n';
  report += '报告结束\n';
  report += '='.repeat(60) + '\n';

  return report;
}

export async function generateBatchZip(batchId: string, evidences: Evidence[], force: boolean = false): Promise<string> {
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const zipPath = path.join(downloadsDir, `${batchId}.zip`);
  
  if (force && fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  
  if (fs.existsSync(zipPath)) {
    return `/api/downloads/${batchId}.zip`;
  }

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);

    const batch: ExportBatch = {
      id: batchId,
      disputeId: evidences[0]?.disputeId || '',
      evidenceIds: evidences.map(e => e.id),
      status: 'ready',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    for (const evidence of evidences) {
      const content = `证据类型: ${evidence.type}\n来源: ${evidence.source}\n哈希: ${evidence.hash}\n文件大小: ${evidence.fileSize} bytes`;
      archive.append(content, { name: evidence.name });
    }

    const reportContent = generateReportContent(evidences, batch);
    archive.append(reportContent, { name: '证据清单报告.txt' });

    archive.finalize();

    output.on('close', () => {
      resolve(`/api/downloads/${batchId}.zip`);
    });

    output.on('error', reject);
    archive.on('error', reject);
  });
}

export async function reauthorizeBatch(batchId: string): Promise<ExportBatch> {
  const db = await initDB();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const batch = await getBatch(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }

  const evidences: Evidence[] = [];
  for (const evId of batch.evidenceIds) {
    const ev = await getEvidence(evId);
    if (ev) evidences.push(ev);
  }

  const downloadUrl = await generateBatchZip(batchId, evidences, true);

  await db.run(
    'UPDATE exportBatches SET status = ?, expiresAt = ?, downloadUrl = ? WHERE id = ?',
    ['ready', expiresAt.toISOString(), downloadUrl, batchId]
  );

  await db.run(
    'UPDATE disputes SET status = ?, updatedAt = ? WHERE id = ?',
    ['ready', now.toISOString(), batch.disputeId]
  );

  const updatedBatch = await db.get('SELECT * FROM exportBatches WHERE id = ?', [batchId]);
  return {
    ...updatedBatch,
    evidenceIds: JSON.parse(updatedBatch.evidenceIds)
  };
}

export async function seedTestData(): Promise<void> {
  const db = await initDB();
  
  await db.exec('DELETE FROM accessRecords');
  await db.exec('DELETE FROM exportBatches');
  await db.exec('DELETE FROM evidences');
  await db.exec('DELETE FROM disputes');

  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const dispute1 = await createDispute('ORD-2024-001', '张三');
  const ev1_1 = await addEvidence(dispute1.id, 'order_screenshot', '订单截图.png', 'order_system', '订单内容截图数据...');
  const ev1_2 = await addEvidence(dispute1.id, 'chat_history', '聊天记录.html', 'chat_platform', '客服与用户的聊天记录...');
  const ev1_3 = await addEvidence(dispute1.id, 'operation_log', '操作日志.txt', 'log_system', '系统操作日志记录...');
  const ev1_4 = await addEvidence(dispute1.id, 'contract', '服务合同.pdf', 'contract_system', '电子合同内容...');

  const batch1 = await createBatch(dispute1.id, [ev1_1.id, ev1_2.id, ev1_3.id, ev1_4.id]);
  const downloadUrl1 = await generateBatchZip(batch1.id, [ev1_1, ev1_2, ev1_3, ev1_4]);
  await updateBatchStatus(batch1.id, 'ready', downloadUrl1);
  await addAccessRecord(batch1.id, '客服A', 'download');

  const dispute2 = await createDispute('ORD-2024-002', '李四');
  await addEvidence(dispute2.id, 'order_screenshot', '订单截图.png', 'order_system', '订单内容截图数据...');
  await addEvidence(dispute2.id, 'chat_history', '聊天记录.html', 'chat_platform', '客服与用户的聊天记录...');
  await addEvidence(dispute2.id, 'operation_log', '操作日志.txt', 'log_system', '系统操作日志记录...');

  const dispute3 = await createDispute('ORD-2024-003', '王五');
  const ev3_1 = await addEvidence(dispute3.id, 'order_screenshot', '订单截图.png', 'order_system', '订单内容截图数据...');
  const ev3_2 = await addEvidence(dispute3.id, 'chat_history', '聊天记录.html', 'chat_platform', '客服与用户的聊天记录...');
  const ev3_3 = await addEvidence(dispute3.id, 'operation_log', '操作日志.txt', 'log_system', '系统操作日志记录...');
  const ev3_4 = await addEvidence(dispute3.id, 'contract', '服务合同.pdf', 'contract_system', '电子合同内容...');
  
  const batch3 = await createBatch(dispute3.id, [ev3_1.id, ev3_2.id, ev3_3.id, ev3_4.id]);
  const downloadUrl3 = await generateBatchZip(batch3.id, [ev3_1, ev3_2, ev3_3, ev3_4]);
  await updateBatchStatus(batch3.id, 'ready', downloadUrl3);
  await addAccessRecord(batch3.id, '客服A', 'download');

  const dispute4 = await createDispute('ORD-2024-004', '赵六');
  const ev4_1 = await addEvidence(dispute4.id, 'order_screenshot', '订单截图.png', 'order_system', '订单内容截图数据...');
  const ev4_2 = await addEvidence(dispute4.id, 'chat_history', '聊天记录.html', 'chat_platform', '客服与用户的聊天记录...');
  const ev4_3 = await addEvidence(dispute4.id, 'operation_log', '操作日志.txt', 'log_system', '系统操作日志记录...');
  const ev4_4 = await addEvidence(dispute4.id, 'contract', '服务合同.pdf', 'contract_system', '电子合同内容...');
  
  const batch4 = await createBatch(dispute4.id, [ev4_1.id, ev4_2.id, ev4_3.id, ev4_4.id]);
  const expiredDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const downloadUrl4 = `/api/downloads/${batch4.id}.zip`;
  await db.run('UPDATE exportBatches SET status = ?, expiresAt = ?, downloadUrl = ? WHERE id = ?', 
    ['expired', expiredDate, downloadUrl4, batch4.id]);
  await db.run('UPDATE disputes SET status = ?, updatedAt = ? WHERE id = ?', 
    ['expired', expiredDate, dispute4.id]);
  await addAccessRecord(batch4.id, '客服B', 'download');
}
