package com.tea.compensation.entity;

import com.tea.compensation.enums.DuplicateStrategy;
import com.tea.compensation.enums.TaskStatus;
import com.tea.compensation.enums.TaskType;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "compensation_task", indexes = {
    @Index(name = "idx_batch_no", columnList = "batchNo", unique = true),
    @Index(name = "idx_store_id", columnList = "storeId"),
    @Index(name = "idx_status", columnList = "status"),
    @Index(name = "idx_task_type", columnList = "taskType"),
    @Index(name = "idx_created_at", columnList = "createdAt")
})
public class CompensationTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64, unique = true)
    private String batchNo;

    @Column(nullable = false, length = 32)
    private String storeId;

    @Column(nullable = false, length = 100)
    private String storeName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private TaskType taskType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private TaskStatus status;

    @Column(length = 500)
    private String statusRemark;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String taskContent;

    @Column(precision = 15, scale = 2)
    private BigDecimal totalAmount;

    private Integer totalCount;

    private Integer successCount = 0;

    private Integer failCount = 0;

    @Column(nullable = false)
    private Integer retryCount = 0;

    @Column(nullable = false)
    private Integer maxRetryCount = 5;

    private LocalDateTime nextRetryTime;

    @Column(length = 32)
    private String externalReceiptNo;

    private LocalDateTime receiptTime;

    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private DuplicateStrategy duplicateStrategy = DuplicateStrategy.IGNORE;

    @Column(length = 64)
    private String parentBatchNo;

    @Column(nullable = false, length = 64)
    private String submitter;

    @Column(length = 64)
    private String currentHandler;

    @Column(length = 64)
    private String creator;

    @Column(length = 64)
    private String lastModifier;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Version
    private Integer version;

    private LocalDateTime frozenAt;

    @Column(length = 64)
    private String frozenBy;

    @Column(length = 500)
    private String frozenReason;

    @Column(length = 500)
    private String failReason;

    public boolean canRetry() {
        return status.isRetryable() && retryCount < maxRetryCount;
    }

    public boolean isFrozen() {
        return TaskStatus.FROZEN.equals(status);
    }

    public boolean isFinal() {
        return status.isFinal();
    }
}
