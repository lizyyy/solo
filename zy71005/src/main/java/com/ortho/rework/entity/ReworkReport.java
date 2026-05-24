package com.ortho.rework.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "rework_reports")
public class ReworkReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String reportNo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rework_order_id")
    private ReworkOrder reworkOrder;

    private LocalDateTime reportGeneratedTime;

    private String generatedBy;

    @Column(length = 2000)
    private String summary;

    private String technicianNote;

    private String doctorConfirmation;

    private String inspectionResult;

    private String reviewResult;

    private String closeReason;

    private Integer totalReworkCount;

    private Long totalProcessingDays;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
