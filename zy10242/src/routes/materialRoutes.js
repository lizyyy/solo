const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const materialService = require('../services/materialService');
const { success, error } = require('../utils/response');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

router.get('/:materialId', async (req, res, next) => {
  try {
    const material = await materialService.getMaterialById(req.params.materialId);
    if (!material) {
      return res.status(404).json(error('材料不存在', 404));
    }
    res.json(success(material));
  } catch (err) {
    next(err);
  }
});

router.post('/:materialId/upload', upload.single('file'), async (req, res, next) => {
  try {
    const { operator } = req.body;
    if (!req.file) {
      return res.status(400).json(error('请上传文件', 400));
    }
    const material = await materialService.uploadMaterial(
      req.params.materialId, 
      req.file, 
      operator || 'system'
    );
    res.json(success(material, '材料上传成功'));
  } catch (err) {
    next(err);
  }
});

router.post('/:materialId/reupload', upload.single('file'), async (req, res, next) => {
  try {
    const { operator, reason } = req.body;
    if (!req.file) {
      return res.status(400).json(error('请上传文件', 400));
    }
    const material = await materialService.reuploadMaterial(
      req.params.materialId, 
      req.file, 
      operator || 'system',
      reason || '材料更新'
    );
    res.json(success(material, '材料重新上传成功'));
  } catch (err) {
    next(err);
  }
});

router.patch('/:materialId/audit', async (req, res, next) => {
  try {
    const { status, operator, remark } = req.body;
    const material = await materialService.auditMaterial(
      req.params.materialId, 
      status, 
      operator || 'system', 
      remark
    );
    res.json(success(material, status === 'approved' ? '审核通过' : '审核驳回'));
  } catch (err) {
    next(err);
  }
});

router.delete('/:materialId', async (req, res, next) => {
  try {
    const { operator, reason } = req.body;
    await materialService.deleteMaterial(
      req.params.materialId, 
      operator || 'system', 
      reason || '材料作废'
    );
    res.json(success(null, '材料删除成功'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
