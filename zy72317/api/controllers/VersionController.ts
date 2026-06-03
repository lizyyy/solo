import { Request, Response } from 'express';
import type { CreateVersionRequest } from '../../shared/types';
import { versionService } from '../services/VersionService';

export class VersionController {
  async getVersions(req: Request, res: Response) {
    try {
      const versions = versionService.getAllVersions();
      return res.json(versions);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async getVersionById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const version = versionService.getVersionById(id);
      if (!version) {
        return res.status(404).json({ error: '版本不存在' });
      }
      return res.json(version);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async getLatestVersion(req: Request, res: Response) {
    try {
      const version = versionService.getLatestVersion();
      return res.json(version);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async createVersion(req: Request, res: Response) {
    try {
      const { versionNo, createdBy } = req.body as CreateVersionRequest;
      if (!versionNo) {
        return res.status(400).json({ error: '请提供版本号' });
      }
      const result = versionService.createVersion(versionNo, createdBy || '吴老师');
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async publishVersion(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = versionService.publishVersion(id);
      if (!result) {
        return res.status(404).json({ error: '版本不存在' });
      }
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async canPublish(req: Request, res: Response) {
    try {
      const result = versionService.canPublish();
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
}

export const versionController = new VersionController();
