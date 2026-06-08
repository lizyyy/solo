const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const { getDB } = require('../database');

router.get('/batch/:batchId/excel', (req, res) => {
  const db = getDB();
  const { batchId } = req.params;
  
  db.all(`SELECT 
    t.track_number as 序号,
    t.track_name as 曲目,
    t.instrument as 乐器,
    t.page_count as 标注页数,
    t.start_page as 起始页,
    t.end_page as 结束页,
    CASE 
      WHEN t.start_page AND t.end_page THEN (t.end_page - t.start_page + 1) 
      ELSE '' 
    END as 计算页数,
    CASE 
      WHEN t.is_valid = 1 THEN '正常' 
      ELSE '异常' 
    END as 校验状态,
    t.validation_status as 审核状态,
    a.description as 异常原因,
    a.suggestion as 处理建议,
    n.content as 备注
    FROM tracks t
    LEFT JOIN anomalies a ON t.id = a.track_id
    LEFT JOIN notes n ON t.id = n.track_id
    WHERE t.batch_id = ?
    GROUP BY t.id
    ORDER BY t.track_number`,
    [batchId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, '页码校验结果');
      
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const filename = encodeURIComponent(`管弦乐谱页码校验_批次${batchId}.xlsx`);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    }
  );
});

router.get('/batch/:batchId/csv', (req, res) => {
  const db = getDB();
  const { batchId } = req.params;
  
  db.all(`SELECT 
    t.track_number as 序号,
    t.track_name as 曲目,
    t.instrument as 乐器,
    t.page_count as 标注页数,
    t.start_page as 起始页,
    t.end_page as 结束页,
    CASE 
      WHEN t.start_page AND t.end_page THEN (t.end_page - t.start_page + 1) 
      ELSE '' 
    END as 计算页数,
    CASE 
      WHEN t.is_valid = 1 THEN '正常' 
      ELSE '异常' 
    END as 校验状态,
    t.validation_status as 审核状态,
    a.description as 异常原因,
    a.suggestion as 处理建议,
    n.content as 备注
    FROM tracks t
    LEFT JOIN anomalies a ON t.id = a.track_id
    LEFT JOIN notes n ON t.id = n.track_id
    WHERE t.batch_id = ?
    GROUP BY t.id
    ORDER BY t.track_number`,
    [batchId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const headers = ['序号,曲目,乐器,标注页数,起始页,结束页,计算页数,校验状态,审核状态,异常原因,处理建议,备注'];
      const csvRows = rows.map(row => 
        `${row.序号},"${row.曲目}","${row.乐器}",${row.标注页数},${row.起始页},${row.结束页},${row.计算页数},${row.校验状态},${row.审核状态},"${row.异常原因 || ''}","${row.处理建议 || ''}","${row.备注 || ''}"`
      );
      
      const csv = '\ufeff' + headers.concat(csvRows).join('\n');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      const filename = encodeURIComponent(`管弦乐谱页码校验_批次${batchId}.csv`);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    }
  );
});

router.get('/batch/:batchId/report', (req, res) => {
  const db = getDB();
  const { batchId } = req.params;
  
  db.get('SELECT * FROM batches WHERE id = ?', [batchId], (err, batch) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.get(`SELECT 
      COUNT(*) as total_tracks,
      SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END) as valid_tracks,
      SUM(CASE WHEN is_valid = 0 THEN 1 ELSE 0 END) as invalid_tracks
      FROM tracks WHERE batch_id = ?`,
      [batchId],
      (err2, stats) => {
        if (err2) return res.status(500).json({ error: err2.message });
        
        db.all(`SELECT a.*, t.track_name, t.track_number
          FROM anomalies a
          LEFT JOIN tracks t ON a.track_id = t.id
          WHERE a.batch_id = ? AND a.resolved = 0
          ORDER BY a.severity DESC, a.created_at DESC`,
          [batchId],
          (err3, anomalies) => {
            if (err3) return res.status(500).json({ error: err3.message });
            
            db.all(`SELECT n.*, t.track_name
              FROM notes n
              LEFT JOIN tracks t ON n.track_id = t.id
              WHERE n.batch_id = ?
              ORDER BY n.created_at DESC`,
              [batchId],
              (err4, notes) => {
                if (err4) return res.status(500).json({ error: err4.message });
                
                res.json({
                  batch,
                  stats,
                  anomalies,
                  notes,
                  generatedAt: new Date().toLocaleString('zh-CN')
                });
              }
            );
          }
        );
      }
    );
  });
});

module.exports = router;
