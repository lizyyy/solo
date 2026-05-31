import Dexie, { Table } from 'dexie';
import { AudioTrack, Segment, ConfirmRecord, OperationLog } from '../types';

export class PodcastSegmentDB extends Dexie {
  audioTracks!: Table<AudioTrack, string>;
  segments!: Table<Segment, string>;
  confirmRecords!: Table<ConfirmRecord, string>;
  operationLogs!: Table<OperationLog, string>;

  constructor() {
    super('PodcastSegmentDB');
    this.version(1).stores({
      audioTracks: 'id, fileHash, name, createdAt',
      segments: 'id, trackId, status, startTime, endTime, anomalyType',
      confirmRecords: 'id, segmentId, trackId, timestamp',
      operationLogs: 'id, trackId, actionType, timestamp'
    });
  }

  async findTrackByHash(fileHash: string): Promise<AudioTrack | undefined> {
    return this.audioTracks.where('fileHash').equals(fileHash).first();
  }

  async getSegmentsByTrack(trackId: string): Promise<Segment[]> {
    return this.segments.where('trackId').equals(trackId).sortBy('startTime');
  }

  async getLogsByTrack(trackId: string): Promise<OperationLog[]> {
    return this.operationLogs.where('trackId').equals(trackId).reverse().sortBy('timestamp');
  }

  async getConfirmRecordsByTrack(trackId: string): Promise<ConfirmRecord[]> {
    return this.confirmRecords.where('trackId').equals(trackId).reverse().sortBy('timestamp');
  }

  async addOperationLog(log: Omit<OperationLog, 'id'>): Promise<string> {
    const id = crypto.randomUUID();
    await this.operationLogs.add({ ...log, id });
    return id;
  }

  async addConfirmRecord(record: Omit<ConfirmRecord, 'id'>): Promise<string> {
    const id = crypto.randomUUID();
    await this.confirmRecords.add({ ...record, id });
    return id;
  }

  async saveFullTrack(
    track: Omit<AudioTrack, 'id' | 'createdAt' | 'updatedAt'>,
    segments: Omit<Segment, 'id' | 'version' | 'createdAt' | 'updatedAt'>[]
  ): Promise<{ trackId: string; segmentIds: string[] }> {
    const now = new Date();
    const trackId = crypto.randomUUID();
    const segmentIds: string[] = [];

    await this.transaction('rw', this.audioTracks, this.segments, async () => {
      await this.audioTracks.add({
        ...track,
        id: trackId,
        createdAt: now,
        updatedAt: now
      });

      for (const segment of segments) {
        const segmentId = crypto.randomUUID();
        segmentIds.push(segmentId);
        await this.segments.add({
          ...segment,
          id: segmentId,
          trackId,
          version: 1,
          createdAt: now,
          updatedAt: now
        });
      }
    });

    return { trackId, segmentIds };
  }
}

export const db = new PodcastSegmentDB();
