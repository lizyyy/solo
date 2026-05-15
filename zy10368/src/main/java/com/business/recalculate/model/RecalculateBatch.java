package com.business.recalculate.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "recalculate_batch")
public class RecalculateBatch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String batchNo;

    @Column(nullable = false)
    private String batchName;

    @Column(length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RecalculateStatus status;

    @OneToOne(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "event_scope_id")
    private EventScope eventScope;

    @ManyToMany
    @JoinTable(
        name = "batch_rules",
        joinColumns = @JoinColumn(name = "batch_id"),
        inverseJoinColumns = @JoinColumn(name = "rule_id")
    )
    private List<ProcessingRule> processingRules = new ArrayList<>();

    private Integer totalEventCount;

    private Integer processedEventCount;

    private Integer successEventCount;

    private Integer failedEventCount;

    @Column(length = 4000)
    private String errorMessage;

    @Column(length = 4000)
    private String errorDetail;

    private String errorCode;

    private LocalDateTime statusUpdatedAt;

    @Column(nullable = false)
    private String idempotencyKey;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String createdBy;

    private String updatedBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        statusUpdatedAt = LocalDateTime.now();
        if (status == null) {
            status = RecalculateStatus.CREATED;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void updateStatus(RecalculateStatus newStatus) {
        if (this.status.canTransitionTo(newStatus)) {
            this.status = newStatus;
            this.statusUpdatedAt = LocalDateTime.now();
        } else {
            throw new IllegalStateException(
                String.format("无法从状态 %s 转换到 %s", this.status.getDisplayName(), newStatus.getDisplayName())
            );
        }
    }

    public void setError(String errorCode, String errorMessage, String errorDetail) {
        this.errorCode = errorCode;
        this.errorMessage = errorMessage;
        this.errorDetail = errorDetail;
    }

    public void clearError() {
        this.errorCode = null;
        this.errorMessage = null;
        this.errorDetail = null;
    }
}
