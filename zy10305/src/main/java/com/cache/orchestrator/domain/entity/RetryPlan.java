package com.cache.orchestrator.domain.entity;

import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "retry_plans")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RetryPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nodeId;

    @Column(nullable = false)
    private Integer retryNumber;

    @Column(nullable = false)
    private Integer maxRetries;

    @Column(nullable = false)
    private Long delaySeconds;

    private LocalDateTime scheduledAt;

    private LocalDateTime executedAt;

    @Column(length = 1000)
    private String retryResult;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private InvalidationBatch batch;
}
