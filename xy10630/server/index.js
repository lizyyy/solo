const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./models/database');

const cardRoutes = require('./routes/cardRoutes');
const rechargeRoutes = require('./routes/rechargeRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const refundRoutes = require('./routes/refundRoutes');
const reconciliationRoutes = require('./routes/reconciliationRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

app.post('/api/import/transactions', upload.single('file'), (req, res) => {
  const results = [];
  const { operator } = req.body;

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      let successCount = 0;
      let errorCount = 0;

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const processNext = (index) => {
          if (index >= results.length) {
            db.run('COMMIT', (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ success: false, message: err.message });
              }
              fs.unlinkSync(req.file.path);
              res.json({ 
                success: true, 
                message: `导入完成：成功 ${successCount} 条，失败 ${errorCount} 条`,
                successCount,
                errorCount
              });
            });
            return;
          }

          const row = results[index];
          const txId = uuidv4();

          db.get('SELECT status FROM cards WHERE card_id = ?', [row.card_id], (err, card) => {
            if (err || !card || card.status !== 'normal') {
              errorCount++;
              processNext(index + 1);
              return;
            }

            db.run(`INSERT INTO offline_transactions 
              (tx_id, card_id, amount, canteen_id, canteen_name, device_id, tx_time, status, remark)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [txId, row.card_id, parseFloat(row.amount), row.canteen_id, 
               row.canteen_name, row.device_id, row.tx_time, 'completed', row.remark || ''],
              function(err) {
                if (err) {
                  errorCount++;
                } else {
                  db.run('UPDATE cards SET balance = balance - ? WHERE card_id = ?',
                    [parseFloat(row.amount), row.card_id],
                    function(err) {
                      if (err) {
                        errorCount++;
                      } else {
                        successCount++;
                      }
                    }
                  );
                }
                setTimeout(() => processNext(index + 1), 10);
              }
            );
          });
        };

        processNext(0);
      });
    });
});

app.use('/api/cards', cardRoutes);
app.use('/api/recharge', rechargeRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/refund', refundRoutes);
app.use('/api/reconciliation', reconciliationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '服务运行正常', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`校园餐卡离线补账系统服务运行在端口 ${PORT}`);
});
