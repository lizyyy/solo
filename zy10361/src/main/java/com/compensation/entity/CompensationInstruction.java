package com.compensation.entity;

import com.compensation.enums.InstructionStatus;
import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "compensation_instruction")
public class CompensationInstruction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "instruction_id", unique = true, nullable = false, length = 64)
    private String instructionId;

    @Column(name = "process_id", nullable = false, length = 64)
    private String processId;

    @Column(name = "node_id", nullable = false, length = 64)
    private String nodeId;

    @Column(name = "instruction_type", nullable = false, length = 32)
    private String instructionType;

    @Column(name = "instruction_content", nullable = false, columnDefinition = "TEXT")
    private String instructionContent;

    @Column(name = "execution_order", nullable = false)
    private Integer executionOrder;

    @Column(name = "require_manual_confirm")
    private Boolean requireManualConfirm = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private InstructionStatus status;

    @Column(name = "retry_count")
    private Integer retryCount = 0;

    @Column(name = "max_retry")
    private Integer maxRetry = 3;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
