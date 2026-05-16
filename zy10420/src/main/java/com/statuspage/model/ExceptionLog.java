package com.statuspage.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "exception_logs")
public class ExceptionLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String incidentNumber;

    @Column(nullable = false)
    private String operation;

    @Column(nullable = false)
    private String errorCode;

    @Column(length = 1000)
    private String errorMessage;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String originalInput;

    @Column(columnDefinition = "TEXT")
    private String processingConclusion;

    private String requestedBy;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private Boolean resolved = false;

    private LocalDateTime resolvedAt;

    private String resolvedBy;
}