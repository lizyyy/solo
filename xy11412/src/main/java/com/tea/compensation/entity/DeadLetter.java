package com.tea.compensation.entity;

import com.tea.compensation.enums.TaskStatus;
import com.tea.compensation.enums.TaskType;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "dead_letter", indexes = {
    @Index(name = "idx_batch_no", columnList = "batchNo", unique = true),
    @Index(name = "idx_store_id", columnList = "storeId"),
    @Index(name = "idx_task_type", columnList = "taskType"),
    @Index(name = "idx_created_at", columnList = "createdAt")
})
public class DeadLetter {

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

    @Lob
    @Column(columnDefinition = "TEXT")
    private String taskContent;

    @Column(precision = 15, scale = 2)
    private BigDecimal totalAmount;

    private Integer totalCount;

    private Integer retryCount;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String failReason;

    @Column(length = 500)
    private String lastError;

    @Column(nullable = false)
    private LocalDateTime deadLetterTime;

    @Column(length = 64)
    private String handledBy;

    private LocalDateTime handledAt;

    @Column(length = 2000)
    private String handleRemark;

    private Boolean recovered = false;

    private LocalDateTime recoveredAt;

    @Column(length = 64)
    private String recoveredBy;

    @Column(length = 64)
    private String newBatchNo;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(length = 64)
    private String creator;
}
