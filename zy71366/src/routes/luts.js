const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const config = require('../config');
const lutService = require('../services/lut.service');
const conflictService = require('../services/conflict.service');
const exportService = require('../services/export.service');
const archiveService = require('../services/archive.service');
const fs = require('fs-extra');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.ensureDirSync(config.storage.tempDir);
    cb(null, config.storage.tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.validation.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (config.validation.allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(null, false);
      req.fileValidationError = `不支持的文件格式: ${ext}`;
    }
  }
});

router.post('/upload', upload.single('lutFile'), async (req, res) => {
  try {
    if (req.fileValidationError) {
      return res.status(400).json({ error: req.fileValidationError });
    }
    if (!req.file) {
      return res.status(400).json({ error: '请上传LUT文件' });
    }

    const metadata = {
      projectId: parseInt(req.body.projectId),
      sceneId: req.body.sceneId ? parseInt(req.body.sceneId) : null,
      name: req.body.name,
      version: req.body.version,
      colorist: req.body.colorist,
      notes: req.body.notes,
      tags: req.body.tags ? JSON.parse(req.body.tags) : []
    };

    if (!metadata.projectId || !metadata.name || !metadata.version) {
      return res.status(400).json({ error: '项目ID、名称、版本号为必填项' });
    }

    const result = await lutService.uploadLut(req.file, metadata, req.body.operator || 'system');
    res.status(201).json(result);
  } catch (error) {
    if (req.file) {
      await fs.remove(req.file.path).catch(() => {});
    }
    res.status(400).json({ error: error.message });
  }
});

router.post('/overwrite', upload.single('lutFile'), async (req, res) => {
  try {
    if (req.fileValidationError) {
      return res.status(400).json({ error: req.fileValidationError });
    }
    if (!req.file) {
      return res.status(400).json({ error: '请上传LUT文件' });
    }

    const metadata = {
      projectId: parseInt(req.body.projectId),
      sceneId: req.body.sceneId ? parseInt(req.body.sceneId) : null,
      name: req.body.name,
      version: req.body.version,
      colorist: req.body.colorist,
      notes: req.body.notes,
      reason: req.body.reason
    };

    if (!metadata.projectId || !metadata.name || !metadata.version) {
      return res.status(400).json({ error: '项目ID、名称、版本号为必填项' });
    }

    const result = await lutService.overwriteVersion(req.file, metadata, req.body.operator || 'system');
    res.json(result);
  } catch (error) {
    if (req.file) {
      await fs.remove(req.file.path).catch(() => {});
    }
    res.status(400).json({ error: error.message });
  }
});

router.post('/supplement', upload.single('lutFile'), async (req, res) => {
  try {
    if (req.fileValidationError) {
      return res.status(400).json({ error: req.fileValidationError });
    }
    if (!req.file) {
      return res.status(400).json({ error: '请上传LUT文件' });
    }

    const metadata = {
      projectId: parseInt(req.body.projectId),
      sceneId: req.body.sceneId ? parseInt(req.body.sceneId) : null,
      name: req.body.name,
      version: req.body.version,
      colorist: req.body.colorist,
      notes: req.body.notes,
      reason: req.body.reason
    };

    if (!metadata.projectId || !metadata.name || !metadata.version || !metadata.reason) {
      return res.status(400).json({ error: '项目ID、名称、版本号、补录原因为必填项' });
    }

    const result = await lutService.supplementLut(req.file, metadata, req.body.operator || 'system');
    res.status(201).json(result);
  } catch (error) {
    if (req.file) {
      await fs.remove(req.file.path).catch(() => {});
    }
    res.status(400).json({ error: error.message });
  }
});

router.get('/conflicts/list', async (req, res) => {
  try {
    const conflicts = await conflictService.getConflicts(
      req.query.lutUuid,
      req.query.resolved === 'true'
    );
    res.json(conflicts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/conflicts/:id/resolve', async (req, res) => {
  try {
    const { resolvedBy, resolutionNote } = req.body;
    await conflictService.resolveConflict(req.params.id, resolvedBy, resolutionNote);
    res.json({ message: '冲突已解决' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/conflicts/check', upload.single('lutFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传LUT文件' });
    }

    const hashService = require('../services/hash.service');
    const fileHash = await hashService.calculateFileHash(req.file.path);

    const duplicates = await conflictService.detectDuplicateFile(fileHash);

    const result = {
      fileHash,
      hasConflict: !!duplicates,
      duplicates: duplicates || []
    };

    await fs.remove(req.file.path);
    res.json(result);
  } catch (error) {
    if (req.file) {
      await fs.remove(req.file.path).catch(() => {});
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.projectId) filters.projectId = parseInt(req.query.projectId);
    if (req.query.sceneId) filters.sceneId = parseInt(req.query.sceneId);
    if (req.query.name) filters.name = req.query.name;
    if (req.query.version) filters.version = req.query.version;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.colorist) filters.colorist = req.query.colorist;
    if (req.query.fileHash) filters.fileHash = req.query.fileHash;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.offset) filters.offset = parseInt(req.query.offset);

    const luts = await lutService.queryLuts(filters);
    res.json(luts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:uuid/withdraw', async (req, res) => {
  try {
    const { reason, operator } = req.body;
    const result = await lutService.withdrawLut(req.params.uuid, reason, operator || 'system');
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:uuid/export', async (req, res) => {
  try {
    const { filePath, fileName } = await exportService.exportFullReport(req.params.uuid);
    res.download(filePath, fileName);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:uuid/archives', async (req, res) => {
  try {
    const archives = await archiveService.listArchives(req.params.uuid);
    res.json(archives);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:uuid', async (req, res) => {
  try {
    const lut = await lutService.getLutByUuid(req.params.uuid);
    if (!lut) {
      return res.status(404).json({ error: 'LUT记录不存在' });
    }
    res.json(lut);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
