import { v4 as uuidv4 } from 'uuid';
import { insertOne, findOne, findMany, updateOne } from '../database';
import {
  PlaylistColdStartCard,
  CardStatus,
  SelfCheckResult,
  CardVersionSnapshot,
} from '../types';

export class CardService {
  createCard(playlistName: string, createdBy: string): PlaylistColdStartCard {
    const now = new Date().toISOString();
    const card: PlaylistColdStartCard = {
      id: uuidv4(),
      playlistName,
      createdBy,
      createdAt: now,
      updatedAt: now,
      status: 'DRAFT',
      currentVersion: 1,
      selfCheckResults: [],
    };

    insertOne('cards', card);
    this.createSnapshot(card, createdBy);
    return card;
  }

  getCard(cardId: string): PlaylistColdStartCard | null {
    const row = findOne('cards', (c: any) => c.id === cardId);
    if (!row) return null;
    return row as PlaylistColdStartCard;
  }

  listCards(): PlaylistColdStartCard[] {
    return findMany('cards').sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ) as PlaylistColdStartCard[];
  }

  updateCardStatus(cardId: string, status: CardStatus, updatedBy: string): PlaylistColdStartCard | null {
    const card = this.getCard(cardId);
    if (!card) return null;

    const now = new Date().toISOString();
    const updated = updateOne(
      'cards',
      (c: any) => c.id === cardId,
      { status, updatedAt: now, currentVersion: card.currentVersion + 1 }
    );

    if (updated) {
      this.createSnapshot(updated as PlaylistColdStartCard, updatedBy);
    }

    return updated as PlaylistColdStartCard | null;
  }

  updateCardFields(cardId: string, fields: Partial<PlaylistColdStartCard>): PlaylistColdStartCard | null {
    const now = new Date().toISOString();
    const updated = updateOne(
      'cards',
      (c: any) => c.id === cardId,
      { ...fields, updatedAt: now }
    );
    return updated as PlaylistColdStartCard | null;
  }

  updateSelfCheckResults(cardId: string, results: SelfCheckResult[]): PlaylistColdStartCard | null {
    return this.updateCardFields(cardId, { selfCheckResults: results });
  }

  private createSnapshot(card: PlaylistColdStartCard, createdBy: string): CardVersionSnapshot {
    const now = new Date().toISOString();
    const snapshot: CardVersionSnapshot = {
      id: uuidv4(),
      cardId: card.id,
      version: card.currentVersion,
      status: card.status,
      attendanceBatchId: card.attendanceBatchId,
      ticketBatchId: card.ticketBatchId,
      revenueVersion: card.revenueVersion,
      snapshotData: JSON.parse(JSON.stringify(card)),
      createdAt: now,
      createdBy,
    };

    insertOne('snapshots', snapshot);
    return snapshot;
  }

  getLatestSnapshot(cardId: string): CardVersionSnapshot | null {
    const snapshots = findMany('snapshots', (s: any) => s.cardId === cardId)
      .sort((a, b) => b.version - a.version);
    return snapshots[0] as CardVersionSnapshot || null;
  }

  getSnapshotByVersion(cardId: string, version: number): CardVersionSnapshot | null {
    const snapshot = findOne(
      'snapshots',
      (s: any) => s.cardId === cardId && s.version === version
    );
    return snapshot as CardVersionSnapshot || null;
  }
}
