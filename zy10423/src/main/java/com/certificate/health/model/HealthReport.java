package com.certificate.health.model;

import com.certificate.health.enums.HealthStatus;
import com.certificate.health.enums.RiskLevel;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "health_report")
public class HealthReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_id")
    private String reportId;

    @Column(name = "generated_at")
    private LocalDateTime generatedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "overall_status")
    private HealthStatus overallStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "overall_risk_level")
    private RiskLevel overallRiskLevel;

    @Column(name = "total_certificates_in_chain")
    private Integer totalCertificatesInChain;

    @Column(name = "expired_certificates_count")
    private Integer expiredCertificatesCount;

    @Column(name = "near_expiry_certificates_count")
    private Integer nearExpiryCertificatesCount;

    @Column(name = "weak_algorithm_certificates_count")
    private Integer weakAlgorithmCertificatesCount;

    @Column(name = "chain_validation_passed")
    private Boolean chainValidationPassed;

    @Column(name = "chain_validation_message", length = 2000)
    private String chainValidationMessage;

    @Column(name = "has_missing_intermediates")
    private Boolean hasMissingIntermediates;

    @Column(name = "missing_intermediates_details", length = 1000)
    private String missingIntermediatesDetails;

    @Column(name = "summary", length = 3000)
    private String summary;

    @Column(name = "original_input_hash")
    private String originalInputHash;

    @Column(name = "processing_conclusion", length = 2000)
    private String processingConclusion;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "report_id")
    @Builder.Default
    private List<FixSuggestion> fixSuggestions = new ArrayList<>();

    @Column(name = "exported_at")
    private LocalDateTime exportedAt;

    @Column(name = "exported_format")
    private String exportedFormat;
}
