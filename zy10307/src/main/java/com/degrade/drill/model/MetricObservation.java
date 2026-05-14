package com.degrade.drill.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "metric_observation")
public class MetricObservation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long drillPlanId;

    @Column(nullable = false, length = 50)
    private String metricName;

    @Column(nullable = false)
    private Double metricValue;

    @Column(length = 20)
    private String unit;

    @Column(nullable = false, updatable = false)
    private LocalDateTime observedAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        if (observedAt == null) {
            observedAt = LocalDateTime.now();
        }
    }
}