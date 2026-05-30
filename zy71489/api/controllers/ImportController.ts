import { type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import multer from 'multer';
import os from 'os';
import db from '../db/index.js';
import VoteRepo from '../repositories/VoteRepo.js';
import CopyrightRepo from '../repositories/CopyrightRepo.js';
import TrackRepo from '../repositories/TrackRepo.js';
import BadDataRepo from '../repositories/BadDataRepo.js';
import AuditRepo from '../repositories/AuditRepo.js';
import CopyrightService from '../services/CopyrightService.js';
import { validateVoteRow, validateCopyrightRow } from '../engines/Validator.js';
import { dedupeVotes } from '../engines/DedupeEngine.js';
import type { Vote, Copyright, SourceInfo, BadDataRecord, ImportResult, DedupeRule } from '../../shared/types.js';

const voteRepo = new VoteRepo();
const copyrightRepo = new CopyrightRepo();
const trackRepo = new TrackRepo();
const badDataRepo = new BadDataRepo();
const auditRepo = new AuditRepo();
const copyrightService = new CopyrightService();

const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encore-import-'));

export const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传 CSV 文件'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

async function parseCsvFile(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

export async function importVotes(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({
      success: false,
      error: '请上传 CSV 文件',
    });
    return;
  }

  const importSession = uuidv4();
  const sourceFile = req.file.originalname;
  const context = { sourceFile, importSession };

  try {
    const rows = await parseCsvFile(req.file.path);
    const tracks = trackRepo.findAll();
    const trackNameMap = new Map(tracks.map((t) => [t.name.toLowerCase(), t.id]));

    const badDataRecords: BadDataRecord[] = [];
    const validVotes: Omit<Vote, 'createdAt'>[] = [];
    const source: SourceInfo = {
      sourceType: 'csv-import',
      fileName: sourceFile,
      importedBy: req.ip || 'unknown',
      importedAt: new Date().toISOString(),
    };

    rows.forEach((row, index) => {
      const lineNumber = index + 2;
      source.lineNumber = lineNumber;
      source.rawContent = JSON.stringify(row);

      const badData = validateVoteRow(row, lineNumber, context);
      if (badData) {
        badDataRecords.push(badData);
        return;
      }

      let trackId = row.trackId;
      if (!trackId && row.trackName) {
        trackId = trackNameMap.get(row.trackName.toLowerCase());
        if (!trackId) {
          badDataRecords.push({
            id: uuidv4(),
            sourceFile,
            lineNumber,
            rawContent: JSON.stringify(row),
            errorType: 'unknown_track',
            errorMessage: `未找到曲目: ${row.trackName}`,
            detectedAt: new Date().toISOString(),
            importSession,
          });
          return;
        }
      }

      const trackName = row.trackName || tracks.find((t) => t.id === trackId)?.name || '';

      validVotes.push({
        id: uuidv4(),
        trackId,
        trackName,
        voterId: row.voterId,
        voterName: row.voterName,
        votedAt: row.votedAt || new Date().toISOString(),
        isDuplicate: false,
        source,
      });
    });

    const dedupeRules: DedupeRule[] = [
      { field: 'voterId', enabled: true },
      { field: 'voterName', enabled: true },
      { field: 'trackName', enabled: false },
    ];
    const dedupedVotes = dedupeVotes(validVotes as Vote[], dedupeRules);
    const duplicateCount = dedupedVotes.filter((v) => v.isDuplicate).length;

    const tx = db.transaction(() => {
      for (const vote of dedupedVotes) {
        voteRepo.create(vote);
      }
      if (badDataRecords.length > 0) {
        badDataRepo.createBatch(badDataRecords);
      }
    });
    tx();

    const result: ImportResult = {
      success: dedupedVotes.filter((v) => !v.isDuplicate).length,
      failed: badDataRecords.length,
      duplicates: duplicateCount,
      badData: badDataRecords,
    };

    auditRepo.create({
      id: uuidv4(),
      action: 'import',
      entityType: 'vote',
      afterChange: { importSession, result },
      operator: req.ip || 'unknown',
      ip: req.ip,
    });

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '导入投票失败',
    });
  }
}

export async function importCopyrights(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({
      success: false,
      error: '请上传 CSV 文件',
    });
    return;
  }

  try {
    const result = await copyrightService.importCopyrightsFromCSV(
      req.file.path,
      req.file.originalname,
      req.ip || 'unknown'
    );

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '导入版权失败',
    });
  }
}
