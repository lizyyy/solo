const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const config = require('../config');
const photoService = require('../services/photoService');

const uploadDir = config.uploadDir;
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { reportId } = req.params;
        const reportDir = path.join(uploadDir, reportId);
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }
        cb(null, reportDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const timestamp = Date.now();
        cb(null, `${timestamp}${ext}`);
    }
});

const upload = multer({ storage });

router.post('/:reportId/photos/upload', upload.single('photo'), (req, res) => {
    try {
        const { reportId } = req.params;
        const { photo_type, description } = req.body;
        const operator = req.headers['x-operator'] || 'system';
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '请上传照片文件'
            });
        }
        
        if (!photo_type) {
            return res.status(400).json({
                success: false,
                error: '请指定照片类型'
            });
        }
        
        const fileInfo = {
            file_path: req.file.path,
            file_name: req.file.originalname
        };
        
        const photos = photoService.uploadPhoto(reportId, photo_type, fileInfo, operator, description);
        
        res.status(201).json({
            success: true,
            data: photos
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/:reportId/photos', (req, res) => {
    try {
        const { reportId } = req.params;
        const { include_inactive } = req.query;
        
        const photos = photoService.getPhotosByReportId(reportId, include_inactive === 'true');
        
        res.json({
            success: true,
            data: photos
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/:reportId/photos/all', (req, res) => {
    try {
        const { reportId } = req.params;
        
        const photos = photoService.getAllPhotosByReportId(reportId);
        
        res.json({
            success: true,
            data: photos
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/:reportId/photos/:photoType/history', (req, res) => {
    try {
        const { reportId, photoType } = req.params;
        const { version } = req.query;
        
        if (!version) {
            return res.status(400).json({
                success: false,
                error: '请指定版本号'
            });
        }
        
        const photo = photoService.getPhotoHistory(reportId, photoType, parseInt(version));
        
        if (!photo) {
            return res.status(404).json({
                success: false,
                error: '照片不存在'
            });
        }
        
        res.json({
            success: true,
            data: photo
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/:reportId/photos/:photoType/rollback', (req, res) => {
    try {
        const { reportId, photoType } = req.params;
        const { target_version } = req.body;
        
        if (!target_version) {
            return res.status(400).json({
                success: false,
                error: '请指定目标版本'
            });
        }
        
        const photos = photoService.rollbackToVersion(reportId, photoType, target_version);
        
        res.json({
            success: true,
            data: photos
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
