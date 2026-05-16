package com.dependency.license.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "audit_logs")
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String operation;

    @Column(nullable = false)
    private String entityType;

    private Long entityId;

    @Column(length = 4000)
    private String originalInput;

    @Column(length = 4000)
    private String processingResult;

    private String operator;

    private Boolean success;

    @Column(length = 2000)
    private String errorMessage;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}