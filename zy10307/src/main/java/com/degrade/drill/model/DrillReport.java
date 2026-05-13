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

    @Column(nullable = false)
    private Long drillPlanId;

    @Column(nullable = false)
    private String planName;

    @Enumerated(EnumType.STRING)
    private DrillStatus finalStatus;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Long durationSeconds;

    private Integer totalRequests;

    private Integer fallbackHitCount;

    private Double averageResponseTime;

    private Double errorRate;

    private String stopReason;

    @Column(columnDefinition = "TEXT")
    private String observations;

    private LocalDateTime archivedAt = LocalDateTime.now();
}