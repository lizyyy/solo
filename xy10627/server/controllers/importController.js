const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const RuleEngine = require('../services/ruleEngine');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

class ImportController {
  static getUploadMiddleware() {
    return upload.single('file');
  }

  static async importCSV(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: '请上传文件' });
      }

      const results = [];
      const errors = [];
      let successCount = 0;

      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          for (let i = 0; i < results.length; i++) {
            const row = results[i];
            try {
              const id = uuidv4();
              const inspection_no = `INSP-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}${i}`;

              await new Promise((resolve, reject) => {
                db.run(
                  `INSERT INTO inspections 
                   (id, inspection_no, plant_area, pest_level, missed_inspection_points, 
                    responsible_person, status, operation_id)
                   VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
                  [
                    id,
                    inspection_no,
                    row.plant_area || row['植物区域'],
                    row.pest_level || row['病虫害等级'] || '轻度',
                    parseInt(row.missed_inspection_points || row['漏巡扣分'] || 0),
                    row.responsible_person || row['责任人'],
                    uuidv4()
                  ],
                  async (err) => {
                    if (err) reject(err);
                    
                    await RuleEngine.addTimelineEntry(
                      id, null, 'pending', 
                      row.responsible_person || row['责任人'] || '系统', 
                      '批量导入', '通过CSV批量导入的巡检记录'
                    );
                    
                    successCount++;
                    resolve();
                  }
                );
              });
            } catch (error) {
              errors.push({ row: i + 1, message: error.message });
            }
          }

          fs.unlinkSync(req.file.path);

          res.json({
            success: true,
            data: {
              total: results.length,
              success: successCount,
              errors: errors
            }
          });
        });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static getTemplate(req, res) {
    const template = `植物区域,病虫害等级,漏巡扣分,责任人
A区-乔木林,轻度,2,张三
B区-灌木丛,中度,5,李四
C区-草坪区,重度,0,王五`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=inspection_template.csv');
    res.send(template);
  }
}

module.exports = ImportController;
