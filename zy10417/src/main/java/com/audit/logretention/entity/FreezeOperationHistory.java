package com.audit.logretention.entity;

import com.audit.logretention.enums.FreezeStatus;
import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "freeze_operation_history")
public class FreezeOperationHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long freezeId;

    @Column(nullable = false, length = 64)
    private String requestId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private FreezeStatus previousStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private FreezeStatus currentStatus;

    @Column(nullable = false, length = 64)
    private String operator;

    @Column(length = 512)
    private String operationRemark;

    @Column(columnDefinition = "TEXT")
    private String operationDetail;

    @Column(nullable = false)
    private LocalDateTime operatedAt;

    @PrePersist
    protected void onCreate() {
        operatedAt = LocalDateTime.now();
    }
}