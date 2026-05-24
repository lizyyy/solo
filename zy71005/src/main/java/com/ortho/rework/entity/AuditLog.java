package com.ortho.rework.entity;

import com.ortho.rework.enums.OperationType;
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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OperationType operationType;

    private String reworkNo;

    private String batchNo;

    private String patientNo;

    private String operator;

    @Column(length = 1000)
    private String remark;

    private String beforeStatus;

    private String afterStatus;

    private Boolean isDuplicateAttempt = false;

    private LocalDateTime operationTime;

    @PrePersist
    protected void onCreate() {
        operationTime = LocalDateTime.now();
    }
}
