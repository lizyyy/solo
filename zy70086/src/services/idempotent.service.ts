import { Repository } from 'typeorm';
import { IdempotentRecord } from '../entities';
import { AppDataSource } from '../database/data-source';

export class IdempotentService {
  private repo: Repository<IdempotentRecord>;

  constructor() {
    this.repo = AppDataSource.getRepository(IdempotentRecord);
  }

  async checkOrReserve(
    bizType: string,
    idempotentKey: string,
    requestSnapshot?: string,
  ): Promise<{ reserved: boolean; existing: IdempotentRecord | null }> {
    let record = await this.repo.findOne({
      where: { bizType, idempotentKey },
    });

    if (record) {
      return { reserved: false, existing: record };
    }

    try {
      record = this.repo.create({
        bizType,
        idempotentKey,
        requestSnapshot: requestSnapshot || null,
        status: 'PROCESSING',
      });
      record = await this.repo.save(record);
      return { reserved: true, existing: null };
    } catch (e: any) {
      if (e && (e.code === 'SQLITE_CONSTRAINT' || (e.message && e.message.includes('UNIQUE')))) {
        record = (await this.repo.findOne({ where: { bizType, idempotentKey } }))!;
        return { reserved: false, existing: record };
      }
      throw e;
    }
  }

  async markSuccess(
    bizType: string,
    idempotentKey: string,
    bizId: string,
    responseSnapshot?: string,
  ): Promise<void> {
    await this.repo.update(
      { bizType, idempotentKey },
      {
        status: 'SUCCESS',
        bizId,
        responseSnapshot: responseSnapshot || null,
      },
    );
  }

  async markFailed(bizType: string, idempotentKey: string): Promise<void> {
    await this.repo.update(
      { bizType, idempotentKey },
      { status: 'FAILED' },
    );
  }

  async getRecord(bizType: string, idempotentKey: string): Promise<IdempotentRecord | null> {
    return this.repo.findOne({ where: { bizType, idempotentKey } });
  }
}
