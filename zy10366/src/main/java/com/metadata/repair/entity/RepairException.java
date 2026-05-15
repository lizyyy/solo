package com.metadata.repair.entity;

import javax.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "repair_exceptions")
public class RepairException {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String batchNo;

    private String fileId;

    private String businessNo;

    private String errorCode;

    @Column(length = 2000)
    private String errorMessage;

    @Column(length = 4000)
    private String stackTrace;

    private String errorStage;

    private Boolean resolved = false;

    private String resolvedBy;

    private LocalDateTime resolvedAt;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
