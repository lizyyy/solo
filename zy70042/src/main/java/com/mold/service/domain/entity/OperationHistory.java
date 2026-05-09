package com.mold.service.domain.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "operation_history", indexes = {
    @Index(name = "idx_history_entity", columnList = "entityType, entityId"),
    @Index(name = "idx_history_type", columnList = "operationType"),
    @Index(name = "idx_history_time", columnList = "operationTime")
})
@Data
public class OperationHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 50)
    private String entityType;
    
    @Column(nullable = false)
    private Long entityId;
    
    @Column(length = 100)
    private String entityCode;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private OperationType operationType;
    
    @Column(length = 2000)
    private String beforeValue;
    
    @Column(length = 2000)
    private String afterValue;
    
    @Column(length = 2000)
    private String diffDetail;
    
    @Column(length = 500)
    private String operationRemark;
    
    @Column(nullable = false)
    private LocalDateTime operationTime;
    
    @Column(length = 100)
    private String operator;
    
    @Column(length = 100)
    private String operatorRole;
    
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (operationTime == null) {
            operationTime = LocalDateTime.now();
        }
    }
    
    public enum OperationType {
        CREATE,
        UPDATE,
        DELETE,
        REVOKE,
        COMPENSATE,
        APPROVE,
        REJECT,
        COMPLETE,
        CANCEL,
        STATUS_CHANGE
    }
}
