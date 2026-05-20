import express from 'express';
import multer from 'multer';
import fs from 'fs';
import * as importService from '../services/import.service';

const upload = multer({ dest: 'uploads/' });
const router = express.Router();

router.post('/slots', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }
    
    const result = await importService.importSlotsFromCsv(req.file.path);
    fs.unlinkSync(req.file.path);
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
