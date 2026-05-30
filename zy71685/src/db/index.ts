import Dexie, { Table } from 'dexie';
import {
  Rehearsal,
  AudioTrack,
  VoicePart,
  ScoreSection,
  DetectionRun,
  Misnote,
  Confirmation,
  Comment,
  Report,
  OperationLog,
} from '@/types';

export class AppDatabase extends Dexie {
  rehearsals!: Table<Rehearsal, string>;
  audioTracks!: Table<AudioTrack, string>;
  voiceParts!: Table<VoicePart, string>;
  scoreSections!: Table<ScoreSection, string>;
  detectionRuns!: Table<DetectionRun, string>;
  misnotes!: Table<Misnote, string>;
  confirmations!: Table<Confirmation, string>;
  comments!: Table<Comment, string>;
  reports!: Table<Report, string>;
  operationLogs!: Table<OperationLog, string>;

  constructor() {
    super('MisnoteDetectorDB');
    this.version(3).stores({
      rehearsals: 'id, createdAt',
      audioTracks: 'id, rehearsalId, createdAt',
      voiceParts: 'id, rehearsalId, instrument, createdAt',
      scoreSections: 'id, rehearsalId, startTime, endTime',
      detectionRuns: 'id, rehearsalId, type, startedAt',
      misnotes: 'id, rehearsalId, detectionRunId, voicePartId, time, problemType, confirmationStatus, sourceType',
      confirmations: 'id, misnoteId, createdAt',
      comments: 'id, misnoteId, createdAt',
      reports: 'id, rehearsalId, createdAt',
      operationLogs: 'id, rehearsalId, operationType, createdAt',
    });
  }
}

export const db = new AppDatabase();

export async function clearDatabase(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
    }
  });
}

export async function exportDatabase(): Promise<string> {
  const data: Record<string, unknown[]> = {};
  for (const table of db.tables) {
    data[table.name] = await table.toArray();
  }
  return JSON.stringify(data, null, 2);
}

export async function importDatabase(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString);
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      if (data[table.name]) {
        await table.bulkPut(data[table.name]);
      }
    }
  });
}
