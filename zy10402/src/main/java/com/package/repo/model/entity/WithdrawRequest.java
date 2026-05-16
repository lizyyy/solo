package com.package.repo.model.entity;

import com.package.repo.model.enums.ArbitrationResult;
import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "withdraw_requests")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WithdrawRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 100)
    private String requestId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "package_version_id", nullable = false)
    private PackageVersion packageVersion;

    @Column(nullable = false, length = 100)
    private String requester;

    @Column(length = 2000)
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    @Builder.Default
    private ArbitrationResult arbitrationResult = ArbitrationResult.PENDING;

    @Column(length = 100)
    private String arbitrator;

    @Column(length = 2000)
    private String arbitrationComment;

    private LocalDateTime arbitrationTime;

    @Column(nullable = false)
    private LocalDateTime requestTime;

    @Column(nullable = false)
    @Builder.Default
    private Boolean idempotentProcessed = false;

    @OneToMany(mappedBy = "withdrawRequest", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ImpactReport> impactReports = new ArrayList<>();

    @Column(length = 2000)
    private String rawInput;

    @Column(length = 1000)
    private String processingConclusion;

    @PrePersist
    protected void onCreate() {
        if (requestTime == null) {
            requestTime = LocalDateTime.now();
        }
    }
}
