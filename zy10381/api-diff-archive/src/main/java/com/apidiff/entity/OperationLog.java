package com.apidiff.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "operation_logs", indexes = {
    @Index(name = "idx_diff_record_id", columnList = "diffRecordId"),
    @Index(name = "idx_operation_type", columnList = "operationType"),
    @Index(name = "idx_operated_at", columnList = "operatedAt")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OperationLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long diffRecordId;

    @Column(nullable = false, length = 50)
    private String operationType;

    @Column(length = 2000)
    private String previousValue;

    @Column(length = 2000)
    private String newValue;

    @Column(length = 2000)
    private String remark;

    @Column(length = 500)
    private String operatedBy;

    @Column(nullable = false)
    private LocalDateTime operatedAt;

    @PrePersist
    protected void onCreate() {
        if (operatedAt == null) {
            operatedAt = LocalDateTime.now();
        }
    }
}
