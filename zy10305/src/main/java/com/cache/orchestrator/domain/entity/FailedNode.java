package com.cache.orchestrator.domain.entity;

import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "failed_nodes")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FailedNode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nodeId;

    @Column(nullable = false)
    private String failureReason;

    private Integer retryCount;

    private LocalDateTime failedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private InvalidationBatch batch;

    @PrePersist
    protected void onCreate() {
        failedAt = LocalDateTime.now();
        if (retryCount == null) {
            retryCount = 0;
        }
    }
}
