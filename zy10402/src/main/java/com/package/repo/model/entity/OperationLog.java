package com.package.repo.model.entity;

import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "operation_logs")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OperationLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String operationType;

    @Column(length = 100)
    private String operator;

    @Column(length = 500)
    private String resourceKey;

    @Column(columnDefinition = "TEXT")
    private String rawInput;

    @Column(columnDefinition = "TEXT")
    private String processingConclusion;

    @Column(nullable = false)
    private Boolean success;

    @Column(length = 1000)
    private String errorMessage;

    @Column(nullable = false)
    private LocalDateTime operationTime;

    @PrePersist
    protected void onCreate() {
        if (operationTime == null) {
            operationTime = LocalDateTime.now();
        }
    }
}
