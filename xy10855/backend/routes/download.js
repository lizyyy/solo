const express = require('express');
const path = require('path');
const fs = require('fs');
const AuthService = require('../services/AuthService');

const router = express.Router();

router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const auth = await AuthService.validateDownloadToken(token);
    
    const uploadsDir = path.join(__dirname, '../uploads');
    const filePath = path.join(uploadsDir, auth.fileName);
    
    if (!fs.existsSync(filePath)) {
      const mockContent = Buffer.from(`这是一个模拟的报表文件\n任务ID: ${auth.taskId}\n生成时间: ${new Date().toISOString()}`);
      fs.writeFileSync(filePath, mockContent);
    }
    
    await AuthService.recordDownload(auth.authId);
    
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(auth.fileName)}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('下载失败:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
