import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  HsCodeVersion,
  HsCodeVerificationStatus,
} from '../../entities/hs-code-version.entity';
import { ClearanceBatchService } from '../clearance-batch/clearance-batch.service';
import {
  CreateHsCodeVersionDto,
  HsCodeVersionFilterDto,
} from './dto/hs-code-version.dto';

@Injectable()
export class HsCodeVersionService {
  constructor(
    @InjectRepository(HsCodeVersion)
    private readonly hsCodeRepository: Repository<HsCodeVersion>,
    private readonly batchService: ClearanceBatchService,
  ) {}

  async create(dto: CreateHsCodeVersionDto): Promise<HsCodeVersion[]> {
    await this.batchService.findOne(dto.batchId);

    const existingCodes = await this.hsCodeRepository.find({
      where: { batchId: dto.batchId, source: dto.source },
      order: { version: 'DESC' },
    });

    const newVersion = existingCodes.length > 0 ? existingCodes[0].version + 1 : 1;

    await this.hsCodeRepository.update(
      { batchId: dto.batchId, source: dto.source },
      { isActive: false },
    );

    const hsCodeVersions: HsCodeVersion[] = [];

    for (const item of dto.items) {
      const hsCodeVersion = this.hsCodeRepository.create({
        ...item,
        batchId: dto.batchId,
        source: dto.source,
        version: newVersion,
        isActive: true,
        verificationStatus: HsCodeVerificationStatus.PENDING,
      });
      hsCodeVersions.push(hsCodeVersion);
    }

    return this.hsCodeRepository.save(hsCodeVersions);
  }

  async findAll(filter: HsCodeVersionFilterDto): Promise<HsCodeVersion[]> {
    const queryBuilder = this.hsCodeRepository.createQueryBuilder('hsCode');

    if (filter.batchId) {
      queryBuilder.andWhere('hsCode.batchId = :batchId', { batchId: filter.batchId });
    }

    if (filter.source) {
      queryBuilder.andWhere('hsCode.source = :source', { source: filter.source });
    }

    queryBuilder.orderBy('hsCode.version', 'DESC');
    queryBuilder.addOrderBy('hsCode.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async findActiveByBatch(batchId: string): Promise<HsCodeVersion[]> {
    return this.hsCodeRepository.find({
      where: { batchId, isActive: true },
      order: { source: 'ASC' },
    });
  }

  async findActiveByBatchAndSource(
    batchId: string,
    source: string,
  ): Promise<HsCodeVersion[]> {
    return this.hsCodeRepository.find({
      where: { batchId, isActive: true, source: source as any },
    });
  }

  async findLatestVersionByBatchAndSource(batchId: string, source: string): Promise<number> {
    const codes = await this.hsCodeRepository.find({
      where: { batchId, source: source as any },
      order: { version: 'DESC' },
      take: 1,
    });
    return codes.length > 0 ? codes[0].version : 0;
  }

  async updateVerificationStatus(
    id: string,
    status: HsCodeVerificationStatus,
    message?: string,
  ): Promise<HsCodeVersion> {
    const hsCode = await this.hsCodeRepository.findOne({ where: { id } });
    if (!hsCode) {
      throw new Error(`HS编码记录 ${id} 不存在`);
    }
    hsCode.verificationStatus = status;
    if (message) {
      hsCode.verificationMessage = message;
    }
    return this.hsCodeRepository.save(hsCode);
  }
}
