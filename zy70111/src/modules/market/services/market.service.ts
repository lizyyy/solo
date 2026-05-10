import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { MarketInspection } from '../entities/market-inspection.entity';
import { Certificate } from '../../certificate/entities/certificate.entity';
import {
  CertificateStatus,
  MarketInspectionResult,
  FlowAction,
  ReviewPriority,
  ProcessingResult,
  UserContext,
  PaginatedResult,
  EntityType,
} from '../../../common/types';
import {
  CertificateNotFoundException,
  InvalidStatusTransitionException,
} from '../../../common/exceptions';
import { CertificateService } from '../../certificate/services/certificate.service';
import { FlowHistoryService } from '../../history/services/flow-history.service';
import { AuditLogService } from '../../history/services/audit-log.service';
import { MarketInspectionDto, MarketQueryDto } from '../dto/market.dto';

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  constructor(
    @InjectRepository(MarketInspection)
    private readonly inspectionRepository: Repository<MarketInspection>,
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
    private readonly dataSource: DataSource,
    private readonly certificateService: CertificateService,
    private readonly flowHistoryService: FlowHistoryService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async inspect(
    dto: MarketInspectionDto,
    user: UserContext,
  ): Promise<ProcessingResult<{
    inspection: MarketInspection;
    certificate?: Certificate;
    warnings: string[];
  }>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const warnings: string[] = [];
      let certificate: Certificate | undefined;

      const certs = await this.certificateRepository.find({
        where: { certificateNumber: dto.certificateNumber },
        order: { createdAt: 'DESC' },
      });

      if (certs.length > 1) {
        warnings.push(
          `检测到证号 ${dto.certificateNumber} 有 ${certs.length} 条重复记录，请人工核验`,
        );
      }

      if (dto.certificateId) {
        certificate = certs.find((c) => c.id === dto.certificateId);
      }

      if (!certificate && certs.length > 0) {
        certificate = certs[0];
        warnings.push(`未指定具体ID，默认使用最新记录: ${certificate.id}`);
      }

      const inspection = this.inspectionRepository.create({
        ...dto,
        certificateId: certificate?.id,
        inspectorId: user.userId,
        inspectorName: user.userName,
      });

      const savedInspection = await queryRunner.manager.save(
        MarketInspection,
        inspection,
      );

      if (certificate) {
        if (certificate.hasDuplicate) {
          warnings.push(
            `证号 ${dto.certificateNumber} 存在重复标记，建议结合纸质证和系统信息确认`,
          );
        }

        if (dto.result === MarketInspectionResult.ACCEPTED) {
          if (
            certificate.status !== CertificateStatus.TRANSPORT_VERIFIED &&
            certificate.status !== CertificateStatus.IN_TRANSPORT
          ) {
            throw new InvalidStatusTransitionException(
              certificate.status,
              CertificateStatus.MARKET_ACCEPTED,
              `检疫证状态为 ${certificate.status}，无法直接验收，请先确认运输状态`,
            );
          }

          await this.certificateService.updateStatus(
            certificate.id,
            CertificateStatus.MARKET_ACCEPTED,
            user,
            {
              action: FlowAction.MARKET_ACCEPTED,
              actionDescription: `市场验收通过: ${dto.marketName}，经营户: ${dto.merchantName}`,
              relatedEntityId: savedInspection.id,
              relatedEntityType: 'market_inspection',
            },
          );

          if (certificate.inspectionDate) {
            const certDate = new Date(certificate.inspectionDate);
            const inspectDate = new Date(dto.inspectedAt);
            const diffDays = Math.floor(
              (inspectDate.getTime() - certDate.getTime()) / (1000 * 60 * 60 * 24),
            );
            if (diffDays > 7) {
              warnings.push(
                `检疫证已超过7天有效期（签发${diffDays}天），建议确认是否在有效期内使用`,
              );
            }
          }

          if (certificate.animalQuantity !== dto.inspectedQuantity) {
            warnings.push(
              `验收数量与证载数量不一致: 证载${certificate.animalQuantity}，验收${dto.inspectedQuantity}`,
            );
          }
        } else if (dto.result === MarketInspectionResult.NEEDS_REVIEW) {
          warnings.push(`验收结果为需复核，已标记待人工处理`);
        }
      } else {
        warnings.push(
          `未在系统中找到证号 ${dto.certificateNumber} 的记录，已保存验收记录但未更新检疫证状态`,
        );
      }

      await this.auditLogService.log({
        entityType: EntityType.MARKET_INSPECTION,
        entityId: savedInspection.id,
        entityNumber: dto.certificateNumber,
        action: 'INSPECT',
        description: `市场验收: ${dto.result}`,
        user,
        afterData: { ...savedInspection },
        requestData: dto,
      });

      await queryRunner.commitTransaction();

      const needsReview =
        certs.length > 1 ||
        dto.result === MarketInspectionResult.NEEDS_REVIEW ||
        !certificate;

      return {
        success: true,
        data: {
          inspection: savedInspection,
          certificate,
          warnings,
        },
        needsReview,
        reviewReason: needsReview
          ? certs.length > 1
            ? 'MARKET_INSPECTION_DUPLICATE_CERT'
            : !certificate
            ? 'MARKET_INSPECTION_CERT_NOT_FOUND'
            : 'MARKET_INSPECTION_NEEDS_REVIEW'
          : undefined,
        reviewPriority: needsReview ? ReviewPriority.HIGH : undefined,
        message: needsReview
          ? `验收记录已保存，但存在需要人工复核的情况`
          : '市场验收完成',
        warnings,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async query(
    query: MarketQueryDto,
  ): Promise<PaginatedResult<MarketInspection>> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const qb = this.inspectionRepository.createQueryBuilder('inspection');

    if (query.certificateNumber) {
      qb.andWhere('inspection.certificateNumber LIKE :certNumber', {
        certNumber: `%${query.certificateNumber}%`,
      });
    }

    if (query.result?.length) {
      qb.andWhere('inspection.result IN (:...result)', { result: query.result });
    }

    if (query.marketName) {
      qb.andWhere('inspection.marketName LIKE :marketName', {
        marketName: `%${query.marketName}%`,
      });
    }

    if (query.merchantName) {
      qb.andWhere('inspection.merchantName LIKE :merchantName', {
        merchantName: `%${query.merchantName}%`,
      });
    }

    if (query.startDate) {
      qb.andWhere('inspection.inspectedAt >= :startDate', { startDate: query.startDate });
    }

    if (query.endDate) {
      qb.andWhere('inspection.inspectedAt <= :endDate', { endDate: query.endDate });
    }

    const [items, total] = await qb
      .orderBy('inspection.inspectedAt', 'DESC')
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

  async findById(id: string): Promise<MarketInspection> {
    const inspection = await this.inspectionRepository.findOne({ where: { id } });
    if (!inspection) {
      throw new Error('验收记录不存在');
    }
    return inspection;
  }
}
