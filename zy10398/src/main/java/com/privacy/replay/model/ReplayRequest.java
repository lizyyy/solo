package com.privacy.replay.model;

import lombok.Data;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "replay_requests")
public class ReplayRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String requestId;

    @Column(nullable = false)
    private String requesterId;

    @Column(nullable = false)
    private String purpose;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private String sampleIds;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ReplayRequestStatus status = ReplayRequestStatus.PENDING;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private MaskingLevel maskingLevel;

    @Column(nullable = false)
    private BigDecimal budgetCost;

    private String approverId;

    private String approvalComment;

    private LocalDateTime approvedAt;

    private LocalDateTime executedAt;

    private LocalDateTime completedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime expiredAt;

    private String errorMessage;

    @Version
    private Long version;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
