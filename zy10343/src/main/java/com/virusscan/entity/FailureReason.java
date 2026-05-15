package com.virusscan.entity;

import javax.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "failure_reasons", indexes = {
    @Index(name = "idx_failure_task_id", columnList = "taskId"),
    @Index(name = "idx_failure_time", columnList = "failureTime")
})
public class FailureReason {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String failureId;

    @Column(nullable = false, length = 64)
    private String taskId;

    @Column(nullable = false, length = 64)
    private String fileId;

    @Column(nullable = false, length = 200)
    private String errorCode;

    @Column(nullable = false, length = 2000)
    private String errorMessage;

    @Column(length = 4000)
    private String stackTrace;

    @Column(length = 100)
    private String failedComponent;

    private Boolean retryable = false;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime failureTime;
}