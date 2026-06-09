process.removeAllListeners('warning');

import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { TrackRepo } from '../repos/trackRepo.js';
import { MaterialRepo } from '../repos/materialRepo.js';
import { RevisionRepo } from '../repos/revisionRepo.js';
import { TrackService } from '../services/trackService.js';
import { aliasConflictDetector, multerUpload } from '../middlewares.js';
import type { Track, Material, TrackStatus, LitterIssueType, MaterialType } from '../../shared/types.js';

const router = Router();

interface MaterialsMetaItem {
  type?: MaterialType;
  summary?: string;
  index?: number;
}

function parseAliases(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((s: unknown) => String(s)).filter(Boolean);
  } catch {
    // ignore
  }
  return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
}

function parseMaterialsMeta(raw: string | undefined): MaterialsMetaItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as MaterialsMetaItem[];
  } catch {
    // ignore
  }
  return [];
}

function parseSortBy(raw: unknown): 'createdAt' | 'updatedAt' | 'petName' | undefined {
  if (!raw) return undefined;
  const s = String(raw);
  if (s === 'createdAt' || s === 'updatedAt' || s === 'petName') return s;
  return undefined;
}

function getFilesFromRequest(req: Request): Express.Multer.File[] {
  const files = req.files;
  if (!files) return [];
  if (Array.isArray(files)) return files;
  return [];
}

function getFileFromRequest(req: Request): Express.Multer.File | undefined {
  return req.file;
}

function saveUploadedFile(trackId: string, originalName: string, buffer: Buffer): { filePath: string; fileName: string } {
  const uuid = randomUUID();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${uuid}-${safeName}`;
  const dirPath = path.resolve(process.cwd(), 'uploads', trackId);
  fs.mkdirSync(dirPath, { recursive: true });
  const filePath = path.join(dirPath, fileName);
  fs.writeFileSync(filePath, buffer);
  const relativePath = path.join('uploads', trackId, fileName).replace(/\\/g, '/');
  return { filePath: `/${relativePath}`, fileName: safeName };
}

router.get('/', (req: Request, res: Response): void => {
  try {
    const { search, status } = req.query;
    const sortBy = parseSortBy(req.query.sortBy);
    const tracks = TrackRepo.list({
      search: search ? String(search) : undefined,
      status: status ? (String(status) as TrackStatus) : undefined,
      sortBy,
    });

    const tracksWithMaterials: Track[] = tracks.map((track) => ({
      ...track,
      materials: MaterialRepo.listByTrackId(track.id),
    }));

    res.json({ data: tracksWithMaterials });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '获取追踪档案列表失败';
    res.status(500).json({ error: message });
  }
});

router.post('/', multerUpload.array('files'), (req: Request, res: Response): void => {
  try {
    const { petName, issueType, initialVisitDate, status, currentNote, lastOperator } = req.body;
    const aliases = parseAliases(req.body.aliases);
    const materialsMeta = parseMaterialsMeta(req.body.materialsMeta);
    const files = getFilesFromRequest(req);

    if (!petName || !issueType || !initialVisitDate || !status) {
      res.status(400).json({ error: '缺少必填字段：petName, issueType, initialVisitDate, status' });
      return;
    }

    const operator = lastOperator ? String(lastOperator) : '系统用户';
    const conflictMessage = aliasConflictDetector(String(petName), aliases);

    let track = TrackRepo.create({
      petName: String(petName),
      aliases,
      issueType: String(issueType) as LitterIssueType,
      initialVisitDate: String(initialVisitDate),
      status: String(status) as TrackStatus,
      currentNote: currentNote ? String(currentNote) : '',
      lastOperator: operator,
    });

    const createdMaterials: Material[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const meta = materialsMeta[i] || {};
      const { filePath, fileName } = saveUploadedFile(track.id, file.originalname, file.buffer);
      const material = MaterialRepo.create({
        trackId: track.id,
        type: meta.type || 'attachment',
        fileName,
        filePath,
        fileSize: file.size,
        uploadedBy: operator,
        summary: meta.summary || '',
      });
      createdMaterials.push(material);
    }

    if (conflictMessage) {
      const updated = TrackRepo.update(track.id, {
        abnormalReason: conflictMessage,
        aliasWarning: true,
      });
      if (updated) track = updated;
    }

    res.status(201).json({
      data: {
        ...track,
        materials: createdMaterials,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '创建追踪档案失败';
    res.status(500).json({ error: message });
  }
});

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const track = TrackRepo.getById(id);
    if (!track) {
      res.status(404).json({ error: '追踪档案不存在' });
      return;
    }
    const materials = MaterialRepo.listByTrackId(id);
    res.json({ data: { ...track, materials } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '获取追踪档案失败';
    res.status(500).json({ error: message });
  }
});

router.get('/:id/history', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const track = TrackRepo.getById(id);
    if (!track) {
      res.status(404).json({ error: '追踪档案不存在' });
      return;
    }
    const revisions = RevisionRepo.listByTrackId(id);
    res.json({ data: revisions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '获取修订历史失败';
    res.status(500).json({ error: message });
  }
});

router.get('/:id/timeline', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const track = TrackRepo.getById(id);
    if (!track) {
      res.status(404).json({ error: '追踪档案不存在' });
      return;
    }
    const timeline = TrackService.getTimeline(id);
    res.json({ data: timeline });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '获取时间线失败';
    res.status(500).json({ error: message });
  }
});

router.post('/:id/revise', multerUpload.array('files'), (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { newStatus, reviseReason, note, operator } = req.body;
    const materialsMeta = parseMaterialsMeta(req.body.materialsMeta);
    const files = getFilesFromRequest(req);

    if (!newStatus || !reviseReason) {
      res.status(400).json({ error: '缺少必填字段：newStatus, reviseReason' });
      return;
    }

    const track = TrackRepo.getById(id);
    if (!track) {
      res.status(404).json({ error: '追踪档案不存在' });
      return;
    }

    const newMaterials: Array<{
      type: MaterialType;
      fileName: string;
      filePath: string;
      fileSize: number;
      summary: string;
      uploadedBy: string;
    }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const meta = materialsMeta[i] || {};
      const { filePath, fileName } = saveUploadedFile(id, file.originalname, file.buffer);
      newMaterials.push({
        type: meta.type || 'attachment',
        fileName,
        filePath,
        fileSize: file.size,
        summary: meta.summary || '',
        uploadedBy: operator ? String(operator) : track.lastOperator,
      });
    }

    const result = TrackService.reviseTrack({
      trackId: id,
      newStatus: String(newStatus) as TrackStatus,
      reviseReason: String(reviseReason),
      note: note ? String(note) : undefined,
      operator: operator ? String(operator) : track.lastOperator,
      newMaterials,
    });

    if (!result) {
      res.status(500).json({ error: '修订失败' });
      return;
    }

    res.json({ data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '修订追踪档案失败';
    res.status(500).json({ error: message });
  }
});

router.post('/:id/materials', multerUpload.single('file'), (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { type, summary, replacedMaterialId, uploadedBy } = req.body;
    const file = getFileFromRequest(req);

    const track = TrackRepo.getById(id);
    if (!track) {
      res.status(404).json({ error: '追踪档案不存在' });
      return;
    }

    if (!file) {
      res.status(400).json({ error: '未上传文件' });
      return;
    }

    if (!type) {
      res.status(400).json({ error: '缺少必填字段：type' });
      return;
    }

    const { filePath, fileName } = saveUploadedFile(id, file.originalname, file.buffer);

    let version = 1;
    let hasConsistencyChange = false;

    if (replacedMaterialId) {
      const oldMaterial = MaterialRepo.getById(String(replacedMaterialId));
      if (oldMaterial) {
        version = oldMaterial.version + 1;
        hasConsistencyChange = true;
        MaterialRepo.markReplaced(String(replacedMaterialId), '');
      }
    }

    const material = MaterialRepo.create({
      trackId: id,
      type: String(type) as MaterialType,
      fileName,
      filePath,
      fileSize: file.size,
      uploadedBy: uploadedBy ? String(uploadedBy) : track.lastOperator,
      summary: summary ? String(summary) : '',
      replacedMaterialId: replacedMaterialId ? String(replacedMaterialId) : undefined,
      version,
      hasConsistencyChange,
    });

    res.status(201).json({ data: material });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '上传材料失败';
    res.status(500).json({ error: message });
  }
});

router.get('/:id/handoff', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const track = TrackRepo.getById(id);
    if (!track) {
      res.status(404).json({ error: '追踪档案不存在' });
      return;
    }
    const text = TrackService.getHandoffText(id);
    res.json({ data: text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '生成交班报告失败';
    res.status(500).json({ error: message });
  }
});

export default router;
