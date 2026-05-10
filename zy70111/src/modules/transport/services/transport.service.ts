import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';

import { TransportRecord } from '../entities/transport-record.entity';
import { Certificate } from '../../certificate/entities/certificate.entity';
import {
  CertificateStatus,
  TransportStatus,
  FlowAction,
  ReviewPriority,
  ProcessingResult,
  UserContext,
  PaginatedResult,
  EntityType,
} from '../../../common/types';
import {
  TransportNotFoundException,
  BatchNotFoundException,
  InvalidStatusTransitionException,
} from '../../../common/exceptions';
import { BatchService } from '../../batch/services/batch.service';
import { CertificateService } from '../../certificate/services/certificate.service';
import { FlowHistoryService } from '../../history/services/flow-history.service';
import { AuditLogService } from '../../history/services/audit-log.service';
import { CreateTransportDto, VerifyTransportDto, TransportQueryDto } from '../dto/transport.dto';

@Injectable()
export class TransportService {
  private readonly logger = new Logger(TransportService.name);

  constructor(
    @InjectRepository(TransportRecord)
    private readonly transportRepository: Repository<TransportRecord>,
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
    private readonly dataSource: DataSource,
    private readonly batchService: BatchService,
    private readonly certificateService: CertificateService,
    private readonly flowHistoryService: FlowHistoryService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    dto: CreateTransportDto,
    user: UserContext,
  ): Promise<ProcessingResult<{
    transport: TransportRecord;
    certificates: Certificate[];
    hasDuplicates: boolean;
    duplicateCertificates: string[];
  }>> {
    const batch = await this.batchService.findById(dto.batchId);

    const transport = this.transportRepository.create({
      ...dto,
      batchNumber: batch.batchNumber,
      status: TransportStatus.PENDING,
      createdBy: user.userId,
      createdByName: user.userName,
    });

    const savedTransport = await this.transportRepository.save(transport);

    const certificates = await this.certificateRepository.find({
      where: { batchId: dto.batchId },
    });

    const duplicateCertificates = [
      ...new Set(certificates.filter((c) => c.hasDuplicate).map((c) => c.certificateNumber)),
    ];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const cert of certificates) {
        await this.certificateService.updateStatus(
          cert.id,
          CertificateStatus.IN_TRANSPORT,
          user,
          {
            action: FlowAction.TRANSPORT_STARTED,
            actionDescription: `开始运输，运输单号: ${savedTransport.transportNumber}`,
            relatedEntityId: savedTransport.id,
            relatedEntityType: 'transport',
          },
        );
      }

      savedTransport.status = TransportStatus.IN_PROGRESS;
      await queryRunner.manager.save(TransportRecord, savedTransport);

      await this.auditLogService.log({
        entityType: EntityType.TRANSPORT,
        entityId: savedTransport.id,
        entityNumber: savedTransport.transportNumber,
        action: 'CREATE',
        description: `创建运输记录: ${savedTransport.transportNumber}`,
        user,
        afterData: { ...savedTransport },
      });

      await queryRunner.commitTransaction();

      const needsReview = duplicateCertificates.length > 0;

      return {
        success: true,
        data: {
          transport: savedTransport,
          certificates,
          hasDuplicates: duplicateCertificates.length > 0,
          duplicateCertificates,
        },
        needsReview,
        reviewReason: needsReview ? 'TRANSPORT_CONTAINS_DUPLICATE_CERTS' : undefined,
        reviewPriority: needsReview ? ReviewPriority.HIGH : undefined,
        message: needsReview
          ? `运输创建成功，但包含 ${duplicateCertificates.length} 个重复证号，建议在核销前人工复核`
          : '运输创建成功，所有检疫证已进入运输状态',
        warnings: needsReview
          ? [`包含重复证号：${duplicateCertificates.join(', ')}，建议人工复核`]
          : [],
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async verifyTransport(
    dto: VerifyTransportDto,
    user: UserContext,
  ): Promise<ProcessingResult<{
    transport: TransportRecord;
    verifiedCount: number;
    warnings: string[];
  }>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transport = await this.transportRepository.findOne({
        where: { id: dto.transportId },
      });

      if (!transport) {
        throw new TransportNotFoundException(dto.transportId);
      }

      if (transport.status !== TransportStatus.IN_PROGRESS) {
        throw new InvalidStatusTransitionException(
          transport.status,
          TransportStatus.VERIFIED,
          `运输记录状态为 ${transport.status}，无法核销`,
        );
      }

      const allBatchCerts = await this.certificateRepository.find({
        where: { batchId: transport.batchId },
      });

      let certsToVerify: Certificate[];
      if (dto.certificateIds?.length) {
        certsToVerify = allBatchCerts.filter((c) => dto.certificateIds.includes(c.id));
      } else {
        certsToVerify = allBatchCerts;
      }

      const warnings: string[] = [];
      const duplicateCerts = certsToVerify.filter((c) => c.hasDuplicate);
      let actuallyVerified = 0;

      for (const cert of certsToVerify) {
        if (cert.status !== CertificateStatus.IN_TRANSPORT) {
          warnings.push(`检疫证 ${cert.certificateNumber} 状态为 ${cert.status}，已跳过`);
          continue;
        }

        await this.certificateService.updateStatus(
          cert.id,
          CertificateStatus.TRANSPORT_VERIFIED,
          user,
          {
            action: FlowAction.TRANSPORT_VERIFIED,
            actionDescription: `运输核销完成，运输单号: ${transport.transportNumber}`,
            relatedEntityId: transport.id,
            relatedEntityType: 'transport',
          },
        );

        actuallyVerified++;
      }

      transport.status = TransportStatus.VERIFIED;
      transport.verifiedAt = new Date();
      transport.verifiedBy = user.userId;
      transport.verifiedByName = user.userName;
      transport.actualArrivalTime = dto.actualArrivalTime || new Date();
      transport.verificationRemarks = dto.verificationRemarks;
      transport.hasAnomaly = dto.hasAnomaly || false;
      transport.anomalyDescription = dto.anomalyDescription;

      await queryRunner.manager.save(TransportRecord, transport);

      await this.auditLogService.log({
        entityType: EntityType.TRANSPORT,
        entityId: transport.id,
        entityNumber: transport.transportNumber,
        action: 'VERIFY',
        description: `运输核销: ${transport.transportNumber}`,
        user,
        beforeData: { status: TransportStatus.IN_PROGRESS },
        afterData: { status: TransportStatus.VERIFIED },
        requestData: dto,
      });

      await queryRunner.commitTransaction();

      const needsReview = duplicateCerts.length > 0;

      return {
        success: true,
        data: {
          transport,
          verifiedCount: actuallyVerified,
          warnings,
        },
        needsReview,
        reviewReason: needsReview ? 'VERIFIED_WITH_DUPLICATE_CERTS' : undefined,
        reviewPriority: needsReview ? ReviewPriority.HIGH : undefined,
        message: needsReview
          ? `核销成功 ${actuallyVerified} 张，但包含 ${duplicateCerts.length} 张重复证号，需市场端重点关注`
          : `运输核销成功，共 ${actuallyVerified} 张检疫证`,
        warnings: warnings.concat(
          needsReview
            ? [`注意：本次核销包含 ${duplicateCerts.length} 张重复证号，市场端验收时请重点核验`]
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

  async findById(id: string): Promise<TransportRecord> {
    const transport = await this.transportRepository.findOne({ where: { id } });
    if (!transport) {
      throw new TransportNotFoundException(id);
    }
    return transport;
  }

  async getTransportDetail(transportId: string): Promise<ProcessingResult<{
    transport: TransportRecord;
    certificates: Certificate[];
    hasDuplicates: boolean;
    duplicateCertificates: string[];
  }>> {
    const transport = await this.findById(transportId);

    const certificates = await this.certificateRepository.find({
      where: { batchId: transport.batchId },
      order: { createdAt: 'DESC' },
    });

    const duplicateCertificates = [
      ...new Set(certificates.filter((c) => c.hasDuplicate).map((c) => c.certificateNumber)),
    ];

    return {
      success: true,
      data: {
        transport,
        certificates,
        hasDuplicates: duplicateCertificates.length > 0,
        duplicateCertificates,
      },
      needsReview: duplicateCertificates.length > 0,
      message: duplicateCertificates.length > 0
        ? `运输详情查询成功，包含 ${duplicateCertificates.length} 个重复证号`
        : '运输详情查询成功',
    };
  }

  async query(
    query: TransportQueryDto,
  ): Promise<PaginatedResult<TransportRecord>> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const qb = this.transportRepository.createQueryBuilder('transport');

    if (query.transportNumber) {
      qb.andWhere('transport.transportNumber LIKE :transportNumber', {
        transportNumber: `%${query.transportNumber}%`,
      });
    }

    if (query.batchNumber) {
      qb.andWhere('transport.batchNumber LIKE :batchNumber', {
        batchNumber: `%${query.batchNumber}%`,
      });
    }

    if (query.status?.length) {
      qb.andWhere('transport.status IN (:...status)', { status: query.status });
    }

    if (query.vehiclePlateNumber) {
      qb.andWhere('transport.vehiclePlateNumber LIKE :plate', {
        plate: `%${query.vehiclePlateNumber}%`,
      });
    }

    if (query.hasAnomaly !== undefined) {
      qb.andWhere('transport.hasAnomaly = :hasAnomaly', {
        hasAnomaly: query.hasAnomaly,
      });
    }

    const [items, total] = await qb
      .orderBy('transport.createdAt', 'DESC')
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
}
