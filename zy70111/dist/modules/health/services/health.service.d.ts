import { Repository } from 'typeorm';
import { Certificate } from '../../certificate/entities/certificate.entity';
import { ReviewTask } from '../../review/entities/review-task.entity';
export declare class HealthService {
    private readonly certificateRepository;
    private readonly reviewRepository;
    constructor(certificateRepository: Repository<Certificate>, reviewRepository: Repository<ReviewTask>);
    health(): Promise<{
        status: string;
        timestamp: string;
        version: string;
    }>;
    getSystemStatus(): Promise<{
        status: string;
        timestamp: string;
        statistics: {
            totalCertificates: number;
            pendingReviews: number;
            certificatesWithDuplicates: number;
            manuallyCorrected: number;
        };
        attentionRequired: boolean;
        attentionMessage: string;
    }>;
}
