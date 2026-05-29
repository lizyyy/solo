import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { initDatabase } from './database/db';
import {
  installationDao,
  materialDao,
  signatureDao,
  riskCheckDao,
  versionHistoryDao,
} from './database/dao';
import { riskEngine } from './services/riskEngine';
import { reportGenerator } from './services/reportGenerator';
import type { InstallationBase, MaterialType } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { installationId } = req.body;
    if (installationId) {
      const dir = path.join(uploadsDir, installationId);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    } else {
      cb(null, uploadsDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

async function startServer() {
  await initDatabase();

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/installations', async (req: Request, res: Response) => {
    try {
      const installations = await installationDao.getAll();
      const withRisk = [];
      for (const inst of installations) {
        const risk = await riskEngine.getRiskSummary(inst.id);
        withRisk.push({ ...inst, riskSummary: risk });
      }
      res.json(withRisk);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/installations/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const installation = await installationDao.getById(id);
      if (!installation) {
        return res.status(404).json({ error: 'Installation not found' });
      }

      const materials = await materialDao.getByInstallationId(id);
      const signatures = await signatureDao.getByInstallationId(id);
      const risk = await riskEngine.getRiskSummary(id);
      const history = await versionHistoryDao.getByInstallationId(id);

      res.json({
        installation,
        materials,
        signatures,
        risk,
        versionHistory: history,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/installations', async (req: Request, res: Response) => {
    try {
      const data: InstallationBase = req.body;

      if (!data.projectName || !data.sculptureName || !data.plannedInstallationDate) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const installation = await installationDao.create(data);

      await versionHistoryDao.create({
        installationId: installation.id,
        version: 1,
        changeType: '创建记录',
        changedBy: 'system',
      });

      res.status(201).json(installation);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.put('/api/installations/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = req.body;

      const existing = await installationDao.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Installation not found' });
      }

      const updated = await installationDao.update(id, data);
      if (!updated) {
        return res.status(500).json({ error: 'Failed to update' });
      }

      await versionHistoryDao.create({
        installationId: id,
        version: updated.version,
        changeType: '更新基本信息',
        changedBy: data.changedBy || 'system',
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete('/api/installations/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = await installationDao.delete(id);
      if (!success) {
        return res.status(404).json({ error: 'Installation not found' });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/installations/:id/status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, changedBy } = req.body;

      const existing = await installationDao.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Installation not found' });
      }

      const updated = await installationDao.update(id, { status });
      if (!updated) {
        return res.status(500).json({ error: 'Failed to update status' });
      }

      await versionHistoryDao.create({
        installationId: id,
        version: updated.version,
        changeType: `状态变更: ${existing.status} → ${status}`,
        changedBy: changedBy || 'system',
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/installations/:id/materials', upload.single('file'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { type, name } = req.body;
      const file = req.file;

      if (!type || !file) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const existing = await installationDao.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Installation not found' });
      }

      const material = await materialDao.create({
        installationId: id,
        type: type as MaterialType,
        name: name || file.originalname,
        filePath: path.relative(process.cwd(), file.path),
        fileType: file.mimetype,
        fileSize: file.size,
      });

      await versionHistoryDao.create({
        installationId: id,
        version: existing.version,
        changeType: `上传材料: ${name || file.originalname}`,
        changedBy: 'system',
      });

      res.status(201).json(material);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/installations/:id/materials', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const materials = await materialDao.getByInstallationId(id);
      res.json(materials);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/installations/:id/signatures', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { signerName, signerRole, signatureDate } = req.body;

      if (!signerName || !signerRole || !signatureDate) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const existing = await installationDao.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Installation not found' });
      }

      const signature = await signatureDao.create({
        installationId: id,
        signerName,
        signerRole,
        signatureDate,
      });

      await versionHistoryDao.create({
        installationId: id,
        version: existing.version,
        changeType: `签字确认: ${signerName} (${signerRole})`,
        changedBy: signerName,
      });

      res.status(201).json(signature);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/installations/:id/signatures', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const signatures = await signatureDao.getByInstallationId(id);
      res.json(signatures);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/installations/:id/risk-check', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const checks = await riskEngine.runAllChecks(id);
      const summary = await riskEngine.getRiskSummary(id);
      res.json({ checks, summary });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/installations/:id/risk-check', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const summary = await riskEngine.getRiskSummary(id);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/installations/:id/risk-check/:checkId', async (req: Request, res: Response) => {
    try {
      const { checkId } = req.params;
      const check = await riskCheckDao.getById(checkId);
      if (!check) {
        return res.status(404).json({ error: 'Risk check not found' });
      }
      res.json(check);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/installations/:id/export-pdf', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const reportPath = await reportGenerator.generatePDF(id);
      const fileName = path.basename(reportPath);

      res.json({
        success: true,
        downloadUrl: `/api/reports/${fileName}`,
        filePath: reportPath,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/reports/:filename', (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      const filePath = path.join(process.cwd(), 'data', 'reports', filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Report not found' });
      }

      res.download(filePath);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/installations/:id/version-history', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const history = await versionHistoryDao.getByInstallationId(id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
