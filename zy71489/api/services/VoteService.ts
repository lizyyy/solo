import { createReadStream } from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import csvParser from 'csv-parser';
import type { Vote, ImportResult, SourceInfo, BadDataRecord } from '../../shared/types.js';
import { VoteRepo } from '../repositories/VoteRepo.js';
import { BadDataRepo } from '../repositories/BadDataRepo.js';
import { AuditRepo } from '../repositories/AuditRepo.js';
import { TrackRepo } from '../repositories/TrackRepo.js';
import { validateVoteRow } from '../engines/Validator.js';
import { dedupeVotes } from '../engines/DedupeEngine.js';

export class VoteService {
  private voteRepo: VoteRepo;
  private badDataRepo: BadDataRepo;
  private auditRepo: AuditRepo;
  private trackRepo: TrackRepo;

  constructor() {
    this.voteRepo = new VoteRepo();
    this.badDataRepo = new BadDataRepo();
    this.auditRepo = new AuditRepo();
    this.trackRepo = new TrackRepo();
  }

  async importVotesFromCSV(
    filePath: string,
    fileName: string,
    operator: string
  ): Promise<ImportResult> {
    const importSession = uuidv4();
    const badDataRecords: BadDataRecord[] = [];
    const validVotes: Omit<Vote, 'createdAt'>[] = [];
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

          const badData = validateVoteRow(row, lineNumber, context);
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

          const source: SourceInfo = {
            sourceType: 'csv-import',
            fileName,
            lineNumber,
            rawContent: JSON.stringify(row),
            importedBy: operator,
            importedAt: new Date().toISOString(),
          };

          const vote: Omit<Vote, 'createdAt'> = {
            id: uuidv4(),
            trackId: trackId!,
            trackName: row.trackName || tracks.find(t => t.id === trackId)?.name || '',
            voterId: row.voterId,
            voterName: row.voterName,
            votedAt: row.votedAt || new Date().toISOString(),
            isDuplicate: false,
            duplicateOf: undefined,
            source,
          };

          validVotes.push(vote);
        })
        .on('end', () => {
          this.badDataRepo.createBatch(badDataRecords);

          const savedVotes: Vote[] = [];
          for (const vote of validVotes) {
            const saved = this.voteRepo.create(vote);
            savedVotes.push(saved);
          }

          const dedupeRules = [
            { field: 'voterId' as const, enabled: true },
            { field: 'voterName' as const, enabled: true },
            { field: 'trackName' as const, enabled: false },
          ];

          const dedupedVotes = dedupeVotes(savedVotes, dedupeRules);
          let duplicateCount = 0;

          for (const vote of dedupedVotes) {
            if (vote.isDuplicate && vote.duplicateOf) {
              this.voteRepo.markAsDuplicate(vote.id, vote.duplicateOf);
              duplicateCount++;
            }
          }

          this.auditRepo.create({
            id: uuidv4(),
            action: 'import',
            entityType: 'vote',
            beforeChange: undefined,
            afterChange: {
              file: fileName,
              total: validVotes.length + badDataRecords.length,
              success: validVotes.length,
              failed: badDataRecords.length,
              duplicates: duplicateCount,
            },
            operator,
            ip: undefined,
          });

          resolve({
            success: validVotes.length,
            failed: badDataRecords.length,
            duplicates: duplicateCount,
            badData: badDataRecords,
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  getVotesByTrack(trackId: string): Vote[] {
    return this.voteRepo.findByTrackId(trackId);
  }
}

export default VoteService;
