package com.connector.ratelimit.model.entity;

import com.connector.ratelimit.model.enums.FailureReason;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "exception_record")
public class ExceptionRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String connectorCode;

    private String requestId;

    @Column(columnDefinition = "TEXT")
    private String rawInput;

    @Enumerated(EnumType.STRING)
    private FailureReason failureReason;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Column(columnDefinition = "TEXT")
    private String processingConclusion;

    private String handler;

    private Boolean isResolved = false;

    private String resolvedBy;

    private LocalDateTime resolvedAt;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
