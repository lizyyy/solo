package com.ortho.rework.entity;

import com.ortho.rework.enums.OperationType;
import com.ortho.rework.enums.ReworkStatus;
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
    private Long reworkOrderId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OperationType operationType;

    @Enumerated(EnumType.STRING)
    private ReworkStatus fromStatus;

    @Enumerated(EnumType.STRING)
    private ReworkStatus toStatus;

    @Column(length = 2000)
    private String remark;

    private String operator;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
