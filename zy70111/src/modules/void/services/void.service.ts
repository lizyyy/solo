import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { VoidRecord } from '../entities/void-record.entity';
import { Certificate } from '../../certificate/entities/certificate.entity';
import {
  CertificateStatus,
  FlowAction,
  ReviewPriority,
  ProcessingResult,
  UserContext,
  EntityType,
} from '../../../common/types';
import {
  CertificateNotFoundException,
  CertificateAlreadyVoidedException,
} from '../../../common/exceptions';
import { CertificateService } from '../../certificate/services/certificate.service';
import { FlowHistoryService } from '../../history/services/flow-history.service';
import { AuditLogService } from '../../history/services/audit-log.service';
import { VoidCertificateDto, ReissueCertificateDto } from '../dto/void.dto';

@Injectable()
export class VoidService {
  private readonly logger = new Logger(VoidService.name);

  constructor(
    @InjectRepository(VoidRecord)
    private readonly voidRepository: Repository<VoidRecord>,
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
    private readonly dataSource: DataSource,
    private readonly certificateService: CertificateService,
    private readonly flowHistoryService: FlowHistoryService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async voidCertificate(
    dto: VoidCertificateDto,
    user: UserContext,
  ): Promise<ProcessingResult<{
    voidRecord: VoidRecord;
    certificate: Certificate;
    reissuedCertificate?: Certificate;
  }>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const certificate = await this.certificateRepository.findOne({
        where: { id: dto.certificateId },
      });

      if (!certificate) {
        throw new CertificateNotFoundException(dto.certificateId);
      }

      if (certificate.status === CertificateStatus.VOIDED) {
        throw new CertificateAlreadyVoidedException(certificate.certificateNumber);
      }

      const oldStatus = certificate.status;

      await this.certificateService.updateStatus(
        certificate.id,
        CertificateStatus.VOIDED,
        user,
        {
          action: FlowAction.CERTIFICATE_VOIDED,
          actionDescription: `作废原因: ${dto.reason} - ${dto.reasonDetails}`,
          reason: dto.reasonDetails,
        },
      );

      let reissuedCertificate: Certificate | undefined;

      if (dto.shouldReissue && dto.newCertificateNumber) {
        reissuedCertificate = await this.internalReissue(
          certificate,
          dto.newCertificateNumber,
          user,
          queryRunner,
        );
      }

      const voidRecord = this.voidRepository.create({
        certificateNumber: certificate.certificateNumber,
        certificateId: certificate.id,
        reason: dto.reason,
        reasonDetails: dto.reasonDetails,
        isReissued: !!reissuedCertificate,
        reissuedCertificateId: reissuedCertificate?.id,
        reissuedCertificateNumber: reissuedCertificate?.certificateNumber,
        requestedBy: user.userId,
        requestedByName: user.userName,
        approvedBy: user.userId,
        approvedByName: user.userName,
        approvedAt: new Date(),
        remarks: dto.remarks,
      });

      const savedVoidRecord = await queryRunner.manager.save(
        VoidRecord,
        voidRecord,
      );

      await this.auditLogService.log({
        entityType: EntityType.VOID_RECORD,
        entityId: savedVoidRecord.id,
        entityNumber: certificate.certificateNumber,
        action: 'VOID',
        description: `作废检疫证: ${certificate.certificateNumber}`,
        user,
        beforeData: { status: oldStatus },
        afterData: { status: CertificateStatus.VOIDED },
        requestData: dto,
      });

      await queryRunner.commitTransaction();

      return {
        success: true,
        data: {
          voidRecord: savedVoidRecord,
          certificate,
          reissuedCertificate,
        },
        needsReview: false,
        message: reissuedCertificate
          ? `检疫证已作废，并重新开具新证 ${reissuedCertificate.certificateNumber}`
          : `检疫证 ${certificate.certificateNumber} 已作废`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async internalReissue(
    originalCert: Certificate,
    newNumber: string,
    user: UserContext,
    queryRunner: any,
  ): Promise<Certificate> {
    const existingCerts = await this.certificateRepository.find({
      where: { certificateNumber: newNumber },
    });

    if (existingCerts.length > 0) {
      throw new Error(`新证号 ${newNumber} 已存在，请使用唯一证号`);
    }

    const newCert = queryRunner.manager.create(Certificate, {
      certificateNumber: newNumber,
      status: CertificateStatus.ISSUED,
      source: originalCert.source,
      farmName: originalCert.farmName,
      farmId: originalCert.farmId,
      slaughterhouseName: originalCert.slaughterhouseName,
      slaughterhouseId: originalCert.slaughterhouseId,
      animalType: originalCert.animalType,
      animalQuantity: originalCert.animalQuantity,
      totalWeight: originalCert.totalWeight,
      slaughterDate: originalCert.slaughterDate,
      inspectionDate: originalCert.inspectionDate,
      inspectorName: originalCert.inspectorName,
      issuerId: user.userId,
      issuerName: user.userName,
      originalCertificateId: originalCert.id,
      hasDuplicate: false,
      hasManualCorrection: false,
      remarks: `重开证，原始证号: ${originalCert.certificateNumber}`,
      metadata: {
        ...originalCert.metadata,
        isReissued: true,
        originalCertificateId: originalCert.id,
        originalCertificateNumber: originalCert.certificateNumber,
      },
      lastOperatorId: user.userId,
      lastOperatorName: user.userName,
    });

    const savedNewCert = await queryRunner.manager.save(Certificate, newCert);

    originalCert.reissuedCertificateId = savedNewCert.id;
    await queryRunner.manager.save(Certificate, originalCert);

    await this.flowHistoryService.recordAction({
      certificateNumber: savedNewCert.certificateNumber,
      certificateId: savedNewCert.id,
      action: FlowAction.CERTIFICATE_REISSUED,
      description: `重新开具检疫证，原始证号: ${originalCert.certificateNumber}`,
      previousStatus: null,
      newStatus: CertificateStatus.ISSUED,
      user,
      relatedEntityId: originalCert.id,
      relatedEntityType: 'certificate',
    });

    return savedNewCert;
  }

  async reissueCertificate(
    dto: ReissueCertificateDto,
    user: UserContext,
  ): Promise<ProcessingResult<{
    originalCertificate: Certificate;
    newCertificate: Certificate;
  }>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const originalCert = await this.certificateRepository.findOne({
        where: { id: dto.originalCertificateId },
      });

      if (!originalCert) {
        throw new CertificateNotFoundException(dto.originalCertificateId);
      }

      const existingCerts = await this.certificateRepository.find({
        where: { certificateNumber: dto.newCertificateNumber },
      });

      if (existingCerts.length > 0) {
        throw new Error(`新证号 ${dto.newCertificateNumber} 已存在，请使用唯一证号`);
      }

      const newCert = await this.internalReissue(
        originalCert,
        dto.newCertificateNumber,
        user,
        queryRunner,
      );

      await this.auditLogService.log({
        entityType: EntityType.CERTIFICATE,
        entityId: newCert.id,
        entityNumber: newCert.certificateNumber,
        action: 'REISSUE',
        description: `重开证: 原始证 ${originalCert.certificateNumber} -> 新证 ${newCert.certificateNumber}`,
        user,
        requestData: dto,
      });

      await queryRunner.commitTransaction();

      return {
        success: true,
        data: {
          originalCertificate: originalCert,
          newCertificate: newCert,
        },
        needsReview: existingCerts.length > 0,
        message: `已成功重开新证 ${newCert.certificateNumber}`,
        warnings: [`原始证号: ${originalCert.certificateNumber}`],
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findByCertificateId(certificateId: string): Promise<VoidRecord[]> {
    return this.voidRepository.find({
      where: { certificateId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByCertificateNumber(certificateNumber: string): Promise<VoidRecord[]> {
    return this.voidRepository.find({
      where: { certificateNumber },
      order: { createdAt: 'DESC' },
    });
  }
}
