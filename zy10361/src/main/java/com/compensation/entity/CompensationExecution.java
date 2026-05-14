package com.compensation.entity;

import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "compensation_execution")
public class CompensationExecution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "instruction_id", nullable = false, length = 64)
    private String instructionId;

    @Column(name = "execution_id", unique = true, nullable = false, length = 64)
    private String executionId;

    @Column(name = "executor", length = 64)
    private String executor;

    @Column(name = "executed_at")
    private LocalDateTime executedAt;

    @Column(name = "execution_result", length = 32)
    private String executionResult;

    @Column(name = "result_detail", columnDefinition = "TEXT")
    private String resultDetail;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
