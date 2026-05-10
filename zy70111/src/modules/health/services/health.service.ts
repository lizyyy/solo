import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certificate } from '../../certificate/entities/certificate.entity';
import { ReviewTask } from '../../review/entities/review-task.entity';
import { ReviewStatus } from '../../../common/types';

@Injectable()
export class HealthService {
  constructor(
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
    @InjectRepository(ReviewTask)
    private readonly reviewRepository: Repository<ReviewTask>,
  ) {}

  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  async getSystemStatus() {
    const [totalCerts, pendingReviews, hasDuplicates, manuallyCorrected] = await Promise.all([
      this.certificateRepository.count(),
      this.reviewRepository.count({ where: { status: ReviewStatus.PENDING } }),
      this.certificateRepository.count({ where: { hasDuplicate: true } }),
      this.certificateRepository.count({ where: { hasManualCorrection: true } }),
    ]);

    return {
      status: 'operational',
      timestamp: new Date().toISOString(),
      statistics: {
        totalCertificates: totalCerts,
        pendingReviews: pendingReviews,
        certificatesWithDuplicates: hasDuplicates,
        manuallyCorrected: manuallyCorrected,
      },
      attentionRequired: pendingReviews > 0,
      attentionMessage:
        pendingReviews > 0
          ? `有 ${pendingReviews} 条待复核任务需要处理`
          : '系统运行正常，无需关注',
    };
  }
}
