import { HealthService } from '../services/health.service';
export declare class HealthController {
    private readonly healthService;
    constructor(healthService: HealthService);
    health(): Promise<{
        status: string;
        timestamp: string;
        version: string;
    }>;
    status(): Promise<{
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
