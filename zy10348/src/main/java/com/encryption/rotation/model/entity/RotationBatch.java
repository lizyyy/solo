package com.encryption.rotation.model.entity;

import com.encryption.rotation.model.enums.RotationStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "rotation_batches")
public class RotationBatch {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(unique = true, nullable = false)
    private String batchNumber;

    @Column(nullable = false)
    private String tenantId;

    @Column(nullable = false)
    private String sourceKeyId;

    @Column(nullable = false)
    private String targetKeyId;

    @Column(nullable = false)
    private String createdBy;
    
    @Column(nullable = false, length = 64)
    private String dataSignature;

    private String reason;

    @Column(nullable = false)
    private Integer totalTaskCount = 0;

    private Integer successCount = 0;

    private Integer failedCount = 0;

    private Integer skippedCount = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RotationStatus status = RotationStatus.PENDING;

    private LocalDateTime startedAt;

    private LocalDateTime completedAt;

    @Column(length = 2000)
    private String errorMessage;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
