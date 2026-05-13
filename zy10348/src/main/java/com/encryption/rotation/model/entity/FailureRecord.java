package com.encryption.rotation.model.entity;

import com.encryption.rotation.model.enums.FailureType;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "failure_records")
public class FailureRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String batchId;

    @Column(nullable = false)
    private String taskId;

    @Column(nullable = false)
    private String tenantId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FailureType failureType;

    @Column(length = 2000)
    private String errorMessage;

    @Column(length = 4000)
    private String stackTrace;

    private Boolean recoverable = false;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
