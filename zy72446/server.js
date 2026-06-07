const express = require('express');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { initDatabase, prepare } = require('./database');
const service = require('./service');

const app = express();
const PORT = process.env.PORT || 3000;

let dbInitialized = false;

async function startServer() {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '_' + file.originalname);
    }
  });
  const upload = multer({ storage });

  app.post('/api/import/csv', upload.single('file'), (req, res) => {
    try {
      const results = [];
      const operator = req.body.operator || '阿梅';
      
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          const result = service.importContractScreenshots(
            results, 
            req.file.originalname, 
            operator
          );
          res.json({ success: true, data: result });
        });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/import/json', (req, res) => {
    try {
      const { rows, source_file, operator } = req.body;
      const result = service.importContractScreenshots(
        rows, 
        source_file || 'manual_input', 
        operator || '阿梅'
      );
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/contracts', (req, res) => {
    try {
      const { status, song_name, page = 1, page_size = 50 } = req.query;
      let where = [];
      let params = [];
      
      if (status) {
        where.push('cs.status = ?');
        params.push(status);
      }
      if (song_name) {
        where.push('cs.song_name LIKE ?');
        params.push('%' + song_name + '%');
      }
      
      const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
      const offset = (page - 1) * page_size;
      
      const contracts = prepare(`
        SELECT cs.*, rl.linkage_status, rl.song_canonical_name
        FROM contract_screenshots cs
        LEFT JOIN room_linkages rl ON cs.id = rl.contract_screenshot_id
        ${whereSql}
        ORDER BY cs.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, parseInt(page_size), offset);
      
      const total = prepare(`
        SELECT COUNT(*) as count FROM contract_screenshots cs
        ${whereSql}
      `).get(...params).count;
      
      res.json({ success: true, data: { contracts, total, page: parseInt(page), page_size: parseInt(page_size) } });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/contracts/:id', (req, res) => {
    try {
      const data = service.getContractWithHistory(parseInt(req.params.id));
      if (!data) {
        return res.status(404).json({ success: false, error: '合同记录不存在' });
      }
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.put('/api/contracts/:id/remarks', (req, res) => {
    try {
      const { remarks, operator } = req.body;
      service.updateContractRemarks(parseInt(req.params.id), remarks, operator || '阿梅');
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.put('/api/contracts/:id/workflow/:step', (req, res) => {
    try {
      const { status, operator, note } = req.body;
      service.updateWorkflowStep(
        parseInt(req.params.id), 
        req.params.step, 
        status, 
        operator || '阿梅', 
        note
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/linkages', (req, res) => {
    try {
      const { linkage_status, song_name, page = 1, page_size = 50 } = req.query;
      let where = [];
      let params = [];
      
      if (linkage_status) {
        where.push('rl.linkage_status = ?');
        params.push(linkage_status);
      }
      if (song_name) {
        where.push('(rl.song_canonical_name LIKE ? OR cs.song_name LIKE ?)');
        params.push('%' + song_name + '%', '%' + song_name + '%');
      }
      
      const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
      const offset = (page - 1) * page_size;
      
      const linkages = prepare(`
        SELECT rl.*, cs.original_row_number, cs.song_name as original_song_name, 
               cs.source_file, cs.remarks, cs.status as contract_status
        FROM room_linkages rl
        JOIN contract_screenshots cs ON rl.contract_screenshot_id = cs.id
        ${whereSql}
        ORDER BY rl.updated_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, parseInt(page_size), offset);
      
      const total = prepare(`
        SELECT COUNT(*) as count FROM room_linkages rl
        JOIN contract_screenshots cs ON rl.contract_screenshot_id = cs.id
        ${whereSql}
      `).get(...params).count;
      
      res.json({ success: true, data: { linkages, total, page: parseInt(page), page_size: parseInt(page_size) } });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.put('/api/linkages/:id/review', (req, res) => {
    try {
      const { review_decision, review_note, operator } = req.body;
      service.reviewLinkage(
        parseInt(req.params.id), 
        review_decision, 
        review_note, 
        operator || '音乐老师'
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/aliases', (req, res) => {
    try {
      const { canonical_name, alias_name, alias_type, source, operator } = req.body;
      const id = service.addSongAlias(
        canonical_name, 
        alias_name, 
        alias_type, 
        source, 
        operator || '阿梅'
      );
      res.json({ success: true, data: { id } });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/aliases', (req, res) => {
    try {
      const aliases = prepare(`
        SELECT * FROM song_aliases WHERE is_active = 1 ORDER BY canonical_name, alias_type
      `).all();
      res.json({ success: true, data: aliases });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/weekly-report', (req, res) => {
    try {
      const data = service.getWeeklyReportData();
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/history/:entity_type/:entity_id', (req, res) => {
    try {
      const history = prepare(`
        SELECT * FROM operation_history 
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY created_at DESC
      `).all(req.params.entity_type, parseInt(req.params.entity_id));
      res.json({ success: true, data: history });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/batches', (req, res) => {
    try {
      const batches = prepare(`
        SELECT * FROM import_batches ORDER BY created_at DESC LIMIT 20
      `).all();
      res.json({ success: true, data: batches });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/stats', (req, res) => {
    try {
      const stats = {
        total_contracts: prepare('SELECT COUNT(*) as count FROM contract_screenshots').get().count,
        total_linkages: prepare('SELECT COUNT(*) as count FROM room_linkages').get().count,
        pending_review: prepare("SELECT COUNT(*) as count FROM room_linkages WHERE linkage_status = 'pending_review'").get().count,
        normal: prepare("SELECT COUNT(*) as count FROM room_linkages WHERE linkage_status = 'normal'").get().count,
        no_alias: prepare("SELECT COUNT(*) as count FROM room_linkages WHERE linkage_status = 'no_alias'").get().count,
        total_aliases: prepare('SELECT COUNT(*) as count FROM song_aliases WHERE is_active = 1').get().count
      };
      res.json({ success: true, data: stats });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.listen(PORT, () => {
    console.log(`巡演酒店房型联动系统运行在 http://localhost:${PORT}`);
  });
}

startServer().catch(e => {
  console.error('服务器启动失败:', e);
  process.exit(1);
});
