import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { importCSV, exportCSV, sampleCSV } from '../services/csvService';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const ext = path.extname(file.originalname) || '.csv';
    cb(null, `${ts}${ext}`);
  },
});
const upload = multer({ storage, fileFilter: (_req, file, cb) => {
  if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new Error('仅支持CSV文件'));
  }
}});

const router = express.Router();

router.post('/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '未上传文件' });
    const filePath = req.file.path;
    const content = fs.readFileSync(filePath, 'utf8');
    const operator = (req.body.operator as string) || '阿宁';
    const result = importCSV(content, operator);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message || '导入失败' });
  }
});

router.post('/import-content', express.json({ limit: '5mb' }), (req, res) => {
  try {
    const { content, operator } = req.body;
    if (!content) return res.status(400).json({ error: 'CSV内容为空' });
    const result = importCSV(content, operator || '阿宁');
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message || '导入失败' });
  }
});

router.get('/export', (_req, res) => {
  const csv = exportCSV();
  const filename = `材料追踪明细_${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  const BOM = '\uFEFF';
  res.send(BOM + csv);
});

router.get('/sample', (_req, res) => {
  const csv = sampleCSV();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('示例导入.csv')}`);
  const BOM = '\uFEFF';
  res.send(BOM + csv);
});

router.post('/parse-preview', express.json({ limit: '5mb' }), (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'CSV内容为空' });
    const rows = parseCSVPreview(content);
    res.json({ rows: rows.slice(0, 20), total: rows.length });
  } catch (e: any) {
    res.status(400).json({ error: e.message || '解析失败' });
  }
});

function parseCSVPreview(content: string): Array<Record<string, string>> {
  const lines = content.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result.map(s => s.trim());
  };
  const headers = parseLine(lines[0]);
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

export default router;
