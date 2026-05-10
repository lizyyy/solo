import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';

import { Batch } from '../entities/batch.entity';
import { Certificate } from '../../certificate/entities/certificate.entity';
import {
  CertificateStatus,
  FlowAction,
  ReviewPriority,
  ProcessingResult,
  UserContext,
  PaginatedResult,
  EntityType,
} from '../../../common/types';
import {
  BatchNotFoundException,
  CertificateNotFoundException,
  InvalidStatusTransitionException,
} from '../../../common/exceptions';
import { CertificateService } from '../../certificate/services/certificate.service';
import { FlowHistoryService } from '../../history/services/flow-history.service';
import { AuditLogService } from '../../history/services/audit-log.service';
import { CreateBatchDto, BindCertificatesDto, UnbindCertificatesDto, BatchQueryDto } from '../dto/batch.dto';

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);

  constructor(
    @InjectRepository(Batch)
    private readonly batchRepository: Repository<Batch>,
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
    private readonly dataSource: DataSource,
    private readonly certificateService: CertificateService,
    private readonly flowHistoryService: FlowHistoryService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    dto: CreateBatchDto,
    user: UserContext,
  ): Promise<ProcessingResult<Batch>> {
    const batch = this.batchRepository.create({
      ...dto,
      status: 'created',
      createdBy: user.userId,
      createdByName: user.userName,
    });

    const savedBatch = await this.batchRepository.save(batch);

    await this.auditLogService.log({
      entityType: EntityType.BATCH,
      entityId: savedBatch.id,
      entityNumber: savedBatch.batchNumber,
      action: 'CREATE',
      description: `创建批次: ${savedBatch.batchNumber}`,
      user,
      afterData: { ...savedBatch },
    });

    return {
      success: true,
      data: savedBatch,
      needsReview: false,
      message: '批次创建成功',
    };
  }

  async bindCertificates(
    dto: BindCertificatesDto,
    user: UserContext,
  ): Promise<ProcessingResult<{
    batch: Batch;
    boundCount: number;
    duplicates: string[];
    warnings: string[];
  }>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const batch = await this.batchRepository.findOne({
        where: { id: dto.batchId },
      });

      if (!batch) {
        throw new BatchNotFoundException(dto.batchId);
      }

      const certificates = await this.certificateRepository.find({
        where: { id: In(dto.certificateIds) },
      });

      if (certificates.length !== dto.certificateIds.length) {
        const foundIds = certificates.map((c) => c.id);
        const missingIds = dto.certificateIds.filter((id) => !foundIds.includes(id));
        throw new CertificateNotFoundException(missingIds.join(', '));
      }

      const warnings: string[] = [];
      const duplicateCerts: string[] = [];
      let actuallyBound = 0;

      for (const cert of certificates) {
        if (cert.batchId && cert.batchId !== batch.id) {
          warnings.push(`检疫证 ${cert.certificateNumber} 已绑定到其他批次，已跳过`);
          continue;
        }

        if (cert.batchId === batch.id) {
          warnings.push(`检疫证 ${cert.certificateNumber} 已绑定到当前批次，已跳过`);
          continue;
        }

        if (cert.status !== CertificateStatus.ISSUED && cert.status !== CertificateStatus.DUPLICATE_DETECTED) {
          throw new InvalidStatusTransitionException(
            cert.status,
            CertificateStatus.BATCH_BOUND,
            `检疫证 ${cert.certificateNumber} 状态为 ${cert.status}，无法绑定到批次`,
          );
        }

        if (cert.hasDuplicate) {
          duplicateCerts.push(cert.certificateNumber);
        }

        cert.batchId = batch.id;
        cert.batchNumber = batch.batchNumber;
        cert.lastOperatorId = user.userId;
        cert.lastOperatorName = user.userName;

        await this.certificateService.updateStatus(
          cert.id,
          CertificateStatus.BATCH_BOUND,
          user,
          {
            action: FlowAction.BATCH_BOUND,
            actionDescription: `绑定到批次 ${batch.batchNumber}`,
            relatedEntityId: batch.id,
            relatedEntityType: 'batch',
          },
        );

        actuallyBound++;
      }

      if (actuallyBound > 0) {
        batch.certificateCount += actuallyBound;

        const updatedCerts = await this.certificateRepository.find({
          where: { batchId: batch.id },
        });

        batch.totalAnimals = updatedCerts.reduce((sum, c) => sum + c.animalQuantity, 0);
        batch.totalWeight = updatedCerts.reduce((sum, c) => sum + (c.totalWeight || 0), 0);
        batch.hasDuplicateCertificates = updatedCerts.some((c) => c.hasDuplicate);

        await queryRunner.manager.save(Batch, batch);
      }

      await queryRunner.commitTransaction();

      const needsReview = duplicateCerts.length > 0;

      return {
        success: true,
        data: {
          batch,
          boundCount: actuallyBound,
          duplicates: duplicateCerts,
          warnings,
        },
        needsReview,
        reviewReason: needsReview ? 'BATCH_CONTAINS_DUPLICATE_CERTS' : undefined,
        reviewPriority: needsReview ? ReviewPriority.MEDIUM : undefined,
        message: needsReview
          ? `绑定成功 ${actuallyBound} 张，但包含 ${duplicateCerts.length} 张重复证号，需要人工复核`
          : `成功绑定 ${actuallyBound} 张检疫证`,
        warnings: warnings.concat(
          needsReview
            ? [`批次包含 ${duplicateCerts.length} 张重复证号：${duplicateCerts.join(', ')}`]
            : [],
        ),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async unbindCertificates(
    dto: UnbindCertificatesDto,
    user: UserContext,
  ): Promise<ProcessingResult<{
    batch: Batch;
    unboundCount: number;
  }>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const batch = await this.batchRepository.findOne({
        where: { id: dto.batchId },
      });

      if (!batch) {
        throw new BatchNotFoundException(dto.batchId);
      }

      const certificates = await this.certificateRepository.find({
        where: { id: In(dto.certificateIds), batchId: batch.id },
      });

      let unboundCount = 0;

      for (const cert of certificates) {
        cert.batchId = null;
        cert.batchNumber = null;
        cert.lastOperatorId = user.userId;
        cert.lastOperatorName = user.userName;

        await this.certificateService.updateStatus(
          cert.id,
          CertificateStatus.ISSUED,
          user,
          {
            action: FlowAction.BATCH_UNBOUND,
            actionDescription: `从批次 ${batch.batchNumber} 解绑: ${dto.reason}`,
            relatedEntityId: batch.id,
            relatedEntityType: 'batch',
          },
        );

        unboundCount++;
      }

      if (unboundCount > 0) {
        batch.certificateCount -= unboundCount;

        const remainingCerts = await this.certificateRepository.find({
          where: { batchId: batch.id },
        });

        batch.totalAnimals = remainingCerts.reduce((sum, c) => sum + c.animalQuantity, 0);
        batch.totalWeight = remainingCerts.reduce((sum, c) => sum + (c.totalWeight || 0), 0);
        batch.hasDuplicateCertificates = remainingCerts.some((c) => c.hasDuplicate);

        await queryRunner.manager.save(Batch, batch);
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        data: {
          batch,
          unboundCount,
        },
        needsReview: false,
        message: `成功解绑 ${unboundCount} 张检疫证`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findById(id: string): Promise<Batch> {
    const batch = await this.batchRepository.findOne({ where: { id } });
    if (!batch) {
      throw new BatchNotFoundException(id);
    }
    return batch;
  }

  async getBatchDetail(batchId: string): Promise<ProcessingResult<{
    batch: Batch;
    certificates: Certificate[];
    hasDuplicates: boolean;
    duplicateCertificates: string[];
  }>> {
    const batch = await this.findById(batchId);
    const certificates = await this.certificateRepository.find({
      where: { batchId },
      order: { createdAt: 'DESC' },
    });

    const duplicateCertificates = certificates
      .filter((c) => c.hasDuplicate)
      .map((c) => c.certificateNumber);

    const uniqueDuplicates = [...new Set(duplicateCertificates)];

    return {
      success: true,
      data: {
        batch,
        certificates,
        hasDuplicates: uniqueDuplicates.length > 0,
        duplicateCertificates: uniqueDuplicates,
      },
      needsReview: uniqueDuplicates.length > 0,
      message: uniqueDuplicates.length > 0
        ? `批次详情查询成功，包含 ${uniqueDuplicates.length} 个重复证号`
        : '批次详情查询成功',
    };
  }

  async query(
    query: BatchQueryDto,
  ): Promise<PaginatedResult<Batch>> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const qb = this.batchRepository.createQueryBuilder('batch');

    if (query.batchNumber) {
      qb.andWhere('batch.batchNumber LIKE :batchNumber', {
        batchNumber: `%${query.batchNumber}%`,
      });
    }

    if (query.status?.length) {
      qb.andWhere('batch.status IN (:...status)', { status: query.status });
    }

    if (query.destination) {
      qb.andWhere('batch.destination LIKE :destination', {
        destination: `%${query.destination}%`,
      });
    }

    if (query.hasDuplicateCertificates !== undefined) {
      qb.andWhere('batch.hasDuplicateCertificates = :hasDuplicate', {
        hasDuplicate: query.hasDuplicateCertificates,
      });
    }

    const [items, total] = await qb
      .orderBy('batch.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateBatchStatus(
    batchId: string,
    newStatus: string,
    user: UserContext,
    reason?: string,
  ): Promise<ProcessingResult<Batch>> {
    const batch = await this.findById(batchId);
    const beforeData = { ...batch };

    batch.status = newStatus;

    const savedBatch = await this.batchRepository.save(batch);

    await this.auditLogService.log({
      entityType: EntityType.BATCH,
      entityId: batchId,
      entityNumber: batch.batchNumber,
      action: 'STATUS_UPDATE',
      description: `批次状态变更: ${beforeData.status} -> ${newStatus}`,
      user,
      beforeData: { status: beforeData.status },
      afterData: { status: newStatus },
      remarks: reason,
    });

    return {
      success: true,
      data: savedBatch,
      needsReview: false,
      message: '批次状态更新成功',
    };
  }
}
