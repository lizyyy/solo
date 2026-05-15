const express = require('express');
const multer = require('multer');
const path = require('path');
const { MeetingRecord, FailedItem, CacheManager } = require('../models');
const config = require('../config');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (config.ALLOWED_FILE_TYPES.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}，仅支持: ${config.ALLOWED_FILE_TYPES.join(', ')}`));
    }
  }
});

router.post('/records', upload.array('attachments', 10), async (req, res) => {
  try {
    const { title, department, meetingDate, attendees, summary, authPaths } = req.body;

    if (!title || !department || !meetingDate) {
      return res.status(400).json({
        code: 'MISSING_REQUIRED_FIELDS',
        message: '缺少必填字段',
        details: {
          required: ['title', 'department', 'meetingDate'],
          provided: Object.keys(req.body)
        }
      });
    }

    const attachments = (req.files || []).map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      path: file.path
    }));

    const cacheKey = `dept:${department}:auth_paths`;
    const cachedAuthPaths = await CacheManager.get(cacheKey);
    
    let finalAuthPaths = authPaths ? JSON.parse(authPaths) : [];
    
    if (finalAuthPaths.length === 0) {
      if (cachedAuthPaths) {
        finalAuthPaths = cachedAuthPaths;
      } else {
        const stale = await CacheManager.isStale(cacheKey);
        if (stale) {
          const failedItem = await FailedItem.createItem({
            recordId: null,
            operation: 'create_meeting_record',
            errorCode: 'CACHE_STALE_NO_REFRESH',
            errorMessage: '部门鉴权路径缓存已过期且未刷新，无法自动补全路径',
            inputData: { department, title }
          });

          return res.status(409).json({
            code: 'CACHE_STALE_NO_REFRESH',
            message: '鉴权路径缓存未刷新，无法继续处理',
            details: {
              department,
              cacheKey,
              failedItemId: failedItem.id,
              actionRequired: '请先调用 /api/cache/refresh 接口刷新缓存'
            }
          });
        }
      }
    }

    const record = await MeetingRecord.createRecord({
      title,
      department,
      meetingDate,
      attendees: attendees ? JSON.parse(attendees) : [],
      summary,
      attachments,
      authPaths: finalAuthPaths,
      status: 'completed'
    });

    await MeetingRecord.update(record.id, { 
      status: 'completed',
      processedAt: new Date().toISOString() 
    });

    res.status(201).json({
      code: 'SUCCESS',
      message: '会议纪要补录成功',
      data: {
        recordId: record.id,
        title: record.title,
        department: record.department,
        attachmentsCount: attachments.length,
        authPathsUsed: finalAuthPaths.length
      }
    });

  } catch (error) {
    const failedItem = await FailedItem.createItem({
      recordId: null,
      operation: 'create_meeting_record',
      errorCode: 'INTERNAL_ERROR',
      errorMessage: error.message,
      inputData: req.body
    });

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '处理失败，已记录失败项',
      details: {
        failedItemId: failedItem.id,
        error: error.message
      }
    });
  }
});

router.get('/records', async (req, res) => {
  try {
    const records = await MeetingRecord.getAll();
    res.json({
      code: 'SUCCESS',
      data: records,
      total: records.length
    });
  } catch (error) {
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/records/:id', async (req, res) => {
  try {
    const record = await MeetingRecord.getById(req.params.id);
    if (!record) {
      return res.status(404).json({
        code: 'RECORD_NOT_FOUND',
        message: '会议记录不存在'
      });
    }
    res.json({
      code: 'SUCCESS',
      data: record
    });
  } catch (error) {
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
