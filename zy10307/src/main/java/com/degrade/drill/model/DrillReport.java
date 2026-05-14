package com.degrade.drill.model;

import com.degrade.drill.enums.DrillStatus;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "drill_report")
public class DrillReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long drillPlanId;

    @Column(nullable = false)
    private String planName;

    private String createdBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DrillStatus finalStatus;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Long durationSeconds;

    private Integer totalRequests = 0;

    private Integer fallbackHitCount = 0;

    private Double averageResponseTime = 0.0;

    private Double errorRate = 0.0;

    @Column(nullable = false)
    private String stopReason;

    @Column(columnDefinition = "TEXT")
    private String observations;

    @Column(nullable = false, updatable = false)
    private LocalDateTime archivedAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        if (archivedAt == null) {
            archivedAt = LocalDateTime.now();
        }
    }
}