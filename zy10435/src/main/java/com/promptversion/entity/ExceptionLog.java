package com.promptversion.entity;

import lombok.Data;
import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "exception_log")
public class ExceptionLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String operationType;

    @Column(columnDefinition = "TEXT")
    private String originalInput;

    @Column(length = 2000)
    private String errorMessage;

    @Column(columnDefinition = "TEXT")
    private String stackTrace;

    @Column(length = 2000)
    private String conclusion;

    private Long templateId;

    private Long versionId;

    private String operator;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}