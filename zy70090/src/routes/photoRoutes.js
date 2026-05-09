const express = require('express');
const multer = require('multer');
const { ApiResponse } = require('../utils/response');
const PhotoService = require('../services/photoService');
const { authenticate } = require('../middleware/auth');
const config = require('../config/config');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = config.upload.allowedTypes;
    const fileExt = file.originalname.toLowerCase().split('.').pop();
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件格式，仅支持: ${allowedTypes.join(', ')}`));
    }
  }
});

router.post('/upload/:seizedItemId', authenticate, upload.single('photo'), async (req, res, next) => {
  try {
    const { photo_type = 'seized' } = req.body;
    const validTypes = ['seized', 'sealed', 'transferred', 'returned'];
    
    if (!validTypes.includes(photo_type)) {
      return res.status(400).json(ApiResponse.error(
        `无效的照片类型，支持: ${validTypes.join(', ')}`,
        400
      ));
    }

    const photo = await PhotoService.uploadPhoto(req, req.params.seizedItemId, req.file, photo_type);
    res.status(201).json(ApiResponse.success(photo, '照片上传成功'));
  } catch (error) {
    next(error);
  }
});

router.post('/verify/:photoId', authenticate, async (req, res, next) => {
  try {
    const result = await PhotoService.verifyPhoto(req, req.params.photoId, req.body);
    res.json(ApiResponse.success(result, '照片校验完成'));
  } catch (error) {
    next(error);
  }
});

router.delete('/:photoId', authenticate, async (req, res, next) => {
  try {
    const result = await PhotoService.deletePhoto(req, req.params.photoId);
    res.json(ApiResponse.success(result, '照片删除成功'));
  } catch (error) {
    next(error);
  }
});

router.post('/verify-quantity/:seizedItemId', authenticate, async (req, res, next) => {
  try {
    const { expected_count } = req.body;
    
    if (!expected_count || parseInt(expected_count) < 0) {
      return res.status(400).json(ApiResponse.error('请提供有效的期望照片数量', 400));
    }

    const result = await PhotoService.verifyQuantity(req, req.params.seizedItemId, parseInt(expected_count));
    res.json(ApiResponse.success(result));
  } catch (error) {
    next(error);
  }
});

router.get('/item/:seizedItemId', authenticate, async (req, res, next) => {
  try {
    const photos = await PhotoService.getByItemId(req.params.seizedItemId);
    res.json(ApiResponse.success(photos));
  } catch (error) {
    next(error);
  }
});

router.get('/verification-history/:seizedItemId', authenticate, async (req, res, next) => {
  try {
    const history = await PhotoService.getVerificationHistory(req.params.seizedItemId);
    res.json(ApiResponse.success(history));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
