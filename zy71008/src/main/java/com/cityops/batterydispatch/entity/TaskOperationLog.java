package com.cityops.batterydispatch.entity;

import com.cityops.batterydispatch.enums.DispatchStatus;
import com.cityops.batterydispatch.enums.OperationType;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "task_operation_logs")
public class TaskOperationLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String taskNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private OperationType operationType;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private DispatchStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private DispatchStatus toStatus;

    @Column(length = 500)
    private String operationReason;

    @Column(length = 1000)
    private String operationDetail;

    @Column(length = 50)
    private String operator;

    @Column(nullable = false)
    private LocalDateTime operationTime;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (operationTime == null) {
            operationTime = LocalDateTime.now();
        }
    }
}
