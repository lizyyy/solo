package com.factory.gauge.entity;

import com.factory.gauge.entity.enums.BatchStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "product_batch", indexes = {
    @Index(name = "idx_batch_no", columnList = "batchNo", unique = true),
    @Index(name = "idx_batch_tool_id", columnList = "toolId"),
    @Index(name = "idx_batch_status", columnList = "status")
})
public class ProductBatch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50, unique = true)
    private String batchNo;

    @Column(nullable = false, length = 100)
    private String productName;

    @Column(nullable = false)
    private Long toolId;

    @Column(length = 50)
    private String toolNo;

    @Column(nullable = false)
    private Integer quantity;

    @Column(length = 200)
    private String productionLine;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BatchStatus status = BatchStatus.NORMAL;

    @Column(length = 500)
    private String lockReason;

    @Column(length = 500)
    private String remarks;

    @Column(length = 100)
    private String createdBy;

    @Column(length = 100)
    private String updatedBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Version
    private Integer version;
}
