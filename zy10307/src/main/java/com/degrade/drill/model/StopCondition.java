package com.degrade.drill.model;

import com.degrade.drill.enums.StopConditionType;
import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "stop_condition")
public class StopCondition {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StopConditionType conditionType;

    private Double threshold;

    private String metricName;

    private Long durationSeconds;
}