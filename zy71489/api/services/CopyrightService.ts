import { createReadStream } from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import csvParser from 'csv-parser';
import type { Copyright, ImportResult, SourceInfo, BadDataRecord } from '../../shared/types.js';
import { CopyrightRepo } from '../repositories/CopyrightRepo.js';
import { BadDataRepo } from '../repositories/BadDataRepo.js';
import { AuditRepo } from '../repositories/AuditRepo.js';
import { TrackRepo } from '../repositories/TrackRepo.js';
import { validateCopyrightRow } from '../engines/Validator.js';

export class CopyrightService {
  private copyrightRepo: CopyrightRepo;
  private badDataRepo: BadDataRepo;
  private auditRepo: AuditRepo;
  private trackRepo: TrackRepo;

  constructor() {
    this.copyrightRepo = new CopyrightRepo();
    this.badDataRepo = new BadDataRepo();
    this.auditRepo = new AuditRepo();
    this.trackRepo = new TrackRepo();
  }

  async importCopyrightsFromCSV(
    filePath: string,
    fileName: string,
    operator: string
  ): Promise<ImportResult> {
    const importSession = uuidv4();
    const badDataRecords: BadDataRecord[] = [];
    const validCopyrights: Array<Omit<Copyright, 'updatedAt'>> = [];
    let lineNumber = 0;

    const context = {
      sourceFile: fileName,
      importSession,
    };

    const tracks = this.trackRepo.findAll();
    const trackNameToId = new Map(tracks.map(t => [t.name.toLowerCase(), t.id]));

    return new Promise((resolve, reject) => {
      createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row: any) => {
          lineNumber++;

          const badData = validateCopyrightRow(row, lineNumber, context);
          if (badData) {
            badDataRecords.push(badData);
            return;
          }

          let trackId = row.trackId;
          if (!trackId && row.trackName) {
            trackId = trackNameToId.get(row.trackName.toLowerCase());
            if (!trackId) {
              badDataRecords.push({
                id: uuidv4(),
                sourceFile: fileName,
                lineNumber,
                rawContent: JSON.stringify(row),
                errorType: 'unknown_track',
                errorMessage: `找不到曲目: ${row.trackName}`,
                detectedAt: new Date().toISOString(),
                importSession,
              });
              return;
            }
          }

          let warningLevel: 'high' | 'medium' | 'low' = row.warningLevel || 'low';
          if (row.status === 'expired') {
            warningLevel = 'high';
          }

          const source: SourceInfo = {
            sourceType: 'csv-import',
            fileName,
            lineNumber,
            rawContent: JSON.stringify(row),
            importedBy: operator,
            importedAt: new Date().toISOString(),
          };

          const copyright: Omit<Copyright, 'updatedAt'> = {
            id: uuidv4(),
            trackId: trackId!,
            trackName: row.trackName || tracks.find(t => t.id === trackId)?.name || '',
            status: row.status,
            expiredAt: row.expiredAt,
            warningLevel,
            licenseNumber: row.licenseNumber,
            source,
          };

          validCopyrights.push(copyright);
        })
        .on('end', () => {
          let successCount = 0;
          const existingCopyrights = this.copyrightRepo.findAll();
          const trackIdToExisting = new Map<string, Copyright | null>();
          const trackIdHasHighWarning = new Map<string, boolean>();

          for (const c of existingCopyrights) {
            if (!trackIdToExisting.has(c.trackId) || c.updatedAt > (trackIdToExisting.get(c.trackId)?.updatedAt || '')) {
              trackIdToExisting.set(c.trackId, c);
            }
            if (c.warningLevel === 'high') {
              trackIdHasHighWarning.set(c.trackId, true);
            }
          }

          for (const copyright of validCopyrights) {
            const hasHighWarning = trackIdHasHighWarning.get(copyright.trackId) === true;

            if (hasHighWarning) {
              badDataRecords.push({
                id: uuidv4(),
                sourceFile: fileName,
                lineNumber: copyright.source.lineNumber || 0,
                rawContent: JSON.stringify(copyright),
                errorType: 'invalid_format',
                errorMessage: `曲目 ${copyright.trackName} 已有过期版权（high 级警告），不可覆盖。请先处理历史版权问题。`,
                detectedAt: new Date().toISOString(),
                importSession,
              });
              continue;
            }

            const existing = trackIdToExisting.get(copyright.trackId);

            if (existing) {
              const updated = this.copyrightRepo.update(existing.id, {
                trackName: copyright.trackName,
                status: copyright.status,
                expiredAt: copyright.expiredAt,
                warningLevel: copyright.warningLevel,
                licenseNumber: copyright.licenseNumber,
              });

              if (updated) successCount++;
            } else {
              this.copyrightRepo.create(copyright);
              successCount++;
            }
          }

          if (badDataRecords.length > 0) {
            this.badDataRepo.createBatch(badDataRecords);
          }

          this.auditRepo.create({
            id: uuidv4(),
            action: 'import',
            entityType: 'copyright',
            beforeChange: undefined,
            afterChange: {
              file: fileName,
              total: validCopyrights.length + badDataRecords.length,
              success: successCount,
              failed: badDataRecords.length,
              duplicates: 0,
            },
            operator,
            ip: undefined,
          });

          resolve({
            success: successCount,
            failed: badDataRecords.length,
            duplicates: 0,
            badData: badDataRecords,
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  getCopyrightByTrack(trackId: string): Copyright | null {
    return this.copyrightRepo.findByTrackId(trackId);
  }
}

export default CopyrightService;
