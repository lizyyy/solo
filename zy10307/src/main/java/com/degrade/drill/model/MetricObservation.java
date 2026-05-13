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

    private String metricName;

    private Double metricValue;

    private String unit;

    private LocalDateTime observedAt = LocalDateTime.now();
}