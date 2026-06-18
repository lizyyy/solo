package com.xxx.financial;

import com.xxx.financial.cli.InterestReviewCli;
import com.xxx.financial.repository.ReviewRepository;
import com.xxx.financial.service.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ReviewServiceConfig {

    private final ReviewRepository reviewRepository;

    public ReviewServiceConfig(ReviewRepository reviewRepository) {
        this.reviewRepository = reviewRepository;
    }

    @Bean
    public TailAdjustmentService tailAdjustmentService() {
        return new TailAdjustmentService(reviewRepository);
    }

    @Bean
    public BalanceVerificationService balanceVerificationService() {
        return new BalanceVerificationService();
    }

    @Bean
    public TrusteeConfirmationService trusteeConfirmationService() {
        return new TrusteeConfirmationService();
    }

    @Bean
    public SelfCheckService selfCheckService() {
        return new SelfCheckService(
                tailAdjustmentService(),
                balanceVerificationService(),
                trusteeConfirmationService()
        );
    }

    @Bean
    public InterestReviewService interestReviewService() {
        return new InterestReviewService(
                tailAdjustmentService(),
                trusteeConfirmationService(),
                balanceVerificationService(),
                selfCheckService()
        );
    }

    @Bean
    public ExportService exportService() {
        return new ExportService();
    }
}
