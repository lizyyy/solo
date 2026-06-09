import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as screenshotService from '../services/screenshot.service.js';
import { UPLOADS_DIR } from '../db.js';

const router = Router();

const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowed = /^image\/(jpe?g|png|gif|webp)$/i;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持图片格式上传 (jpg/png/gif/webp)'));
    }
  },
});

router.post(
  '/tasks/:taskId/screenshots',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'Missing file' });
        return;
      }

      let standardTags: string[] = [];
      if (req.body.standardTags) {
        if (typeof req.body.standardTags === 'string') {
          try {
            standardTags = JSON.parse(req.body.standardTags);
          } catch {
            standardTags = [req.body.standardTags];
          }
        } else if (Array.isArray(req.body.standardTags)) {
          standardTags = req.body.standardTags;
        }
      }

      const layerId = req.body.layerId as string | undefined;
      const caption = (req.body.caption as string) || '';
      let boundVersion: number | undefined;
      if (req.body.boundVersion !== undefined && req.body.boundVersion !== '') {
        const v = Number(req.body.boundVersion);
        if (!Number.isNaN(v)) boundVersion = v;
      }

      if (!standardTags || !Array.isArray(standardTags) || standardTags.length === 0) {
        res.status(400).json({ success: false, error: 'standardTags must be a non-empty array' });
        return;
      }

      fs.mkdirSync(UPLOADS_DIR, { recursive: true });

      const shot = await screenshotService.upload(req.params.taskId, req.file, {
        layerId,
        caption,
        standardTags,
        boundVersion,
      });
      res.status(201).json({ success: true, data: shot });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/tasks/:taskId/screenshots', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const screenshots = await screenshotService.listByTask(req.params.taskId);
    res.json({ success: true, data: screenshots });
  } catch (err) {
    next(err);
  }
});

router.get('/screenshots/:id/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shot = await screenshotService.getScreenshot(req.params.id);
    if (!shot || shot.isDeleted) {
      res.status(404).json({ success: false, error: 'Screenshot not found' });
      return;
    }

    if (/^https?:\/\//i.test(shot.storedPath)) {
      res.redirect(shot.storedPath);
      return;
    }

    const filePath = path.resolve(shot.storedPath);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'File missing on disk' });
      return;
    }

    res.download(filePath, shot.fileName);
  } catch (err) {
    next(err);
  }
});

router.delete('/screenshots/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ok = await screenshotService.softDelete(req.params.id);
    if (!ok) {
      res.status(404).json({ success: false, error: 'Screenshot not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
