import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Track } from '../entities/Track';
import { EntityType, TrackStatus } from '../entities/enums';
import { AuditService } from './AuditService';

export interface TrackCreateData {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  isrc?: string;
  upc?: string;
  lyrics?: string;
  notes?: string;
  genre?: string;
  releaseDate?: Date;
  territory?: string;
  isExplicit?: boolean;
  paymentAmount?: number;
  paymentTerms?: string;
  contractId?: string;
  rosterPriority?: number;
  createdBy?: string;
}

export interface TrackUpdateData {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  isrc?: string;
  upc?: string;
  lyrics?: string;
  notes?: string;
  genre?: string;
  releaseDate?: Date;
  territory?: string;
  status?: TrackStatus;
  isExplicit?: boolean;
  paymentAmount?: number;
  paymentTerms?: string;
  contractId?: string;
  rosterPriority?: number;
  approvedBy?: string;
  approvedAt?: Date;
}

export class TrackService {
  private trackRepository: Repository<Track>;
  private auditService: AuditService;

  constructor() {
    this.trackRepository = AppDataSource.getRepository(Track);
    this.auditService = new AuditService();
  }

  async createTrack(data: TrackCreateData): Promise<Track> {
    const track = new Track();
    track.title = data.title;
    track.artist = data.artist;
    track.album = data.album;
    track.duration = data.duration;
    track.isrc = data.isrc;
    track.upc = data.upc;
    track.lyrics = data.lyrics;
    track.notes = data.notes;
    track.genre = data.genre;
    track.releaseDate = data.releaseDate;
    track.territory = data.territory;
    track.isExplicit = data.isExplicit || false;
    track.paymentAmount = data.paymentAmount;
    track.paymentTerms = data.paymentTerms;
    track.contractId = data.contractId;
    track.rosterPriority = data.rosterPriority;
    track.createdBy = data.createdBy;
    track.status = TrackStatus.DRAFT;

    const saved = await this.trackRepository.save(track);

    await this.auditService.logChange(
      EntityType.TRACK,
      saved.id,
      'status',
      undefined,
      TrackStatus.DRAFT,
      data.createdBy,
      '创建新曲目'
    );

    return saved;
  }

  async getTrack(id: number, withRelations: boolean = true): Promise<Track | null> {
    const relations = withRelations
      ? ['masterFiles', 'coverArts', 'deliveryReports', 'anomalies']
      : [];

    return this.trackRepository.findOne({
      where: { id },
      relations,
    });
  }

  async getAllTracks(status?: TrackStatus): Promise<Track[]> {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    return this.trackRepository.find({
      where,
      relations: ['masterFiles', 'coverArts', 'deliveryReports', 'anomalies'],
      order: { updatedAt: 'DESC' },
    });
  }

  async updateTrack(
    id: number,
    data: TrackUpdateData,
    modifiedBy?: string,
    reason?: string
  ): Promise<Track> {
    const track = await this.trackRepository.findOne({ where: { id } });
    if (!track) {
      throw new Error('曲目不存在');
    }

    const changes: Array<{ fieldName: string; oldValue: any; newValue: any }> = [];

    const fields: (keyof TrackUpdateData)[] = [
      'title', 'artist', 'album', 'duration', 'isrc', 'upc',
      'lyrics', 'notes', 'genre', 'releaseDate', 'territory',
      'status', 'isExplicit', 'paymentAmount', 'paymentTerms',
      'contractId', 'rosterPriority', 'approvedBy', 'approvedAt'
    ];

    for (const field of fields) {
      if (data[field] !== undefined && data[field] !== (track as any)[field]) {
        changes.push({
          fieldName: field,
          oldValue: (track as any)[field],
          newValue: data[field],
        });
        (track as any)[field] = data[field];
      }
    }

    if (data.status && data.status !== track.status) {
      changes.push({
        fieldName: 'status',
        oldValue: track.status,
        newValue: data.status,
      });
      track.status = data.status;
    }

    const saved = await this.trackRepository.save(track);

    if (changes.length > 0) {
      await this.auditService.logChanges(
        EntityType.TRACK,
        id,
        changes,
        modifiedBy,
        reason || '更新曲目信息'
      );
    }

    return saved;
  }

  async deleteTrack(id: number): Promise<void> {
    const track = await this.trackRepository.findOne({ where: { id } });
    if (!track) {
      throw new Error('曲目不存在');
    }

    await this.trackRepository.remove(track);
  }

  async searchTracks(query: string): Promise<Track[]> {
    return this.trackRepository
      .createQueryBuilder('track')
      .where('track.title LIKE :query OR track.artist LIKE :query OR track.album LIKE :query OR track.isrc LIKE :query', {
        query: `%${query}%`,
      })
      .leftJoinAndSelect('track.masterFiles', 'masterFiles')
      .leftJoinAndSelect('track.coverArts', 'coverArts')
      .leftJoinAndSelect('track.deliveryReports', 'deliveryReports')
      .leftJoinAndSelect('track.anomalies', 'anomalies')
      .orderBy('track.updatedAt', 'DESC')
      .getMany();
  }

  async getTracksByArtist(artist: string): Promise<Track[]> {
    return this.trackRepository.find({
      where: { artist },
      relations: ['masterFiles', 'coverArts', 'deliveryReports', 'anomalies'],
      order: { createdAt: 'DESC' },
    });
  }

  async approveTrack(id: number, approvedBy: string): Promise<Track> {
    return this.updateTrack(
      id,
      {
        status: TrackStatus.APPROVED,
        approvedBy,
        approvedAt: new Date(),
      },
      approvedBy,
      '曲目审批通过'
    );
  }

  async archiveTrack(id: number, modifiedBy?: string): Promise<Track> {
    return this.updateTrack(
      id,
      { status: TrackStatus.ARCHIVED },
      modifiedBy,
      '归档曲目'
    );
  }

  async getTrackStats(): Promise<{
    total: number;
    byStatus: Record<TrackStatus, number>;
    withAnomalies: number;
    missingPayment: number;
    missingRosterPriority: number;
  }> {
    const allTracks = await this.trackRepository.find({
      relations: ['anomalies'],
    });

    const stats = {
      total: allTracks.length,
      byStatus: {} as Record<TrackStatus, number>,
      withAnomalies: 0,
      missingPayment: 0,
      missingRosterPriority: 0,
    };

    for (const status of Object.values(TrackStatus)) {
      stats.byStatus[status as TrackStatus] = 0;
    }

    for (const track of allTracks) {
      stats.byStatus[track.status]++;

      if (track.anomalies && track.anomalies.some(a => a.status === 'open')) {
        stats.withAnomalies++;
      }

      if (!track.paymentAmount || !track.paymentTerms || !track.contractId) {
        stats.missingPayment++;
      }

      if (track.rosterPriority === null || track.rosterPriority === undefined) {
        stats.missingRosterPriority++;
      }
    }

    return stats;
  }
}
